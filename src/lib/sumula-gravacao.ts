import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { rpcAusente } from '@/lib/rpc-ausente'

type Linha = Record<string, unknown>

type SetEntrada = { numero: number; pontosA: number; pontosB: number }
type PresencaEntrada = { jogadorId: number; equipeId: number; presente: boolean; numero?: number | null }
type OcorrenciaEntrada = { tipo: string; descricao?: string | null; set?: number | null; jogadorId?: number | null }
type DestaqueEntrada = { tipo: string; jogadorId: number }

const TABELAS = ['SetPartida', 'SumulaPresenca', 'OcorrenciaPartida', 'DestaquesPartida'] as const

export async function gravarSumulaComRestauracao(entrada: {
  partidaId: number
  sets: SetEntrada[]
  presencas: PresencaEntrada[]
  ocorrencias?: OcorrenciaEntrada[]
  destaques?: DestaqueEntrada[]
  arbitroId: number | null
  partida: Record<string, unknown>
}) {
  const resumo = entrada.sets.map((set) => `${set.numero}:${set.pontosA}-${set.pontosB}`).join(', ') || 'sem sets'
  const registro = `Registro de placar pelo árbitro ${entrada.arbitroId ?? 'sem identificação'} em ${new Date().toISOString()}: ${resumo}`
  const { error } = await supabase.rpc('gravar_sumula_partida', {
    p_partida_id: entrada.partidaId,
    p_sets: entrada.sets,
    p_presencas: entrada.presencas,
    p_ocorrencias: entrada.ocorrencias ?? [],
    p_destaques: entrada.destaques ?? [],
    p_partida: entrada.partida,
    p_registro: registro,
  })
  if (!error) return
  if (!rpcAusente(error)) throw error
  // A migration 20261010137000 ainda não foi aplicada neste banco.
  console.error('[sumula] RPC gravar_sumula_partida ausente; gravação sem transação')
  await gravarSemTransacao(entrada, registro)
}

async function gravarSemTransacao(entrada: {
  partidaId: number
  sets: SetEntrada[]
  presencas: PresencaEntrada[]
  ocorrencias?: OcorrenciaEntrada[]
  destaques?: DestaqueEntrada[]
  partida: Record<string, unknown>
}, registro: string) {
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
    await substituirOcorrencias(partidaId, entrada.ocorrencias, registro)
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

async function substituirOcorrencias(partidaId: number, ocorrencias: OcorrenciaEntrada[] | undefined, registro: string) {
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
  const { error: registroErr } = await supabase.from('OcorrenciaPartida').insert({
    partidaId,
    tipo: 'OBSERVACAO',
    descricao: registro,
  })
  if (registroErr) throw registroErr
}
