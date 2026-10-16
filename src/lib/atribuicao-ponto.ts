import { ehPontoSemJogador, textoPonto, type OrigemPonto } from '@/lib/ponto-sumula'

// Atribuição opcional do ponto logo após o "+1" (faixa "Quem fez?").
// O ponto já foi gravado como coletivo; aqui só se reescreve o evento, sem mexer no placar nem no rodízio.

export const ATRIBUICAO_JANELA_MS = 5000
/** Depois de escolher Ataque/Bloqueio, o apontador ganha mais tempo para tocar na camisa. */
export const ATRIBUICAO_JANELA_ESCOLHA_MS = 8000

export type FaixaPonto = {
  eventId: string
  teamId: 'teamA' | 'teamB'
  /** A equipe que pontuou já estava sacando (então "Saque" é possível). */
  eraSacando: boolean
  /** Camisa de quem sacava no momento do ponto (só vale quando eraSacando). */
  camisaSacador: string
}

export type OpcaoOrigem = { origem: OrigemPonto; rotulo: string }

const ROTULOS_CURTOS: Record<OrigemPonto, string> = { ace: 'Saque', attack: 'Ataque', block: 'Bloqueio' }

/** Quais botões mostrar: "Saque" só se quem pontuou estava sacando e há sacador definido. */
export function opcoesDeOrigem(faixa: Pick<FaixaPonto, 'eraSacando' | 'camisaSacador'>): OpcaoOrigem[] {
  const origens: OrigemPonto[] = faixa.eraSacando && faixa.camisaSacador ? ['ace', 'attack', 'block'] : ['attack', 'block']
  return origens.map((origem) => ({ origem, rotulo: ROTULOS_CURTOS[origem] }))
}

export function origemPrecisaEscolherAtleta(origem: OrigemPonto) {
  return origem !== 'ace'
}

export type EventoAtribuivel = { id: string; type: string; text: string; jogadorId?: number }

/** Só um ponto ainda coletivo pode receber atribuição (nunca sobrescreve ponto já atribuído). */
export function podeAtribuir(evento: Pick<EventoAtribuivel, 'type' | 'text'> | undefined) {
  if (!evento) return false
  return evento.type === 'point' && ehPontoSemJogador(evento.text)
}

/** Reescreve o evento coletivo como ponto atribuído, preservando id, tempo, set e placar. */
export function atribuirPontoAoEvento<T extends EventoAtribuivel>(
  eventos: T[],
  eventId: string,
  atribuicao: { origem: OrigemPonto; equipe: string; camisa: string; jogador: string; jogadorId?: number },
): { eventos: T[]; alterado: boolean } {
  const alvo = eventos.find((evento) => evento.id === eventId)
  if (!podeAtribuir(alvo)) return { eventos, alterado: false }
  const texto = textoPonto(atribuicao.origem, atribuicao.equipe, atribuicao.camisa, atribuicao.jogador)
  return {
    alterado: true,
    eventos: eventos.map((evento) => evento.id === eventId
      ? { ...evento, type: atribuicao.origem, text: texto, jogadorId: atribuicao.jogadorId }
      : evento),
  }
}
