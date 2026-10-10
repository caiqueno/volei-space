import { supabaseAdmin as supabase } from '@/lib/supabase-admin'

type Linha = Record<string, unknown>

type SetEntrada = { numero: number; pontosA: number; pontosB: number }
type PresencaEntrada = { jogadorId: number; equipeId: number; presente: boolean; numero?: number | null }
type OcorrenciaEntrada = { tipo: string; descricao?: string | null; set?: number | null; jogadorId?: number | null }
type DestaqueEntrada = { tipo: string; jogadorId: number }

const TABELAS = ['SetPartida', 'SumulaPresenca', 'OcorrenciaPartida', 'DestaquesPartida'] as const

// O PostgREST não abre transação entre delete e insert. Esta função confere
// cada erro e, se a gravação quebra no meio, tenta recolocar o que leu antes.
// Duas gravações ao mesmo tempo ainda podem se atropelar. A correção definitiva
// é uma única função no banco, chamada por RPC, envolvendo sets, presenças,
// ocorrências, destaques e a Partida.
export async function gravarSumulaComRestauracao(entrada: {
  partidaId: number
  sets: SetEntrada[]
  presencas: PresencaEntrada[]
  ocorrencias?: OcorrenciaEntrada[]
  destaques?: DestaqueEntrada[]
  arbitroId: number | null
  partida: Record<string, unknown>
}) {
  const { partidaId } = entrada
  const antes = {
    SetPartida: await listar('SetPartida', partidaId),
    SumulaPresenca: await listar('SumulaPresenca', partidaId),
    OcorrenciaPartida: await listar('OcorrenciaPartida', partidaId),
    DestaquesPartida: await listar('DestaquesPartida', partidaId),
  }

  try {
    await substituir('SetPartida', partidaId, entrada.sets.map((set) => ({ ...set, partidaId })))
    await substituir('SumulaPresenca', partidaId, entrada.presencas.map((presenca) => ({ ...presenca, partidaId })))
    await substituirOcorrencias(partidaId, entrada.ocorrencias, entrada.arbitroId, entrada.sets)
    await substituir(
      'DestaquesPartida',
      partidaId,
      (entrada.destaques ?? []).map((destaque) => ({ ...destaque, partidaId })),
    )
    const { error: updateErr } = await supabase.from('Partida').update(entrada.partida).eq('id', partidaId)
    if (updateErr) throw updateErr
  } catch (err) {
    console.error('[sumula] gravação falhou; tentando restaurar o conteúdo anterior', err)
    await restaurar(partidaId, antes)
    throw err
  }
}

async function listar(tabela: string, partidaId: number) {
  const { data, error } = await supabase.from(tabela).select('*').eq('partidaId', partidaId)
  if (error) throw error
  return (data ?? []) as Linha[]
}

async function substituir(tabela: string, partidaId: number, linhas: Linha[]) {
  const { error: apagarErr } = await supabase.from(tabela).delete().eq('partidaId', partidaId)
  if (apagarErr) throw apagarErr
  if (linhas.length === 0) return
  const { error: inserirErr } = await supabase.from(tabela).insert(linhas)
  if (inserirErr) throw inserirErr
}

async function restaurar(partidaId: number, antes: Record<(typeof TABELAS)[number], Linha[]>) {
  for (const tabela of TABELAS) {
    const { error: apagarErr } = await supabase.from(tabela).delete().eq('partidaId', partidaId)
    if (apagarErr) {
      console.error(`[sumula] falha ao limpar ${tabela} na restauração`, apagarErr)
      continue
    }
    const linhas = antes[tabela]
    if (linhas.length === 0) continue
    const { error: inserirErr } = await supabase.from(tabela).insert(linhas)
    if (inserirErr) console.error(`[sumula] falha ao restaurar ${tabela}`, inserirErr)
  }
}

async function substituirOcorrencias(
  partidaId: number,
  ocorrencias: OcorrenciaEntrada[] | undefined,
  arbitroId: number | null,
  sets: SetEntrada[],
) {
  const { data: atuais, error: leituraErr } = await supabase
    .from('OcorrenciaPartida')
    .select('id,descricao')
    .eq('partidaId', partidaId)
  if (leituraErr) throw leituraErr
  const apagar = (atuais ?? [])
    .filter((item) => !String(item.descricao ?? '').startsWith('Registro de '))
    .map((item) => item.id)
  if (apagar.length > 0) {
    const { error: apagarErr } = await supabase.from('OcorrenciaPartida').delete().in('id', apagar)
    if (apagarErr) throw apagarErr
  }
  if (ocorrencias?.length) {
    const { error: inserirErr } = await supabase
      .from('OcorrenciaPartida')
      .insert(ocorrencias.map((ocorrencia) => ({ ...ocorrencia, partidaId })))
    if (inserirErr) throw inserirErr
  }
  const resumo = sets.map((set) => `${set.numero}:${set.pontosA}-${set.pontosB}`).join(', ') || 'sem sets'
  const { error: registroErr } = await supabase.from('OcorrenciaPartida').insert({
    partidaId,
    tipo: 'OBSERVACAO',
    descricao: `Registro de placar pelo árbitro ${arbitroId ?? 'sem identificação'} em ${new Date().toISOString()}: ${resumo}`,
  })
  if (registroErr) throw registroErr
}
