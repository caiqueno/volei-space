/** Validação dos pedidos de tempo e substituição do banco (módulo PURO). */
import {
  interrupcaoVazia,
  registrarPedidoNaInterrupcao,
  validarPedidoNaInterrupcao,
  type PerfilRegras,
} from '@/lib/regras-volei'
import type { JogadorBanco, Violacao } from './papeleta-validacao'

export type PedidoLinha = { tipo: string; estado: string; payload?: any; decididoEm?: string | null; criadoEm?: string | null }

export type EntradaPedido = { tipo: 'TEMPO' | 'SUBSTITUICAO'; sai?: number; entra?: number }

/** Uso do set já contado: tempos e substituições da equipe. */
export type UsoDoSet = { tempos: number; substituicoes: number }

/** Troca já registrada no log efetivo da súmula (derivada pelo motor). */
export type TrocaDoLog = { sai: number; entra: number }

function doSet(p: PedidoLinha, setNumero: number) {
  return Number(p.payload?.setNumero) === setNumero
}

function ordemDecisao(a: PedidoLinha, b: PedidoLinha) {
  return String(a.decididoEm ?? a.criadoEm ?? '').localeCompare(String(b.decididoEm ?? b.criadoEm ?? ''))
}

/**
 * Quadra ATUAL da equipe: os seis da papeleta e, em ordem de decisão, as substituições já ACEITAS do set
 * (sai deixa a quadra, entra ocupa o lugar). Assim a volta B→A depois de A→B é aceita (RG-SUB: o titular
 * volta uma vez ao próprio lugar). Sem papeleta enviada não há como saber: devolve null.
 */
export function quadraAtual(titulares: readonly number[] | null | undefined, pedidos: readonly PedidoLinha[], setNumero: number): number[] | null {
  if (!titulares || titulares.length === 0) return null
  const quadra = [...titulares]
  const aceitas = pedidos.filter((p) => p.estado === 'ACEITO' && p.tipo === 'SUBSTITUICAO' && doSet(p, setNumero)).sort(ordemDecisao)
  for (const p of aceitas) {
    const sai = Number(p.payload?.sai)
    const entra = Number(p.payload?.entra)
    const i = quadra.indexOf(sai)
    if (i >= 0 && Number.isInteger(entra)) quadra[i] = entra
  }
  return quadra
}

/**
 * Uso do set pelo log EFETIVO da súmula (quando disponível) somado aos pedidos ACEITOS ainda não lançados.
 *  - Sem log (`log` nulo): só conta o que o banco registrou, os pedidos ACEITOS.
 *  - Com log: `log.tempos` / `log.substituicoes` são os contadores do motor (derivarPlacar().contadores) e
 *    valem sozinhos para o que já foi lançado. Cada pedido ACEITO só soma se ainda não aparece no log:
 *    substituição é casada pelo par sai/entra (cada troca do log casa uma vez); tempo, pela ordem de decisão
 *    (os primeiros `log.tempos` pedidos aceitos já estão lançados).
 * Escolha: o log é a verdade do que aconteceu em quadra; PedidoBanco sozinho subcontaria tempos e trocas
 * lançados direto pelo apontador e contaria dobrado os pedidos que ele já lançou.
 */
export function usoDoSet(params: {
  pedidos: readonly PedidoLinha[]
  setNumero: number
  log?: { tempos: number; substituicoes: number; trocas: readonly TrocaDoLog[] } | null
}): UsoDoSet {
  const { pedidos, setNumero, log } = params
  const aceitos = pedidos.filter((p) => p.estado === 'ACEITO' && doSet(p, setNumero)).sort(ordemDecisao)
  const temposAceitos = aceitos.filter((p) => p.tipo === 'TEMPO')
  const subsAceitas = aceitos.filter((p) => p.tipo === 'SUBSTITUICAO')
  if (!log) return { tempos: temposAceitos.length, substituicoes: subsAceitas.length }

  const restantes = log.trocas.map((t) => ({ ...t }))
  let naoLancadas = 0
  for (const p of subsAceitas) {
    const i = restantes.findIndex((t) => t.sai === Number(p.payload?.sai) && t.entra === Number(p.payload?.entra))
    if (i >= 0) restantes.splice(i, 1)
    else naoLancadas += 1
  }
  return {
    tempos: log.tempos + Math.max(0, temposAceitos.length - log.tempos),
    substituicoes: log.substituicoes + naoLancadas,
  }
}

/**
 * Valida estrutura e limites. Os limites contam o uso efetivo do set (`uso`, ver `usoDoSet`); sem `uso`,
 * contam os pedidos ACEITOS. Os PENDENTES entram só na regra de "mesma interrupção" (RG-TMP-003), via motor.
 * `sai` é conferido contra a QUADRA ATUAL (papeleta + substituições aceitas); `entra` precisa estar no
 * banco: na relação nominal, fora de quadra e não ser líbero.
 */
export function validarPedidoDoBanco(params: {
  entrada: EntradaPedido
  setNumero: number
  pedidos: readonly PedidoLinha[]
  perfil: Pick<PerfilRegras, 'temposPorSet' | 'limiteSubstituicoesPorSet'>
  elenco: readonly JogadorBanco[]
  titulares?: readonly number[] | null
  liberoId?: number | null
  libero2Id?: number | null
  uso?: UsoDoSet | null
}): Violacao[] {
  const { entrada, setNumero, pedidos, perfil, elenco } = params
  const v: Violacao[] = []
  const ids = elenco.map((j) => j.jogadorId)
  const liberos = [params.liberoId, params.libero2Id].filter((x): x is number => x != null)
  const quadra = quadraAtual(params.titulares, pedidos, setNumero)

  if (entrada.tipo === 'SUBSTITUICAO') {
    if (entrada.sai == null || entrada.entra == null) {
      v.push({ codigo: 'RG-SUB-002', mensagem: 'Informe quem sai e quem entra na substituição.' })
    } else {
      if (entrada.sai === entrada.entra) v.push({ codigo: 'RG-SUB-002', mensagem: 'Quem sai e quem entra precisam ser jogadores diferentes.' })
      for (const [rotulo, id] of [['sai', entrada.sai], ['entra', entrada.entra]] as const) {
        if (!ids.includes(id)) v.push({ codigo: 'RG-FOR-009', mensagem: `O jogador que ${rotulo} (${id}) não consta na relação nominal desta equipe.` })
      }
      if (quadra) {
        if (!quadra.includes(entrada.sai) && ids.includes(entrada.sai)) {
          v.push({ codigo: 'RG-SUB-002', mensagem: 'Quem sai precisa estar em quadra agora (papeleta do set mais as substituições já aceitas).' })
        }
        if (quadra.includes(entrada.entra) && ids.includes(entrada.entra) && entrada.entra !== entrada.sai) {
          v.push({ codigo: 'RG-SUB-002', mensagem: 'Quem entra já está em quadra.' })
        }
      }
      if (liberos.includes(entrada.sai) || liberos.includes(entrada.entra)) {
        v.push({ codigo: 'RG-LIB-005', mensagem: 'A troca de líbero não é substituição: ela é feita em quadra, sem pedido pelo banco.' })
      }
    }
  } else if (entrada.sai != null || entrada.entra != null) {
    v.push({ codigo: 'RG-TMP-001', mensagem: 'Pedido de tempo não leva jogadores.' })
  }
  if (v.length > 0) return v

  const uso = params.uso ?? usoDoSet({ pedidos, setNumero })
  if (entrada.tipo === 'TEMPO' && uso.tempos >= perfil.temposPorSet) {
    return [{ codigo: 'RG-TMP-001', mensagem: `A equipe já usou os ${perfil.temposPorSet} tempos permitidos neste set.` }]
  }
  if (entrada.tipo === 'SUBSTITUICAO' && uso.substituicoes >= perfil.limiteSubstituicoesPorSet) {
    return [{ codigo: 'RG-SUB-001', mensagem: `A equipe já usou as ${perfil.limiteSubstituicoesPorSet} substituições permitidas neste set.` }]
  }

  // Mesma interrupção: pedidos ainda pendentes da equipe.
  let estado = interrupcaoVazia()
  for (const p of pedidos.filter((x) => x.estado === 'PENDENTE' && doSet(x, setNumero))) {
    if (p.tipo === 'TEMPO' || p.tipo === 'SUBSTITUICAO') estado = registrarPedidoNaInterrupcao(estado, p.tipo)
  }
  const r = validarPedidoNaInterrupcao(estado, { tipo: entrada.tipo })
  return r.ok ? [] : [{ codigo: r.codigo, mensagem: r.mensagem }]
}
