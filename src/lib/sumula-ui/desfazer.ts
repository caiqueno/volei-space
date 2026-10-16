/**
 * Desfazer na súmula além do ponto (achado M5 do doc 24). Módulo PURO.
 *
 * O desfazer de ponto restaura placar, saque e formação do instantâneo anterior ao ponto. Dois
 * registros ficavam para trás: a sanção sem ponto (advertência, amarelo, expulsão, desqualificação)
 * e a troca feita entre dois pontos. Aqui ficam as regras de quais eventos saem junto.
 *
 * A lista de eventos da tela está do mais novo ao mais antigo; as funções declaram isso e passam
 * pela ordenação compartilhada (./ordem).
 */
import { lerSancao, semMarcadores } from './estado'
import { emOrdemCronologica } from './ordem'

export type RegistroDesfazivel = {
  id: string
  type: string
  text: string
  set: number
  teamId?: string
}

const TIPOS_DE_TROCA = new Set(['substitution', 'injury_substitution', 'libero_exchange'])

/** Sanções cujo efeito inclui ponto ao adversário saem pelo desfazer de ponto. */
const SANCOES_COM_PONTO = new Set(['PENALIDADE', 'PENALIDADE_ATRASO'])

export function ehTroca(evento: Pick<RegistroDesfazivel, 'type'>): boolean {
  return TIPOS_DE_TROCA.has(evento.type)
}

/** Ordem cronológica do que a tela guarda (mais novo primeiro). */
function cronologico<T extends RegistroDesfazivel>(eventosDoMaisNovo: ReadonlyArray<T>): T[] {
  return emOrdemCronologica(eventosDoMaisNovo, 'novo-primeiro')
}

/** Última sanção do set que NÃO deu ponto (a que o desfazer de ponto não alcança). */
export function ultimaSancaoSemPonto<T extends RegistroDesfazivel>(eventosDoMaisNovo: ReadonlyArray<T>, set: number): T | null {
  const lista = cronologico(eventosDoMaisNovo)
  for (let i = lista.length - 1; i >= 0; i -= 1) {
    const evento = lista[i]
    if (evento.set !== set || evento.type !== 'anotacao') continue
    const sancao = lerSancao(evento.text)
    if (sancao && !SANCOES_COM_PONTO.has(sancao.sancao)) return evento
  }
  return null
}

/** Última troca (substituição, excepcional ou de líbero) do set. */
export function ultimaTrocaDoSet<T extends RegistroDesfazivel>(eventosDoMaisNovo: ReadonlyArray<T>, set: number): T | null {
  const lista = cronologico(eventosDoMaisNovo)
  for (let i = lista.length - 1; i >= 0; i -= 1) {
    if (lista[i].set === set && ehTroca(lista[i])) return lista[i]
  }
  return null
}

/**
 * Trocas feitas DEPOIS do mais antigo dos eventos removidos. Ao desfazer um ponto a formação volta
 * ao instantâneo anterior a ele, então as trocas posteriores também precisam sair (senão o contador
 * "Troca N de M" e a formação do motor divergem da quadra).
 */
export function trocasPosterioresAosRemovidos<T extends RegistroDesfazivel>(eventosDoMaisNovo: ReadonlyArray<T>, idsRemovidos: ReadonlyArray<string>): T[] {
  const lista = cronologico(eventosDoMaisNovo)
  const remover = new Set(idsRemovidos)
  const primeiro = lista.findIndex((evento) => remover.has(evento.id))
  if (primeiro < 0) return []
  return lista.slice(primeiro + 1).filter((evento) => ehTroca(evento) && !remover.has(evento.id))
}

export function semEventos<T extends { id: string }>(eventos: ReadonlyArray<T>, ids: ReadonlyArray<string>): T[] {
  const sair = new Set(ids)
  return eventos.filter((evento) => !sair.has(evento.id))
}

/** Itens de `anotacoes` ligados a eventos removidos saem junto (senão seguem para o servidor). */
export function semAnotacoesDosEventos<T extends { eventoId?: string }>(anotacoes: ReadonlyArray<T>, idsRemovidos: ReadonlyArray<string>): T[] {
  const sair = new Set(idsRemovidos)
  return anotacoes.filter((nota) => !(nota.eventoId && sair.has(nota.eventoId)))
}

/**
 * Itens de `anotacoes` que já existem como evento não vão duas vezes no PUT: o evento carrega o
 * mesmo texto mais o marcador. Evita ocorrência duplicada (e sanção contada duas vezes no servidor).
 */
export function anotacoesSemEventoCorrespondente<T extends { eventoId?: string }>(anotacoes: ReadonlyArray<T>, eventos: ReadonlyArray<{ id: string }>): T[] {
  const existentes = new Set(eventos.map((evento) => evento.id))
  return anotacoes.filter((nota) => !(nota.eventoId && existentes.has(nota.eventoId)))
}

/** Texto curto, sem marcadores técnicos, para confirmar o que será desfeito. */
export function descricaoDoRegistro(evento: Pick<RegistroDesfazivel, 'text'>): string {
  return semMarcadores(evento.text).replace(/\s+/g, ' ').trim()
}
