/**
 * Sanções progressivas e atraso (CJ-04). RG-SAN-001..012, RG-TMP-007/008.
 * Sanção = f(categoria, ocorrências anteriores do membro na PARTIDA); atraso é da EQUIPE.
 *
 * TODO [M]: combinação de categorias diferentes no mesmo membro e quem saca em 0x0 após
 * penalidade entre sets estão em CONFIG_ITENS_M e NÃO têm teste automatizado.
 */
import { CONFIG_ITENS_M } from './config'
import type { EstadoEquipe } from './estado-equipe'
import { aviso, bloqueio, outraEquipe, type AvisoRegra, type CodigoRegra, type Equipe, type ResultadoRegra } from './tipos'

export type CategoriaConduta = 'MENOR' | 'GROSSEIRA' | 'OFENSIVA' | 'AGRESSAO'
export type CategoriaSancao = CategoriaConduta | 'ATRASO'

export type TipoSancao =
  | 'ADVERTENCIA_VERBAL'
  | 'AMARELO'
  | 'PENALIDADE'
  | 'EXPULSAO'
  | 'DESQUALIFICACAO'
  | 'ADVERTENCIA_ATRASO'
  | 'PENALIDADE_ATRASO'

/** Identificação do membro: 'J:7' (jogador 7), 'TECNICO', 'ASSISTENTE', 'MEDICO'... */
export type MembroEquipe = string

export interface SancaoRegistrada {
  equipe: Equipe
  membro: MembroEquipe
  categoria: CategoriaSancao
  sancao: TipoSancao
  /** Set em que a sanção VALE (já considera sanção entre sets = set seguinte). */
  set: number
}

export interface PedidoSancao {
  equipe: Equipe
  membro: MembroEquipe
  categoria: CategoriaSancao
  /** Set corrente (ou o set que acabou, se `entreSets`). */
  set: number
  /** RG-SAN-010: conduta antes/entre sets vale no set seguinte. */
  entreSets?: boolean
}

export interface SancaoAvaliada {
  ok: true
  sancao: TipoSancao
  categoria: CategoriaSancao
  codigo: CodigoRegra
  /** Penalidade: ponto ao adversário (e saque). Só penalidade e penalidade de atraso. */
  pontoParaAdversario: boolean
  saqueParaAdversario: boolean
  afastamento: 'NENHUM' | 'SET' | 'PARTIDA'
  /** Jogador em quadra expulso/desqualificado precisa ser substituído de imediato (RG-SUB-012). */
  exigeSubstituicaoSeEmQuadra: boolean
  /** Técnico expulso: o assistente assume (RG-SAN-007). */
  assistenteAssume: boolean
  setDeAplicacao: number
  /** Linha do quadro de sanções (coluna A/P/E/D). */
  colunaQuadro: 'A' | 'P' | 'E' | 'D' | null
  mensagem: string
  avisos: AvisoRegra[]
}

export type ResultadoSancao = SancaoAvaliada | { ok: false; codigo: CodigoRegra; mensagem: string }

export function chaveJogador(jogadorId: number): MembroEquipe {
  return `J:${jogadorId}`
}

function contarAnteriores(historico: readonly SancaoRegistrada[], p: PedidoSancao, categoria: CategoriaSancao): number {
  if (categoria === 'ATRASO') {
    return historico.filter((s) => s.equipe === p.equipe && s.categoria === 'ATRASO').length
  }
  return historico.filter((s) => s.equipe === p.equipe && s.membro === p.membro && s.categoria === categoria).length
}

/** Membro impedido de receber nova sanção/atuar: desqualificado na partida ou expulso no set. */
export function membroImpedido(
  historico: readonly SancaoRegistrada[],
  equipe: Equipe,
  membro: MembroEquipe,
  set: number,
): 'DESQUALIFICADO' | 'EXPULSO_NO_SET' | null {
  const meus = historico.filter((s) => s.equipe === equipe && s.membro === membro)
  if (meus.some((s) => s.sancao === 'DESQUALIFICACAO')) return 'DESQUALIFICADO'
  if (meus.some((s) => s.sancao === 'EXPULSAO' && s.set === set)) return 'EXPULSO_NO_SET'
  return null
}

const COLUNA: Record<TipoSancao, SancaoAvaliada['colunaQuadro']> = {
  ADVERTENCIA_VERBAL: null,
  AMARELO: 'A',
  PENALIDADE: 'P',
  EXPULSAO: 'E',
  DESQUALIFICACAO: 'D',
  ADVERTENCIA_ATRASO: 'A',
  PENALIDADE_ATRASO: 'P',
}

export function avaliarSancao(historico: readonly SancaoRegistrada[], pedido: PedidoSancao): ResultadoSancao {
  void CONFIG_ITENS_M.sancaoCombinacaoCategorias // contagem POR_CATEGORIA [M]
  const setDeAplicacao = pedido.entreSets ? pedido.set + 1 : pedido.set
  const avisos: AvisoRegra[] = []

  if (pedido.categoria !== 'ATRASO') {
    const impedido = membroImpedido(historico, pedido.equipe, pedido.membro, setDeAplicacao)
    if (impedido === 'DESQUALIFICADO') {
      return bloqueio('RG-SAN-008', 'Este membro já foi desqualificado e não participa mais da partida; não recebe nova sanção.')
    }
    if (impedido === 'EXPULSO_NO_SET') {
      return bloqueio('RG-SAN-007', 'Este membro já foi expulso neste set e está no vestiário até o fim do set.')
    }
  }

  const n = contarAnteriores(historico, pedido, pedido.categoria)
  let sancao: TipoSancao
  let codigo: CodigoRegra

  switch (pedido.categoria) {
    case 'ATRASO':
      // RG-TMP-007/008: 1º atraso da equipe na partida = advertência; os seguintes = penalidade.
      sancao = n === 0 ? 'ADVERTENCIA_ATRASO' : 'PENALIDADE_ATRASO'
      codigo = n === 0 ? 'RG-TMP-007' : 'RG-TMP-008'
      break
    case 'MENOR':
      sancao = n === 0 ? 'ADVERTENCIA_VERBAL' : 'AMARELO' // RG-SAN-001: sem consequência imediata
      codigo = 'RG-SAN-001'
      break
    case 'GROSSEIRA':
      if (n === 0) {
        sancao = 'PENALIDADE'
        codigo = 'RG-SAN-002'
      } else if (n === 1) {
        sancao = 'EXPULSAO'
        codigo = 'RG-SAN-003'
      } else {
        sancao = 'DESQUALIFICACAO'
        codigo = 'RG-SAN-004'
      }
      break
    case 'OFENSIVA':
      sancao = n === 0 ? 'EXPULSAO' : 'DESQUALIFICACAO'
      codigo = 'RG-SAN-005'
      break
    case 'AGRESSAO':
      sancao = 'DESQUALIFICACAO'
      codigo = 'RG-SAN-006'
      break
  }

  const penalidade = sancao === 'PENALIDADE' || sancao === 'PENALIDADE_ATRASO'
  const afastamento = sancao === 'EXPULSAO' ? 'SET' : sancao === 'DESQUALIFICACAO' ? 'PARTIDA' : 'NENHUM'
  const ehTecnico = pedido.membro === 'TECNICO'
  if (pedido.entreSets) {
    avisos.push(
      aviso(
        'RG-SAN-010',
        `Sanção aplicada entre sets: vale no ${setDeAplicacao}º set (a penalidade em ponto é lançada no 0x0 do set seguinte). Quem saca em 0x0 depende do regulamento [M].`,
      ),
    )
  }

  const adversario = outraEquipe(pedido.equipe)
  const textos: Record<TipoSancao, string> = {
    ADVERTENCIA_VERBAL: 'Advertência verbal (1º estágio): sem sanção registrada.',
    AMARELO: 'Cartão amarelo: sem consequência imediata, vale para a partida.',
    PENALIDADE: `Penalidade (cartão vermelho): ponto e saque para a equipe ${adversario}.`,
    EXPULSAO: 'Expulsão: o membro sai pelo resto do set, sem ponto; jogador em quadra é substituído de imediato.',
    DESQUALIFICACAO: 'Desqualificação: o membro sai pelo resto da partida; jogador em quadra é substituído de imediato.',
    ADVERTENCIA_ATRASO: 'Advertência por atraso: vale para a partida toda; novo atraso da equipe é penalidade.',
    PENALIDADE_ATRASO: `Penalidade por atraso (equipe já advertida): ponto e saque para a equipe ${adversario}.`,
  }

  return {
    ok: true,
    sancao,
    categoria: pedido.categoria,
    codigo,
    pontoParaAdversario: penalidade,
    saqueParaAdversario: penalidade,
    afastamento,
    exigeSubstituicaoSeEmQuadra: afastamento !== 'NENHUM' && !ehTecnico,
    assistenteAssume: afastamento !== 'NENHUM' && ehTecnico,
    setDeAplicacao,
    colunaQuadro: COLUNA[sancao],
    mensagem: textos[sancao],
    avisos,
  }
}

/** Converte a sanção avaliada em registro para o histórico. */
export function registrarSancao(pedido: PedidoSancao, avaliada: SancaoAvaliada): SancaoRegistrada {
  return {
    equipe: pedido.equipe,
    membro: pedido.membro,
    categoria: pedido.categoria,
    sancao: avaliada.sancao,
    set: avaliada.setDeAplicacao,
  }
}

/** Reflete expulsão/desqualificação de jogador no estado da equipe (bloqueio de retorno). */
export function aplicarSancaoNoEstado(estado: EstadoEquipe, jogadorId: number, avaliada: SancaoAvaliada): EstadoEquipe {
  if (avaliada.sancao === 'EXPULSAO') {
    return estado.expulsosNoSet.includes(jogadorId) ? estado : { ...estado, expulsosNoSet: [...estado.expulsosNoSet, jogadorId] }
  }
  if (avaliada.sancao === 'DESQUALIFICACAO') {
    return estado.desqualificados.includes(jogadorId)
      ? estado
      : { ...estado, desqualificados: [...estado.desqualificados, jogadorId] }
  }
  return estado
}

/** Valida o histórico completo do quadro de sanções (reprocessa na ordem, RG-SAN-009/011). */
export function validarQuadroDeSancoes(pedidos: readonly PedidoSancao[]): ResultadoRegra {
  const historico: SancaoRegistrada[] = []
  for (let i = 0; i < pedidos.length; i += 1) {
    const pedido = pedidos[i]!
    const r = avaliarSancao(historico, pedido)
    if (!r.ok) return bloqueio(r.codigo, `Sanção ${i + 1}: ${r.mensagem}`)
    historico.push(registrarSancao(pedido, r))
  }
  return { ok: true, avisos: [] }
}
