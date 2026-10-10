export type JogoExistente = { aId: number; bId: number; rodada: number }

export type ConfrontoGerado<T> = { a: T; b: T; rodada: number }

/**
 * Turno único: cada rodada tem o maior número de jogos em que nenhuma equipe
 * se repete. Sem jogos gravados, o método do círculo fecha em n−1 rodadas
 * (n, se n for ímpar). Com jogos já gravados, o confronto novo ocupa a menor
 * rodada livre e não reescreve a rodada antiga. Ida e volta repete o turno
 * com o mando invertido.
 */
export function montarConfrontos<T extends { id: number }>(
  equipes: T[],
  existentes: JogoExistente[] = [],
  turnoReturno = false,
): ConfrontoGerado<T>[] {
  if (existentes.length === 0) return circulo(equipes, turnoReturno)
  return encaixar(equipes, existentes, turnoReturno)
}

function circulo<T extends { id: number }>(equipes: T[], turnoReturno: boolean): ConfrontoGerado<T>[] {
  if (equipes.length < 2) return []
  const giro: Array<T | null> = equipes.slice()
  if (giro.length % 2 === 1) giro.push(null)
  const quantidade = giro.length
  const rodadas = quantidade - 1
  const metade = quantidade / 2
  const ida: ConfrontoGerado<T>[] = []
  for (let rodada = 1; rodada <= rodadas; rodada += 1) {
    for (let indice = 0; indice < metade; indice += 1) {
      const a = giro[indice]
      const b = giro[quantidade - 1 - indice]
      if (a && b) ida.push({ a, b, rodada })
    }
    const ultimo = giro.pop()
    if (ultimo !== undefined) giro.splice(1, 0, ultimo)
  }
  if (!turnoReturno) return ida
  return ida.concat(ida.map((jogo) => ({ a: jogo.b, b: jogo.a, rodada: jogo.rodada + rodadas })))
}

function encaixar<T extends { id: number }>(
  equipes: T[],
  existentes: JogoExistente[],
  turnoReturno: boolean,
): ConfrontoGerado<T>[] {
  const ocupadas = new Map<number, Set<number>>()
  const feitos = new Set<string>()

  for (const jogo of existentes) {
    const rodada = Number(jogo.rodada)
    if (!Number.isInteger(rodada) || rodada < 1) continue
    const chave = turnoReturno ? chaveDirecionada(jogo.aId, jogo.bId) : chavePar(jogo.aId, jogo.bId)
    if (feitos.has(chave)) continue
    feitos.add(chave)
    if (!turnoReturno) feitos.add(chaveDirecionada(jogo.bId, jogo.aId))
    ocupar(ocupadas, rodada, jogo.aId, jogo.bId)
  }

  const novos: ConfrontoGerado<T>[] = []
  for (const volta of turnoReturno ? [false, true] : [false]) {
    for (let i = 0; i < equipes.length; i += 1) {
      for (let j = i + 1; j < equipes.length; j += 1) {
        const a = volta ? equipes[j] : equipes[i]
        const b = volta ? equipes[i] : equipes[j]
        const chave = turnoReturno ? chaveDirecionada(a.id, b.id) : chavePar(a.id, b.id)
        if (feitos.has(chave)) continue
        const rodada = primeiraLivre(ocupadas, a.id, b.id)
        ocupar(ocupadas, rodada, a.id, b.id)
        feitos.add(chave)
        if (!turnoReturno) feitos.add(chaveDirecionada(b.id, a.id))
        novos.push({ a, b, rodada })
      }
    }
  }
  return novos
}

function chavePar(a: number, b: number) {
  return a < b ? `${a}:${b}` : `${b}:${a}`
}

function chaveDirecionada(a: number, b: number) {
  return `${a}>${b}`
}

function ocupar(mapa: Map<number, Set<number>>, rodada: number, a: number, b: number) {
  const times = mapa.get(rodada) ?? new Set<number>()
  times.add(a)
  times.add(b)
  mapa.set(rodada, times)
}

function primeiraLivre(mapa: Map<number, Set<number>>, a: number, b: number) {
  let rodada = 1
  while (mapa.get(rodada)?.has(a) || mapa.get(rodada)?.has(b)) rodada += 1
  return rodada
}
