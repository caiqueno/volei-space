/**
 * Sanções na tela: usa avaliarSancao (progressão por membro/equipe) e descreve o efeito
 * (ponto e saque ao adversário só nas penalidades). Módulo PURO.
 *
 * Itens [M]/NÃO CONFIRMADO do doc 23 (combinação de categorias, amarelo da equipe) NÃO bloqueiam:
 * a tela só explica o que o motor calculou.
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

export type CartaoAvaliado =
  | { ok: true; avaliada: SancaoAvaliada; registro: SancaoRegistrada; avisos: CaixaRegra[] }
  | { ok: false; caixa: CaixaRegra }

export function avaliarCartao(historico: readonly SancaoRegistrada[], pedido: PedidoSancao): CartaoAvaliado {
  const avaliada = avaliarSancao(historico, pedido)
  if (!avaliada.ok) return { ok: false, caixa: caixaDeBloqueio(avaliada.codigo, avaliada.mensagem) }
  return {
    ok: true,
    avaliada,
    registro: registrarSancao(pedido, avaliada),
    avisos: avaliada.avisos.map(caixaDeAviso),
  }
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
