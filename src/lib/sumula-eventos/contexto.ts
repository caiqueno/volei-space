/**
 * Contexto que o servidor monta sozinho para o motor: relação nominal de cada equipe.
 * Nunca vem do cliente (o cliente poderia inventar jogador para burlar a regra).
 */
import type { ContextoDerivacao } from '@/lib/regras-volei'

interface JogadorBasico {
  id?: number | string | null
}
interface PresencaBasica {
  jogadorId?: number | string | null
  presente?: boolean | null
}
interface PartidaComElenco {
  equipeA?: { jogadores?: JogadorBasico[] | null } | null
  equipeB?: { jogadores?: JogadorBasico[] | null } | null
  presencas?: PresencaBasica[] | null
}

function ids(jogadores: JogadorBasico[] | null | undefined): number[] {
  return (jogadores ?? []).map((j) => Number(j.id)).filter((id) => Number.isInteger(id) && id > 0)
}

/**
 * Relação nominal = jogadores da equipe. Se a súmula já marcou presença para alguém da equipe,
 * só os presentes entram (quem foi marcado ausente não pode jogar).
 */
export function contextoDaPartida(partida: PartidaComElenco): ContextoDerivacao {
  const presentes = new Set(
    (partida.presencas ?? []).filter((p) => p.presente === true).map((p) => Number(p.jogadorId)),
  )
  const doTime = (jogadores: JogadorBasico[] | null | undefined) => {
    const todos = ids(jogadores)
    const marcados = todos.filter((id) => presentes.has(id))
    return marcados.length > 0 ? marcados : todos
  }
  return { elenco: { A: doTime(partida.equipeA?.jogadores), B: doTime(partida.equipeB?.jogadores) } }
}
