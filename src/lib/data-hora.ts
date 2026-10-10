// O banco guarda o instante em UTC. Várias leituras devolvem "2026-10-10T11:30:00"
// sem Z. O navegador em America/Sao_Paulo trata isso como 11:30 local e o
// painel mostra 11:30 em vez de 08:30. A normalização só muda a resposta.

const FUSO = /(?:[zZ]|[+-]\d{2}(?::?\d{2})?)$/

export type JogoOrdenavel = {
  id?: number | null
  dataHora?: string | Date | null
  rodada?: number | null
  ordem?: number | null
}

/** Texto sem fuso vira ISO UTC com Z. Valor inválido volta null. */
export function dataHoraUtc(valor: unknown): string | null {
  if (valor == null || valor === '') return null
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor.toISOString()
  const texto = String(valor).trim()
  if (!texto) return null
  const comT = texto.includes('T') ? texto : texto.replace(' ', 'T')
  const base = FUSO.test(comT) ? comT : `${comSegundos(comT)}Z`
  const data = new Date(base)
  return Number.isNaN(data.getTime()) ? null : data.toISOString()
}

function comSegundos(valor: string) {
  return /T\d{2}:\d{2}$/.test(valor) ? `${valor}:00` : valor
}

export function instanteJogo(valor: unknown): number | null {
  const iso = dataHoraUtc(valor)
  if (!iso) return null
  const ms = new Date(iso).getTime()
  return Number.isNaN(ms) ? null : ms
}

/** Data e hora crescentes. Sem data, por último. Empate na ordem/rodada e, por fim, no id. */
export function compararJogosPorHorario(a: JogoOrdenavel, b: JogoOrdenavel) {
  const esquerda = instanteJogo(a.dataHora)
  const direita = instanteJogo(b.dataHora)
  if (esquerda === null && direita !== null) return 1
  if (direita === null && esquerda !== null) return -1
  if (esquerda !== null && direita !== null && esquerda !== direita) return esquerda - direita
  const ordemEsquerda = Number(a.ordem ?? a.rodada ?? 0)
  const ordemDireita = Number(b.ordem ?? b.rodada ?? 0)
  if (ordemEsquerda !== ordemDireita) return ordemEsquerda - ordemDireita
  return Number(a.id ?? 0) - Number(b.id ?? 0)
}

export function ordenarJogos<T extends JogoOrdenavel>(lista: T[]): T[] {
  return [...lista].sort(compararJogosPorHorario)
}

/** Copia a árvore e grava cada `dataHora` como ISO UTC. Não altera o argumento. */
export function normalizarDatasHora<T>(valor: T): T {
  if (Array.isArray(valor)) return valor.map((item) => normalizarDatasHora(item)) as T
  if (!valor || typeof valor !== 'object' || valor instanceof Date) return valor
  const copia: Record<string, unknown> = {}
  for (const [chave, item] of Object.entries(valor as Record<string, unknown>)) {
    if (chave === 'dataHora') copia[chave] = item == null || item === '' ? item : (dataHoraUtc(item) ?? item)
    else copia[chave] = normalizarDatasHora(item)
  }
  return copia as T
}
