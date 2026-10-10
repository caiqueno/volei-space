import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { rpcAusente } from '@/lib/rpc-ausente'
import { deveRecusarAndamento, lerVersaoRegistro, marcarVersaoRegistro } from '@/lib/versao-sumula'

type Linha = Record<string, unknown>

type SetEntrada = { numero: number; pontosA: number; pontosB: number }
type PresencaEntrada = { jogadorId: number; equipeId: number; presente: boolean; numero?: number | null }
type OcorrenciaEntrada = { tipo: string; descricao?: string | null; set?: number | null; jogadorId?: number | null }
type DestaqueEntrada = { tipo: string; jogadorId: number }

const TABELAS = ['SetPartida', 'SumulaPresenca', 'OcorrenciaPartida', 'DestaquesPartida'] as const
const TENTATIVAS_CHAVE_DUPLICADA = 48
const TENTATIVAS_RESERVA = 5

export class AndamentoSuperado extends Error {
  constructor() {
    super('Um salvamento mais recente já gravou esta súmula. Recarregue se o placar não bater.')
    this.name = 'AndamentoSuperado'
  }
}

/** Marca a ordem de chegada antes da validação lenta. O id maior é o pedido mais novo. */
export async function reservarAndamento(partidaId: number) {
  let ultimo: unknown
  for (let tentativa = 0; tentativa < TENTATIVAS_RESERVA; tentativa += 1) {
    const { data, error } = await supabase
      .from('OcorrenciaPartida')
      .insert({
        partidaId,
        tipo: 'OBSERVACAO',
        descricao: `Registro de andamento ${new Date().toISOString()}`,
      })
      .select('id')
      .single()
    if (!error && data?.id != null) return Number(data.id)
    ultimo = error
    if (!erroDeChaveDuplicada(error)) throw error ?? ultimo
  }
  throw ultimo
}

export async function liberarAndamento(reservaId: number) {
  const { error } = await supabase.from('OcorrenciaPartida').delete().eq('id', reservaId)
  if (error) throw error
}

type ErroBanco = { code?: string; message?: string; details?: string } | null | undefined

/** 23505 da sequence atrás do maior id. Cada tentativa consumida avança a sequence. */
export function erroDeChaveDuplicada(erro: ErroBanco) {
  const texto = `${erro?.code ?? ''} ${erro?.message ?? ''} ${erro?.details ?? ''}`
  return /23505|duplicate key/i.test(texto)
}

export async function gravarSumulaComRestauracao(entrada: {
  partidaId: number
  sets: SetEntrada[]
  presencas: PresencaEntrada[]
  ocorrencias?: OcorrenciaEntrada[]
  destaques?: DestaqueEntrada[]
  arbitroId: number | null
  partida: Record<string, unknown>
  versao?: number
  reservaId?: number
}) {
  const resumo = entrada.sets.map((set) => `${set.numero}:${set.pontosA}-${set.pontosB}`).join(', ') || 'sem sets'
  const registroBase = `Registro de placar pelo árbitro ${entrada.arbitroId ?? 'sem identificação'} em ${new Date().toISOString()}: ${resumo}`
  const registro = typeof entrada.versao === 'number' ? marcarVersaoRegistro(registroBase, entrada.versao) : registroBase
  let ultimo: unknown
  for (let tentativa = 0; tentativa < TENTATIVAS_CHAVE_DUPLICADA; tentativa += 1) {
    try {
      await conferirAndamentoAtual(entrada)
      await gravarUmaVez(entrada, registro)
      return
    } catch (err) {
      ultimo = err
      if (err instanceof AndamentoSuperado) throw err
      if (!erroDeChaveDuplicada(err as ErroBanco)) throw err
    }
  }
  throw ultimo
}

async function conferirAndamentoAtual(entrada: { partidaId: number; versao?: number; reservaId?: number }) {
  if (entrada.reservaId == null && typeof entrada.versao !== 'number') return
  const [versaoGravada, reservaMaisNova] = await Promise.all([
    typeof entrada.versao === 'number' ? lerVersaoGravada(entrada.partidaId) : Promise.resolve(null),
    entrada.reservaId == null ? Promise.resolve(null) : idDaReservaMaisNova(entrada.partidaId),
  ])
  if (deveRecusarAndamento({
    versaoCliente: entrada.versao,
    versaoGravada,
    reservaId: entrada.reservaId ?? null,
    reservaMaisNova,
  })) {
    throw new AndamentoSuperado()
  }
}

async function lerVersaoGravada(partidaId: number) {
  const { data, error } = await supabase
    .from('OcorrenciaPartida')
    .select('descricao')
    .eq('partidaId', partidaId)
    .like('descricao', 'Registro de placar%')
    .order('id', { ascending: false })
    .limit(20)
  if (error) throw error
  let maior: number | null = null
  for (const linha of data ?? []) {
    const versao = lerVersaoRegistro(String(linha.descricao ?? ''))
    if (versao != null && (maior == null || versao > maior)) maior = versao
  }
  return maior
}

async function idDaReservaMaisNova(partidaId: number) {
  const { data, error } = await supabase
    .from('OcorrenciaPartida')
    .select('id')
    .eq('partidaId', partidaId)
    .like('descricao', 'Registro de andamento %')
    .order('id', { ascending: false })
    .limit(1)
  if (error) throw error
  const id = data?.[0]?.id
  return id == null ? null : Number(id)
}

async function gravarUmaVez(entrada: {
  partidaId: number
  sets: SetEntrada[]
  presencas: PresencaEntrada[]
  ocorrencias?: OcorrenciaEntrada[]
  destaques?: DestaqueEntrada[]
  partida: Record<string, unknown>
}, registro: string) {
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
