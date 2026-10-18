/**
 * Scout manual (R11): registro, listagem e anulação de ações na tabela "ScoutAcao".
 * O cliente do banco entra por parâmetro (o teste usa um banco falso). Nunca guarda nome de jogador (LGPD).
 * Idempotência: (partidaId, clientEventId) é único; repetir o envio devolve a mesma ação.
 * Ver docs/analise/26-scout.md.
 */
import { z } from 'zod'
import { FUNDAMENTOS, RESULTADOS, validarAcao, type AcaoScout, type EquipeScout } from './modelo'
import type { EstadoDoSetNoMomento } from './derivacao'

export const MENSAGEM_RECURSO_INDISPONIVEL = 'Recurso ainda não habilitado neste ambiente.'

export interface ClienteDb {
  from(tabela: string): any
}

type ErroDb = { code?: string; message?: string; details?: string | null } | null | undefined

/** Tabela "ScoutAcao" ainda não existe (migration pendente). */
export function tabelaScoutAusente(erro: ErroDb): boolean {
  if (!erro) return false
  const texto = `${erro.message ?? ''} ${erro.details ?? ''}`
  return (
    erro.code === '42P01' ||
    erro.code === 'PGRST205' ||
    (/ScoutAcao/.test(texto) && /does not exist|schema cache|Could not find the table/i.test(texto))
  )
}

const inteiro = (min: number, max: number) => z.number().int().min(min).max(max)

export const acaoEntradaSchema = z.object({
  clientEventId: z.string().trim().min(1).max(100).regex(/^[A-Za-z0-9_.:-]+$/, 'clientEventId com caracteres inválidos.'),
  setNumero: inteiro(1, 5),
  equipeId: inteiro(1, Number.MAX_SAFE_INTEGER),
  jogadorId: inteiro(1, Number.MAX_SAFE_INTEGER).nullish(),
  fundamento: z.enum(FUNDAMENTOS),
  resultado: z.enum(RESULTADOS),
  zonaOrigem: inteiro(1, 9).nullish(),
  zonaDestino: inteiro(1, 9).nullish(),
  rotacao: inteiro(1, 6).nullish(),
  placarA: inteiro(0, 999).nullish(),
  placarB: inteiro(0, 999).nullish(),
})
export type AcaoEntrada = z.infer<typeof acaoEntradaSchema>

/** Corrige uma ação não anulada: só fundamento, resultado, zonas e jogador. Pelo menos um campo. */
export const acaoCorrecaoSchema = z
  .object({
    jogadorId: inteiro(1, Number.MAX_SAFE_INTEGER).nullable().optional(),
    fundamento: z.enum(FUNDAMENTOS).optional(),
    resultado: z.enum(RESULTADOS).optional(),
    zonaOrigem: inteiro(1, 9).nullable().optional(),
    zonaDestino: inteiro(1, 9).nullable().optional(),
  })
  .strict()
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: 'Informe ao menos um campo para corrigir.' })
export type AcaoCorrecao = z.infer<typeof acaoCorrecaoSchema>

/** Placar e rotação do set derivados do log no momento do lançamento (null = sem log ou set ainda não iniciado). */
export type DerivadorDeEstado = (setNumero: number) => Promise<EstadoDoSetNoMomento | null>

export type PartidaScout = { id: number; equipeAId: number | null; equipeBId: number | null }

export function equipeDaAcao(partida: PartidaScout, equipeId: number): EquipeScout | null {
  if (partida.equipeAId != null && Number(partida.equipeAId) === equipeId) return 'A'
  if (partida.equipeBId != null && Number(partida.equipeBId) === equipeId) return 'B'
  return null
}

/** Linha de "ScoutAcao" -> AcaoScout do módulo (null quando a equipe não pertence à partida). */
export function linhaParaAcao(linha: any, partida: PartidaScout): AcaoScout | null {
  const equipe = equipeDaAcao(partida, Number(linha.equipeId))
  if (!equipe) return null
  const num = (v: unknown) => (v == null ? null : Number(v))
  return {
    id: Number(linha.id),
    set: Number(linha.setNumero),
    // Sem placar informado no lançamento, 0 (o campo é "placar antes"; a ausência fica documentada).
    pontoA: num(linha.placarA) ?? 0,
    pontoB: num(linha.placarB) ?? 0,
    equipe,
    jogadorId: num(linha.jogadorId),
    fundamento: linha.fundamento,
    resultado: linha.resultado,
    rotacao: num(linha.rotacao),
    posicao: null,
    zonaOrigem: num(linha.zonaOrigem) as AcaoScout['zonaOrigem'],
    zonaDestino: num(linha.zonaDestino) as AcaoScout['zonaDestino'],
    origem: 'MANUAL',
    criadoEm: linha.criadoEm ?? null,
  }
}

/** Forma pública da ação (sem PII). */
export function acaoPublica(linha: any, partida: PartidaScout) {
  return {
    id: Number(linha.id),
    setNumero: Number(linha.setNumero),
    equipeId: Number(linha.equipeId),
    equipe: equipeDaAcao(partida, Number(linha.equipeId)),
    jogadorId: linha.jogadorId ?? null,
    fundamento: linha.fundamento,
    resultado: linha.resultado,
    zonaOrigem: linha.zonaOrigem ?? null,
    zonaDestino: linha.zonaDestino ?? null,
    rotacao: linha.rotacao ?? null,
    placarA: linha.placarA ?? null,
    placarB: linha.placarB ?? null,
    clientEventId: linha.clientEventId,
    criadoEm: linha.criadoEm ?? null,
    anuladoEm: linha.anuladoEm ?? null,
  }
}

export type ResultadoRegistroAcao =
  | { tipo: 'OK'; status: 200 | 201; acao: ReturnType<typeof acaoPublica> }
  | { tipo: 'INVALIDO'; status: 400 | 422; mensagem: string; detalhes?: unknown }
  | { tipo: 'NAO_ENCONTRADO'; mensagem: string }
  | { tipo: 'INDISPONIVEL'; mensagem: string }
  | { tipo: 'ERRO'; mensagem: string }

const indisponivel = (): ResultadoRegistroAcao => ({ tipo: 'INDISPONIVEL', mensagem: MENSAGEM_RECURSO_INDISPONIVEL })
const erroGenerico = (mensagem: string): ResultadoRegistroAcao => ({ tipo: 'ERRO', mensagem })

async function acaoPorClientEventId(cliente: ClienteDb, partidaId: number, clientEventId: string) {
  return cliente.from('ScoutAcao').select('*').eq('partidaId', partidaId).eq('clientEventId', clientEventId).maybeSingle()
}

export async function registrarAcao(
  cliente: ClienteDb,
  partida: PartidaScout,
  corpo: unknown,
  criadoPor: string | null,
  derivar?: DerivadorDeEstado,
): Promise<ResultadoRegistroAcao> {
  const lido = acaoEntradaSchema.safeParse(corpo)
  if (!lido.success) {
    return { tipo: 'INVALIDO', status: 400, mensagem: 'Dados inválidos.', detalhes: lido.error.flatten().fieldErrors }
  }
  const e = lido.data
  const equipe = equipeDaAcao(partida, e.equipeId)
  if (!equipe) return { tipo: 'INVALIDO', status: 422, mensagem: 'A equipe não pertence a esta partida.' }

  // Mesma validação de domínio do módulo (id fictício, só para satisfazer o contrato).
  const problemas = validarAcao({
    id: 1, set: e.setNumero, pontoA: e.placarA ?? 0, pontoB: e.placarB ?? 0, equipe,
    jogadorId: e.jogadorId ?? null, fundamento: e.fundamento, resultado: e.resultado,
    rotacao: e.rotacao ?? null, posicao: null,
    zonaOrigem: (e.zonaOrigem ?? null) as AcaoScout['zonaOrigem'], zonaDestino: (e.zonaDestino ?? null) as AcaoScout['zonaDestino'],
    origem: 'MANUAL',
  })
  if (problemas.length > 0) return { tipo: 'INVALIDO', status: 400, mensagem: 'Dados inválidos.', detalhes: problemas }

  // Idempotência: repetir devolve a mesma ação.
  const previa = await acaoPorClientEventId(cliente, partida.id, e.clientEventId)
  if (previa.error) return tabelaScoutAusente(previa.error) ? indisponivel() : erroGenerico('Não foi possível registrar a ação.')
  if (previa.data) return { tipo: 'OK', status: 200, acao: acaoPublica(previa.data, partida) }

  if (e.jogadorId != null) {
    const jog = await cliente.from('Jogador').select('id,equipeId,banido').eq('id', e.jogadorId).maybeSingle()
    if (jog.error) return erroGenerico('Não foi possível registrar a ação.')
    if (!jog.data || Number(jog.data.equipeId) !== e.equipeId) {
      return { tipo: 'INVALIDO', status: 422, mensagem: 'O jogador não pertence à equipe informada.' }
    }
  }

  // Placar e rotação ausentes são preenchidos pelo estado do set derivado do log no momento (se houver log).
  let placarA = e.placarA ?? null
  let placarB = e.placarB ?? null
  let rotacao = e.rotacao ?? null
  if (derivar && (placarA == null || placarB == null || rotacao == null)) {
    try {
      const estado = await derivar(e.setNumero)
      if (estado) {
        placarA = placarA ?? estado.placarA
        placarB = placarB ?? estado.placarB
        rotacao = rotacao ?? (equipe === 'A' ? estado.rotacaoA : estado.rotacaoB)
      }
    } catch {
      // Sem log legível: a ação segue sem placar/rotação, como antes.
    }
  }

  const criada = await cliente
    .from('ScoutAcao')
    .insert({
      partidaId: partida.id,
      setNumero: e.setNumero,
      equipeId: e.equipeId,
      jogadorId: e.jogadorId ?? null,
      fundamento: e.fundamento,
      resultado: e.resultado,
      zonaOrigem: e.zonaOrigem ?? null,
      zonaDestino: e.zonaDestino ?? null,
      rotacao,
      placarA,
      placarB,
      clientEventId: e.clientEventId,
      criadoPor,
    })
    .select()
    .maybeSingle()
  if (criada.error) {
    if (tabelaScoutAusente(criada.error)) return indisponivel()
    if (criada.error.code === '23505') {
      // Corrida com o mesmo clientEventId: devolve a ação que ganhou.
      const vencedora = await acaoPorClientEventId(cliente, partida.id, e.clientEventId)
      if (vencedora.data) return { tipo: 'OK', status: 200, acao: acaoPublica(vencedora.data, partida) }
    }
    return erroGenerico('Não foi possível registrar a ação.')
  }
  if (!criada.data) return erroGenerico('Não foi possível registrar a ação.')
  return { tipo: 'OK', status: 201, acao: acaoPublica(criada.data, partida) }
}

export type ResultadoListagem =
  | { tipo: 'OK'; acoes: Array<ReturnType<typeof acaoPublica>> }
  | { tipo: 'INVALIDO'; mensagem: string }
  | { tipo: 'INDISPONIVEL'; mensagem: string }
  | { tipo: 'ERRO'; mensagem: string }

/** Ações não anuladas da partida, na ordem de lançamento; `set` opcional filtra por set. */
export async function listarAcoes(cliente: ClienteDb, partida: PartidaScout, set?: string | null): Promise<ResultadoListagem> {
  let setNumero: number | null = null
  if (set != null && set !== '') {
    if (!/^\d+$/.test(set) || Number(set) < 1 || Number(set) > 5) return { tipo: 'INVALIDO', mensagem: 'set deve estar entre 1 e 5.' }
    setNumero = Number(set)
  }
  let q = cliente.from('ScoutAcao').select('*').eq('partidaId', partida.id).is('anuladoEm', null)
  if (setNumero != null) q = q.eq('setNumero', setNumero)
  const r = await q.order('id', { ascending: true })
  if (r.error) {
    return tabelaScoutAusente(r.error)
      ? { tipo: 'INDISPONIVEL', mensagem: MENSAGEM_RECURSO_INDISPONIVEL }
      : { tipo: 'ERRO', mensagem: 'Não foi possível listar as ações.' }
  }
  return { tipo: 'OK', acoes: ((r.data ?? []) as any[]).map((l) => acaoPublica(l, partida)) }
}

/** Anula (soft delete) uma ação da partida. Idempotente: anular de novo devolve 200. */
export async function anularAcao(cliente: ClienteDb, partida: PartidaScout, id: string): Promise<ResultadoRegistroAcao> {
  if (!/^\d{1,15}$/.test(id)) return { tipo: 'NAO_ENCONTRADO', mensagem: 'Ação não encontrada.' }
  const numero = Number(id)
  const atual = await cliente.from('ScoutAcao').select('*').eq('id', numero).eq('partidaId', partida.id).maybeSingle()
  if (atual.error) return tabelaScoutAusente(atual.error) ? indisponivel() : erroGenerico('Não foi possível anular a ação.')
  if (!atual.data) return { tipo: 'NAO_ENCONTRADO', mensagem: 'Ação não encontrada.' }
  if (atual.data.anuladoEm) return { tipo: 'OK', status: 200, acao: acaoPublica(atual.data, partida) }

  const upd = await cliente
    .from('ScoutAcao')
    .update({ anuladoEm: new Date().toISOString() })
    .eq('id', numero)
    .eq('partidaId', partida.id)
    .is('anuladoEm', null)
    .select()
  if (upd.error) return erroGenerico('Não foi possível anular a ação.')
  const linha = Array.isArray(upd.data) && upd.data.length > 0 ? upd.data[0] : null
  if (linha) return { tipo: 'OK', status: 200, acao: acaoPublica(linha, partida) }
  // Outra requisição anulou primeiro: relê.
  const depois = await cliente.from('ScoutAcao').select('*').eq('id', numero).eq('partidaId', partida.id).maybeSingle()
  return depois.data ? { tipo: 'OK', status: 200, acao: acaoPublica(depois.data, partida) } : erroGenerico('Não foi possível anular a ação.')
}

export type ResultadoCorrecaoAcao = ResultadoRegistroAcao | { tipo: 'CONFLITO'; mensagem: string; codigo: string }

/**
 * Corrige fundamento, resultado, zonas ou jogador de uma ação NÃO anulada da partida. Reaplica a validação de
 * domínio sobre a ação já corrigida. Idempotente: repetir a mesma correção (ou corrigir para o valor atual) devolve 200
 * sem gravar de novo. Ação anulada = 409.
 */
export async function corrigirAcao(cliente: ClienteDb, partida: PartidaScout, id: string, corpo: unknown): Promise<ResultadoCorrecaoAcao> {
  if (!/^\d{1,15}$/.test(id)) return { tipo: 'NAO_ENCONTRADO', mensagem: 'Ação não encontrada.' }
  const lido = acaoCorrecaoSchema.safeParse(corpo)
  if (!lido.success) {
    return { tipo: 'INVALIDO', status: 400, mensagem: 'Dados inválidos.', detalhes: lido.error.flatten() }
  }
  const mudancas = lido.data
  const numero = Number(id)
  const erroLeitura = () => erroGenerico('Não foi possível corrigir a ação.')
  const anulada = (): ResultadoCorrecaoAcao => ({ tipo: 'CONFLITO', codigo: 'ACAO_ANULADA', mensagem: 'A ação foi anulada e não pode mais ser corrigida.' })

  const atual = await cliente.from('ScoutAcao').select('*').eq('id', numero).eq('partidaId', partida.id).maybeSingle()
  if (atual.error) return tabelaScoutAusente(atual.error) ? indisponivel() : erroLeitura()
  if (!atual.data) return { tipo: 'NAO_ENCONTRADO', mensagem: 'Ação não encontrada.' }
  if (atual.data.anuladoEm) return anulada()

  const linha = atual.data
  const equipe = equipeDaAcao(partida, Number(linha.equipeId))
  if (!equipe) return { tipo: 'NAO_ENCONTRADO', mensagem: 'Ação não encontrada.' }

  const alvo = {
    jogadorId: mudancas.jogadorId !== undefined ? mudancas.jogadorId : (linha.jogadorId ?? null),
    fundamento: mudancas.fundamento ?? linha.fundamento,
    resultado: mudancas.resultado ?? linha.resultado,
    zonaOrigem: mudancas.zonaOrigem !== undefined ? mudancas.zonaOrigem : (linha.zonaOrigem ?? null),
    zonaDestino: mudancas.zonaDestino !== undefined ? mudancas.zonaDestino : (linha.zonaDestino ?? null),
  }
  const problemas = validarAcao({
    id: numero, set: Number(linha.setNumero), pontoA: Number(linha.placarA ?? 0), pontoB: Number(linha.placarB ?? 0), equipe,
    jogadorId: alvo.jogadorId, fundamento: alvo.fundamento, resultado: alvo.resultado,
    rotacao: linha.rotacao ?? null, posicao: null,
    zonaOrigem: alvo.zonaOrigem as AcaoScout['zonaOrigem'], zonaDestino: alvo.zonaDestino as AcaoScout['zonaDestino'],
    origem: 'MANUAL',
  })
  if (problemas.length > 0) return { tipo: 'INVALIDO', status: 400, mensagem: 'Dados inválidos.', detalhes: problemas }

  const campos = ['jogadorId', 'fundamento', 'resultado', 'zonaOrigem', 'zonaDestino'] as const
  const mudou = campos.filter((c) => (linha[c] ?? null) !== alvo[c])
  if (mudou.length === 0) return { tipo: 'OK', status: 200, acao: acaoPublica(linha, partida) }

  if (mudou.includes('jogadorId') && alvo.jogadorId != null) {
    const jog = await cliente.from('Jogador').select('id,equipeId').eq('id', alvo.jogadorId).maybeSingle()
    if (jog.error) return erroLeitura()
    if (!jog.data || Number(jog.data.equipeId) !== Number(linha.equipeId)) {
      return { tipo: 'INVALIDO', status: 422, mensagem: 'O jogador não pertence à equipe da ação.' }
    }
  }

  const gravar: Record<string, unknown> = {}
  for (const c of mudou) gravar[c] = alvo[c]
  const upd = await cliente.from('ScoutAcao').update(gravar).eq('id', numero).eq('partidaId', partida.id).is('anuladoEm', null).select()
  if (upd.error) return tabelaScoutAusente(upd.error) ? indisponivel() : erroLeitura()
  const nova = Array.isArray(upd.data) && upd.data.length > 0 ? upd.data[0] : null
  if (nova) return { tipo: 'OK', status: 200, acao: acaoPublica(nova, partida) }

  // Ninguém atualizado: foi anulada no meio, ou outra correção igual chegou antes.
  const depois = await cliente.from('ScoutAcao').select('*').eq('id', numero).eq('partidaId', partida.id).maybeSingle()
  if (!depois.data) return erroLeitura()
  return depois.data.anuladoEm ? anulada() : { tipo: 'OK', status: 200, acao: acaoPublica(depois.data, partida) }
}

/**
 * Ações para o resumo/exportação. Tabela ausente = lista vazia (o resumo derivado segue funcionando).
 * Falha de leitura propaga como `ok: false`.
 */
export async function carregarAcoesScout(
  cliente: ClienteDb,
  partida: PartidaScout,
): Promise<{ ok: true; acoes: AcaoScout[] } | { ok: false; mensagem: string }> {
  const r = await cliente.from('ScoutAcao').select('*').eq('partidaId', partida.id).is('anuladoEm', null).order('id', { ascending: true })
  if (r.error) {
    if (tabelaScoutAusente(r.error)) return { ok: true, acoes: [] }
    return { ok: false, mensagem: 'Não foi possível ler as ações do scout.' }
  }
  const acoes: AcaoScout[] = []
  for (const l of (r.data ?? []) as any[]) {
    const a = linhaParaAcao(l, partida)
    if (a) acoes.push(a)
  }
  return { ok: true, acoes }
}
