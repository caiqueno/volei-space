/** Validação dos pedidos de tempo e substituição do banco (módulo PURO). */
import {
  interrupcaoVazia,
  registrarPedidoNaInterrupcao,
  validarPedidoNaInterrupcao,
  type PerfilRegras,
} from '@/lib/regras-volei'
import type { JogadorBanco, Violacao } from './papeleta-validacao'

export type PedidoLinha = { tipo: string; estado: string; payload?: any }

export type EntradaPedido = { tipo: 'TEMPO' | 'SUBSTITUICAO'; sai?: number; entra?: number }

function doSet(p: PedidoLinha, setNumero: number) {
  return Number(p.payload?.setNumero) === setNumero
}

/**
 * Valida estrutura e limites. Os limites contam os pedidos ACEITOS do set (decididos pelo apontador);
 * os PENDENTES entram só na regra de "mesma interrupção" (RG-TMP-003), via motor.
 */
export function validarPedidoDoBanco(params: {
  entrada: EntradaPedido
  setNumero: number
  pedidos: readonly PedidoLinha[]
  perfil: Pick<PerfilRegras, 'temposPorSet' | 'limiteSubstituicoesPorSet'>
  elenco: readonly JogadorBanco[]
  titulares?: readonly number[] | null
  liberoId?: number | null
}): Violacao[] {
  const { entrada, setNumero, pedidos, perfil, elenco } = params
  const v: Violacao[] = []
  const ids = elenco.map((j) => j.jogadorId)

  if (entrada.tipo === 'SUBSTITUICAO') {
    if (entrada.sai == null || entrada.entra == null) {
      v.push({ codigo: 'RG-SUB-002', mensagem: 'Informe quem sai e quem entra na substituição.' })
    } else {
      if (entrada.sai === entrada.entra) v.push({ codigo: 'RG-SUB-002', mensagem: 'Quem sai e quem entra precisam ser jogadores diferentes.' })
      for (const [rotulo, id] of [['sai', entrada.sai], ['entra', entrada.entra]] as const) {
        if (!ids.includes(id)) v.push({ codigo: 'RG-FOR-009', mensagem: `O jogador que ${rotulo} (${id}) não consta na relação nominal desta equipe.` })
      }
      if (params.titulares && params.titulares.length > 0 && !params.titulares.includes(entrada.sai) && ids.includes(entrada.sai)) {
        v.push({ codigo: 'RG-SUB-002', mensagem: 'Quem sai precisa estar em quadra segundo a papeleta do set.' })
      }
      if (params.liberoId != null && (entrada.sai === params.liberoId || entrada.entra === params.liberoId)) {
        v.push({ codigo: 'RG-LIB-005', mensagem: 'A troca de líbero não é substituição: ela é feita em quadra, sem pedido pelo banco.' })
      }
    }
  } else if (entrada.sai != null || entrada.entra != null) {
    v.push({ codigo: 'RG-TMP-001', mensagem: 'Pedido de tempo não leva jogadores.' })
  }
  if (v.length > 0) return v

  const aceitos = pedidos.filter((p) => p.estado === 'ACEITO' && doSet(p, setNumero))
  const tempos = aceitos.filter((p) => p.tipo === 'TEMPO').length
  const subs = aceitos.filter((p) => p.tipo === 'SUBSTITUICAO').length
  if (entrada.tipo === 'TEMPO' && tempos >= perfil.temposPorSet) {
    return [{ codigo: 'RG-TMP-001', mensagem: `A equipe já usou os ${perfil.temposPorSet} tempos permitidos neste set.` }]
  }
  if (entrada.tipo === 'SUBSTITUICAO' && subs >= perfil.limiteSubstituicoesPorSet) {
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
