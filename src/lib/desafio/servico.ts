/**
 * Desafio de vídeo (R11): casos de uso sobre a tabela "DesafioVideo". O cliente entra por parâmetro
 * (o teste usa banco falso). Regras puras em `modelo.ts`. Ver docs/analise/27-desafio-video.md.
 */
import { z } from 'zod'
import {
  MAX_LINK_VIDEO,
  MAX_MOTIVO,
  MENSAGEM_DESAFIO_INDISPONIVEL,
  DECISOES_DESAFIO,
  desafiosUsados,
  limiteDesafiosPorSet,
  normalizarMotivo,
  resolverDecisao,
  validarLinkVideo,
  type DecisaoDesafio,
} from './modelo'

export interface ClienteDesafio {
  from(tabela: string): any
}

type ErroDb = { code?: string; message?: string; details?: string | null } | null | undefined

export function tabelaDesafioAusente(erro: ErroDb): boolean {
  if (!erro) return false
  const texto = `${erro.message ?? ''} ${erro.details ?? ''}`
  return (
    erro.code === '42P01' ||
    erro.code === 'PGRST205' ||
    (/DesafioVideo/.test(texto) && /does not exist|schema cache|Could not find the table/i.test(texto))
  )
}

export type PartidaDesafio = { id: number; equipeAId: number | null; equipeBId: number | null }

export const desafioEntradaSchema = z.object({
  setNumero: z.number().int().min(1).max(5),
  equipeId: z.number().int().positive(),
  motivo: z.string().max(MAX_MOTIVO).nullish(),
  linkVideo: z.string().max(MAX_LINK_VIDEO).nullish(),
})
export const decisaoDesafioSchema = z.object({ decisao: z.enum(DECISOES_DESAFIO) })

export function desafioPublico(l: any) {
  return {
    id: l.id,
    setNumero: Number(l.setNumero),
    equipeId: Number(l.equipeId),
    estado: l.estado,
    motivo: l.motivo ?? null,
    linkVideo: l.linkVideo ?? null,
    pedidoBancoId: l.pedidoBancoId ?? null,
    solicitadoEm: l.solicitadoEm ?? null,
    decididoEm: l.decididoEm ?? null,
  }
}

export type ResultadoDesafio =
  | { tipo: 'OK'; status: 200 | 201; desafio: ReturnType<typeof desafioPublico> }
  | { tipo: 'INVALIDO'; status: 400 | 422; mensagem: string; codigo?: string; detalhes?: unknown }
  | { tipo: 'NAO_ENCONTRADO'; mensagem: string }
  | { tipo: 'CONFLITO'; mensagem: string; codigo: string }
  | { tipo: 'INDISPONIVEL'; mensagem: string }
  | { tipo: 'ERRO'; mensagem: string }

const indisponivel = (): ResultadoDesafio => ({ tipo: 'INDISPONIVEL', mensagem: MENSAGEM_DESAFIO_INDISPONIVEL })
const falha = (mensagem: string): ResultadoDesafio => ({ tipo: 'ERRO', mensagem })

function equipeDaPartida(partida: PartidaDesafio, equipeId: number): boolean {
  return (partida.equipeAId != null && Number(partida.equipeAId) === equipeId) || (partida.equipeBId != null && Number(partida.equipeBId) === equipeId)
}

/** Desafios da equipe no set (todos os estados). */
async function doSet(cliente: ClienteDesafio, partidaId: number, equipeId: number, setNumero: number) {
  return cliente.from('DesafioVideo').select('*').eq('partidaId', partidaId).eq('equipeId', equipeId).eq('setNumero', setNumero)
}

export type SituacaoLimite =
  | { tipo: 'OK'; usados: number; limite: number }
  | { tipo: 'EXCEDIDO'; usados: number; limite: number }
  | { tipo: 'INDISPONIVEL' }
  | { tipo: 'ERRO' }

/** Quantos desafios a equipe já gastou no set e se ainda cabe mais um. */
export async function situacaoDoLimite(
  cliente: ClienteDesafio,
  partidaId: number,
  equipeId: number,
  setNumero: number,
  limite: number = limiteDesafiosPorSet(),
): Promise<SituacaoLimite> {
  const r = await doSet(cliente, partidaId, equipeId, setNumero)
  if (r.error) return tabelaDesafioAusente(r.error) ? { tipo: 'INDISPONIVEL' } : { tipo: 'ERRO' }
  const usados = desafiosUsados((r.data ?? []) as any[])
  return usados >= limite ? { tipo: 'EXCEDIDO', usados, limite } : { tipo: 'OK', usados, limite }
}

export const MENSAGEM_LIMITE_DESAFIOS = (limite: number) => `A equipe já usou os ${limite} desafios permitidos neste set.`

export type OpcoesCriacao = {
  estado?: 'SOLICITADO' | 'EM_ANALISE'
  pedidoBancoId?: string | null
  limite?: number
}

/**
 * Registra um desafio. Valida equipe da partida, link do vídeo e limite por equipe por set.
 * Com `pedidoBancoId` é idempotente: se já existe desafio daquele pedido, devolve o existente (200).
 * Corrida: depois de gravar, recontamos; se estourou, o próprio registro é cancelado e a resposta é 422
 * (em disputa simultânea as duas requisições podem ser recusadas; o cliente tenta de novo).
 */
export async function criarDesafio(
  cliente: ClienteDesafio,
  partida: PartidaDesafio,
  corpo: unknown,
  opcoes: OpcoesCriacao = {},
): Promise<ResultadoDesafio> {
  const lido = desafioEntradaSchema.safeParse(corpo)
  if (!lido.success) return { tipo: 'INVALIDO', status: 400, mensagem: 'Dados inválidos.', detalhes: lido.error.flatten().fieldErrors }
  const e = lido.data
  if (!equipeDaPartida(partida, e.equipeId)) return { tipo: 'INVALIDO', status: 422, mensagem: 'A equipe não pertence a esta partida.' }
  const link = validarLinkVideo(e.linkVideo)
  if (!link.ok) return { tipo: 'INVALIDO', status: 400, mensagem: link.mensagem }
  const motivo = normalizarMotivo(e.motivo)
  const limite = opcoes.limite ?? limiteDesafiosPorSet()

  if (opcoes.pedidoBancoId) {
    const previo = await cliente.from('DesafioVideo').select('*').eq('partidaId', partida.id).eq('pedidoBancoId', opcoes.pedidoBancoId).maybeSingle()
    if (previo.error) return tabelaDesafioAusente(previo.error) ? indisponivel() : falha('Não foi possível registrar o desafio.')
    if (previo.data) return { tipo: 'OK', status: 200, desafio: desafioPublico(previo.data) }
  }

  const situacao = await situacaoDoLimite(cliente, partida.id, e.equipeId, e.setNumero, limite)
  if (situacao.tipo === 'INDISPONIVEL') return indisponivel()
  if (situacao.tipo === 'ERRO') return falha('Não foi possível registrar o desafio.')
  if (situacao.tipo === 'EXCEDIDO') {
    return { tipo: 'INVALIDO', status: 422, codigo: 'LIMITE_EXCEDIDO', mensagem: MENSAGEM_LIMITE_DESAFIOS(limite) }
  }

  const criado = await cliente
    .from('DesafioVideo')
    .insert({
      partidaId: partida.id,
      setNumero: e.setNumero,
      equipeId: e.equipeId,
      estado: opcoes.estado ?? 'SOLICITADO',
      motivo,
      linkVideo: link.valor,
      pedidoBancoId: opcoes.pedidoBancoId ?? null,
      solicitadoEm: new Date().toISOString(),
    })
    .select()
    .maybeSingle()
  if (criado.error) return tabelaDesafioAusente(criado.error) ? indisponivel() : falha('Não foi possível registrar o desafio.')
  if (!criado.data) return falha('Não foi possível registrar o desafio.')

  const depois = await doSet(cliente, partida.id, e.equipeId, e.setNumero)
  if (!depois.error && desafiosUsados((depois.data ?? []) as any[]) > limite) {
    await cliente
      .from('DesafioVideo')
      .update({ estado: 'CANCELADO', decididoEm: new Date().toISOString() })
      .eq('id', criado.data.id)
    return { tipo: 'INVALIDO', status: 422, codigo: 'LIMITE_EXCEDIDO', mensagem: MENSAGEM_LIMITE_DESAFIOS(limite) }
  }
  return { tipo: 'OK', status: 201, desafio: desafioPublico(criado.data) }
}

export async function listarDesafios(
  cliente: ClienteDesafio,
  partida: PartidaDesafio,
): Promise<{ tipo: 'OK'; desafios: Array<ReturnType<typeof desafioPublico>> } | { tipo: 'INDISPONIVEL'; mensagem: string } | { tipo: 'ERRO'; mensagem: string }> {
  const r = await cliente.from('DesafioVideo').select('*').eq('partidaId', partida.id).order('solicitadoEm', { ascending: true })
  if (r.error) {
    return tabelaDesafioAusente(r.error)
      ? { tipo: 'INDISPONIVEL', mensagem: MENSAGEM_DESAFIO_INDISPONIVEL }
      : { tipo: 'ERRO', mensagem: 'Não foi possível listar os desafios.' }
  }
  return { tipo: 'OK', desafios: ((r.data ?? []) as any[]).map(desafioPublico) }
}

export function idDeDesafio(valor: string): string | null {
  return /^[A-Za-z0-9_-]{1,64}$/.test(valor) ? valor : null
}

/** Decide um desafio aberto. Idempotente para a mesma decisão; decisão diferente de uma já tomada = 409. */
export async function decidirDesafio(
  cliente: ClienteDesafio,
  partida: PartidaDesafio,
  id: string,
  corpo: unknown,
  usuarioId: string | null,
): Promise<ResultadoDesafio> {
  const lido = decisaoDesafioSchema.safeParse(corpo)
  if (!lido.success) return { tipo: 'INVALIDO', status: 400, mensagem: 'Dados inválidos.', detalhes: lido.error.flatten().fieldErrors }
  const decisao: DecisaoDesafio = lido.data.decisao
  const chave = idDeDesafio(id)
  if (!chave) return { tipo: 'NAO_ENCONTRADO', mensagem: 'Desafio não encontrado.' }

  const atual = await cliente.from('DesafioVideo').select('*').eq('id', chave).eq('partidaId', partida.id).maybeSingle()
  if (atual.error) return tabelaDesafioAusente(atual.error) ? indisponivel() : falha('Não foi possível decidir o desafio.')
  if (!atual.data) return { tipo: 'NAO_ENCONTRADO', mensagem: 'Desafio não encontrado.' }

  const conflito: ResultadoDesafio = { tipo: 'CONFLITO', codigo: 'DESAFIO_JA_DECIDIDO', mensagem: 'Este desafio já foi decidido de outra forma.' }
  const acao = resolverDecisao(String(atual.data.estado), decisao)
  if (acao === 'IDEMPOTENTE') return { tipo: 'OK', status: 200, desafio: desafioPublico(atual.data) }
  if (acao === 'CONFLITO') return conflito

  const upd = await cliente
    .from('DesafioVideo')
    .update({ estado: decisao, decididoEm: new Date().toISOString(), decididoPor: usuarioId })
    .eq('id', atual.data.id)
    .in('estado', ['SOLICITADO', 'EM_ANALISE'])
    .select()
  if (upd.error) return falha('Não foi possível decidir o desafio.')
  const linha = Array.isArray(upd.data) && upd.data.length > 0 ? upd.data[0] : null
  if (linha) return { tipo: 'OK', status: 200, desafio: desafioPublico(linha) }

  // Outra requisição decidiu primeiro.
  const depois = await cliente.from('DesafioVideo').select('*').eq('id', atual.data.id).maybeSingle()
  if (depois.data && depois.data.estado === decisao) return { tipo: 'OK', status: 200, desafio: desafioPublico(depois.data) }
  return conflito
}

