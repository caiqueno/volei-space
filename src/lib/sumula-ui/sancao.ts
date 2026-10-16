/**
 * Sanções na tela: usa avaliarSancao (progressão por membro/equipe) e descreve o efeito
 * (ponto e saque ao adversário só nas penalidades). Módulo PURO.
 *
 * Itens [M]/NÃO CONFIRMADO do doc 23 (advertência verbal antes do amarelo, contagem por categoria,
 * combinação de categorias) NÃO bloqueiam: a tela explica o que o motor calculou e o árbitro decide.
 * Se o cartão calculado difere do que o árbitro tocou, a tela pede confirmação e oferece registrar
 * o cartão tocado como decisão do árbitro (override, ver ./override).
 */
import {
  avaliarSancao,
  registrarSancao,
  type CategoriaSancao,
  type Equipe,
  type PedidoSancao,
  type SancaoAvaliada,
  type SancaoRegistrada,
  type TipoSancao,
} from '@/lib/regras-volei'
import { caixaDeAviso, caixaDeBloqueio, type CaixaRegra } from './explicacao'
import { ehNaoConfirmado, justificativaValida, type DecisaoDoArbitro } from './override'

export const CATEGORIAS_DE_SANCAO: ReadonlyArray<{ id: CategoriaSancao; rotulo: string }> = [
  { id: 'ATRASO', rotulo: 'Atraso de jogo (equipe)' },
  { id: 'MENOR', rotulo: 'Conduta menor' },
  { id: 'GROSSEIRA', rotulo: 'Conduta grosseira' },
  { id: 'OFENSIVA', rotulo: 'Conduta ofensiva' },
  { id: 'AGRESSAO', rotulo: 'Agressão' },
]

/** Categoria padrão quando a nota livre só informa o tipo do cartão. */
export function categoriaPadraoDoTipo(tipo: string): CategoriaSancao | null {
  const t = tipo.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  if (t === 'cartao amarelo') return 'MENOR'
  if (t === 'cartao vermelho') return 'GROSSEIRA'
  if (t === 'atraso') return 'ATRASO'
  return null
}

export function ehNotaDeSancao(tipo: string): boolean {
  return categoriaPadraoDoTipo(tipo) != null
}

export function equipeDoMotor(lado: 'teamA' | 'teamB'): Equipe {
  return lado === 'teamA' ? 'A' : 'B'
}

/** Rótulo da nota gravada, conforme o que o motor decidiu (mantém "Cartão ..." para o servidor reconhecer). */
export function tipoDaNota(sancao: TipoSancao): string {
  switch (sancao) {
    case 'ADVERTENCIA_VERBAL': return 'Advertência verbal'
    case 'AMARELO': return 'Cartão amarelo'
    case 'ADVERTENCIA_ATRASO':
    case 'PENALIDADE_ATRASO': return 'Atraso'
    default: return 'Cartão vermelho'
  }
}

/** O cartão que o motor calculou difere do que o árbitro tocou. */
export type DivergenciaDoCartao = {
  tocado: string
  calculado: string
  rotuloCalculado: string
  codigo: string
  naoConfirmado: boolean
}

export type CartaoAvaliado =
  | {
    ok: true
    avaliada: SancaoAvaliada
    registro: SancaoRegistrada
    avisos: CaixaRegra[]
    divergencia: DivergenciaDoCartao | null
    /** A regra aplicada é [M]/NÃO CONFIRMADA: a tela explica, nunca impõe. */
    naoConfirmado: boolean
  }
  | { ok: false; caixa: CaixaRegra }

const CARTOES_TOCAVEIS = new Set(['Cartão amarelo', 'Cartão vermelho'])

export function divergenciaDoCartao(tipoTocado: string | undefined, avaliada: SancaoAvaliada): DivergenciaDoCartao | null {
  if (!tipoTocado || !CARTOES_TOCAVEIS.has(tipoTocado)) return null
  const calculado = tipoDaNota(avaliada.sancao)
  if (calculado === tipoTocado) return null
  return {
    tocado: tipoTocado,
    calculado,
    rotuloCalculado: rotuloDaSancao(avaliada.sancao),
    codigo: avaliada.codigo,
    naoConfirmado: ehNaoConfirmado(avaliada.codigo),
  }
}

export function avaliarCartao(historico: readonly SancaoRegistrada[], pedido: PedidoSancao, tipoTocado?: string): CartaoAvaliado {
  const avaliada = avaliarSancao(historico, pedido)
  if (!avaliada.ok) return { ok: false, caixa: caixaDeBloqueio(avaliada.codigo, avaliada.mensagem) }
  return {
    ok: true,
    avaliada,
    registro: registrarSancao(pedido, avaliada),
    avisos: avaliada.avisos.map(caixaDeAviso),
    divergencia: divergenciaDoCartao(tipoTocado, avaliada),
    naoConfirmado: ehNaoConfirmado(avaliada.codigo),
  }
}

/** Sanção que corresponde ao cartão tocado pelo árbitro (usada só no override). */
export function sancaoDoCartaoTocado(tipo: string): TipoSancao | null {
  if (tipo === 'Cartão amarelo') return 'AMARELO'
  if (tipo === 'Cartão vermelho') return 'PENALIDADE'
  if (tipo === 'Atraso') return 'ADVERTENCIA_ATRASO'
  return null
}

/**
 * Cartão registrado por decisão do árbitro: vale o que ele tocou, sem a progressão do motor.
 * Devolve o mesmo formato de avaliarCartao para a tela seguir o fluxo normal (ponto, marcador).
 * O código é o da regra que o motor aplicou ou que bloqueou; vai no marcador de override.
 */
export function cartaoPorDecisaoDoArbitro(
  tipoTocado: string,
  pedido: PedidoSancao,
  codigo: string,
): { avaliada: SancaoAvaliada; registro: SancaoRegistrada } | null {
  const sancao = sancaoDoCartaoTocado(tipoTocado)
  if (!sancao) return null
  const penalidade = sancao === 'PENALIDADE' || sancao === 'PENALIDADE_ATRASO'
  const avaliada = {
    ok: true,
    sancao,
    categoria: pedido.categoria,
    codigo,
    pontoParaAdversario: penalidade,
    saqueParaAdversario: penalidade,
    afastamento: 'NENHUM',
    exigeSubstituicaoSeEmQuadra: false,
    assistenteAssume: false,
    setDeAplicacao: pedido.entreSets ? pedido.set + 1 : pedido.set,
    colunaQuadro: sancao === 'PENALIDADE' ? 'P' : 'A',
    mensagem: 'Registrado por decisão do árbitro.',
    avisos: [],
  } as unknown as SancaoAvaliada
  return { avaliada, registro: registrarSancao(pedido, avaliada) }
}

export type EscolhaDoCartao =
  | { ok: true; avaliada: SancaoAvaliada; registro: SancaoRegistrada; avisos: CaixaRegra[]; decisao: DecisaoDoArbitro | null }
  | {
    ok: false
    caixa: CaixaRegra
    /** Divergência: o árbitro ainda pode aceitar o cartão que o motor calculou. */
    calculado: string | null
  }

/**
 * Decide o que gravar para o cartão pedido. O cartão tocado pelo árbitro NUNCA é trocado em
 * silêncio: se o motor calculou outro, nada é gravado até o árbitro escolher (aceitar o calculado
 * ou registrar o tocado como decisão dele, com justificativa). Bloqueio do motor idem: só passa
 * com decisão do árbitro justificada.
 */
export function resolverCartao(
  historico: readonly SancaoRegistrada[],
  pedido: PedidoSancao,
  tipoTocado: string,
  opcoes: { decisao?: DecisaoDoArbitro | null; aceitaCalculado?: boolean } = {},
): EscolhaDoCartao {
  const decisaoValida = opcoes.decisao && justificativaValida(opcoes.decisao.justificativa) ? opcoes.decisao : null
  const motor = avaliarCartao(historico, pedido, tipoTocado)
  if (!motor.ok) {
    const doArbitro = decisaoValida ? cartaoPorDecisaoDoArbitro(tipoTocado, pedido, motor.caixa.codigo) : null
    if (doArbitro && decisaoValida) return { ok: true, ...doArbitro, avisos: [], decisao: { codigo: motor.caixa.codigo, justificativa: decisaoValida.justificativa } }
    return { ok: false, caixa: motor.caixa, calculado: null }
  }
  if (motor.divergencia && !opcoes.aceitaCalculado) {
    const dv = motor.divergencia
    const doArbitro = decisaoValida ? cartaoPorDecisaoDoArbitro(tipoTocado, pedido, dv.codigo) : null
    if (doArbitro && decisaoValida) return { ok: true, ...doArbitro, avisos: [], decisao: { codigo: dv.codigo, justificativa: decisaoValida.justificativa } }
    return {
      ok: false,
      calculado: dv.rotuloCalculado,
      caixa: {
        tipo: 'bloqueio',
        codigo: dv.codigo,
        mensagem: `Você tocou "${dv.tocado}", mas pelo motor este lançamento seria ${dv.rotuloCalculado}${dv.naoConfirmado ? ' (regra ainda não confirmada)' : ''}. Nada foi registrado.`,
        acao: `Registre ${dv.rotuloCalculado}, ou registre ${dv.tocado} como decisão do árbitro, com justificativa.`,
      },
    }
  }
  return { ok: true, avaliada: motor.avaliada, registro: motor.registro, avisos: motor.avisos, decisao: null }
}

const ROTULO_SANCAO: Record<TipoSancao, string> = {
  ADVERTENCIA_VERBAL: 'Advertência verbal',
  AMARELO: 'Cartão amarelo',
  PENALIDADE: 'Penalidade',
  EXPULSAO: 'Expulsão',
  DESQUALIFICACAO: 'Desqualificação',
  ADVERTENCIA_ATRASO: 'Advertência por atraso',
  PENALIDADE_ATRASO: 'Penalidade por atraso',
}

export function rotuloDaSancao(sancao: TipoSancao): string {
  return ROTULO_SANCAO[sancao]
}

/** Frase para a prévia do modal e para o registro: sanção, código e efeito no placar/saque. */
export function descreverEfeito(avaliada: SancaoAvaliada, nomeAdversario: string): string {
  const base = `${rotuloDaSancao(avaliada.sancao)} (${avaliada.codigo}). `
  if (avaliada.pontoParaAdversario) return `${base}Ponto e saque para ${nomeAdversario}.`
  if (avaliada.afastamento === 'SET') return `${base}Sai pelo resto do set, sem ponto; se estiver em quadra, substitua de imediato.`
  if (avaliada.afastamento === 'PARTIDA') return `${base}Sai pela partida toda, sem ponto; se estiver em quadra, substitua de imediato.`
  return `${base}Sem ponto nem troca de saque.`
}
