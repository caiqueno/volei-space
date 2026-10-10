const DURACAO_JOGO_MS = 90 * 60 * 1000

export type JogoAgenda = {
  id?: number | null
  equipeAId?: number | null
  equipeBId?: number | null
  dataHora?: string | null
  localNome?: string | null
  status?: string | null
  diasA?: string[] | null
  diasB?: string[] | null
}

export function diaDoJogo(dataHora: string) {
  const nome = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: 'America/Sao_Paulo' }).format(new Date(dataHora))
  const base = nome.replace(/-feira$/i, '')
  return base.charAt(0).toLocaleUpperCase('pt-BR') + base.slice(1)
}

export function lerDiasDisponiveis(valor: unknown) {
  const lista = typeof valor === 'string' ? listaJson(valor) : valor
  if (!Array.isArray(lista)) return []
  return lista.map((item) => String(item).trim()).filter(Boolean)
}

export function conflitosDeAgenda(propostos: JogoAgenda[], gravados: JogoAgenda[]) {
  const porId = new Map<number, JogoAgenda>()
  const semId: JogoAgenda[] = []
  for (const jogo of gravados) {
    if (jogo.id != null) porId.set(Number(jogo.id), jogo)
  }
  for (const jogo of propostos) {
    if (jogo.id != null) porId.set(Number(jogo.id), { ...porId.get(Number(jogo.id)), ...jogo })
    else semId.push(jogo)
  }
  const todos = [...Array.from(porId.values()), ...semId].filter((jogo) => String(jogo.status ?? '').toUpperCase() !== 'CANCELADA')
  const mensagens: string[] = []
  const vistos = new Set<string>()
  const avisar = (texto: string) => {
    if (vistos.has(texto)) return
    vistos.add(texto)
    mensagens.push(texto)
  }

  for (const proposto of propostos) {
    const jogo = proposto.id != null ? todos.find((item) => item.id === proposto.id) ?? proposto : proposto
    if (!jogo.dataHora) continue
    const faixa = intervalo(jogo.dataHora)
    if (!faixa) continue
    const dia = normalizar(diaDoJogo(jogo.dataHora))
    if (foraDoDia(jogo.diasA, dia) || foraDoDia(jogo.diasB, dia)) {
      avisar('O horário cai fora dos dias disponíveis da equipe.')
    }
    for (const outro of todos) {
      if (outro === jogo || (jogo.id != null && outro.id === jogo.id)) continue
      if (!outro.dataHora) continue
      const outra = intervalo(outro.dataHora)
      if (!outra || !cruza(faixa, outra)) continue
      if (compartilhaEquipe(jogo, outro)) avisar('Uma equipe já tem outro jogo nesse horário.')
      const quadra = quadraComparavel(jogo.localNome)
      if (quadra && quadra === quadraComparavel(outro.localNome)) avisar('A quadra já tem outro jogo nesse horário.')
    }
  }
  return mensagens
}

function listaJson(valor: string) {
  try {
    return JSON.parse(valor)
  } catch {
    return []
  }
}

function intervalo(dataHora: string) {
  const inicio = Date.parse(dataHora)
  if (Number.isNaN(inicio)) return null
  return { inicio, fim: inicio + DURACAO_JOGO_MS }
}

function cruza(esquerda: { inicio: number; fim: number }, direita: { inicio: number; fim: number }) {
  return esquerda.inicio < direita.fim && direita.inicio < esquerda.fim
}

function quadraComparavel(nome?: string | null) {
  const texto = String(nome ?? '').trim().toLocaleLowerCase('pt-BR')
  if (!texto || texto === 'a definir') return null
  return texto
}

function normalizar(valor: string) {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
}

function foraDoDia(dias: string[] | null | undefined, dia: string) {
  if (!dias || dias.length === 0) return false
  return !dias.some((item) => normalizar(item) === dia)
}

export const CARGOS_ARBITRAGEM = ['PRIMEIRO_ARBITRO', 'SEGUNDO_ARBITRO', 'MESARIO', 'JUIZ_DE_LINHA'] as const

export type EscalaHorario = {
  arbitroId: number
  partidaId: number
  dataHora?: string | null
  status?: string | null
}

export function conflitosDeArbitro(escalas: EscalaHorario[]) {
  const porArbitro = new Map<number, EscalaHorario[]>()
  for (const escala of escalas) {
    if (!escala.arbitroId || !escala.dataHora) continue
    if (String(escala.status ?? '').toUpperCase() === 'CANCELADA') continue
    const lista = porArbitro.get(escala.arbitroId) ?? []
    lista.push(escala)
    porArbitro.set(escala.arbitroId, lista)
  }
  for (const lista of Array.from(porArbitro.values())) {
    for (let esquerda = 0; esquerda < lista.length; esquerda += 1) {
      for (let direita = esquerda + 1; direita < lista.length; direita += 1) {
        if (lista[esquerda].partidaId === lista[direita].partidaId) continue
        const a = intervalo(String(lista[esquerda].dataHora))
        const b = intervalo(String(lista[direita].dataHora))
        if (a && b && cruza(a, b)) return ['O árbitro já está escalado em outro jogo nesse horário.']
      }
    }
  }
  return []
}

function equipesDe(jogo: JogoAgenda) {
  return [jogo.equipeAId, jogo.equipeBId].map(Number).filter((id) => Number.isInteger(id) && id > 0)
}

function compartilhaEquipe(esquerda: JogoAgenda, direita: JogoAgenda) {
  const times = new Set(equipesDe(esquerda))
  return equipesDe(direita).some((id) => times.has(id))
}
