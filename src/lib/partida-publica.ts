export const PARTIDA_PUBLICA_COLUNAS = [
  'id',
  'ligaId',
  'categoria',
  'serie',
  'rodada',
  'fase',
  'status',
  'dataHora',
  'localNome',
  'setsPorA',
  'setsPorB',
  'equipeA:Equipe!Partida_equipeAId_fkey(id,nome,corHex,logoUrl)',
  'equipeB:Equipe!Partida_equipeBId_fkey(id,nome,corHex,logoUrl)',
  'sets:SetPartida(numero,pontosA,pontosB)',
].join(',')

export type PartidaPublica = {
  id: number
  ligaId: number
  categoria: string | null
  serie: string | null
  rodada: number
  fase: string | null
  status: string
  dataHora: string | null
  localNome: string | null
  setsPorA: number | null
  setsPorB: number | null
  equipeA: { id: number; nome: string; corHex: string | null; logoUrl?: string | null } | null
  equipeB: { id: number; nome: string; corHex: string | null; logoUrl?: string | null } | null
  sets: Array<{ numero: number; pontosA: number; pontosB: number }>
  liga?: { id: number; nome: string; simulacao?: boolean | null } | null
}

export type GruposPartidaPublica = {
  aoVivo: PartidaPublica[]
  proximos: PartidaPublica[]
  encerradas: PartidaPublica[]
  analise: PartidaPublica[]
  outras: PartidaPublica[]
}

export function primeiroRelacao<T>(valor: T | T[] | null | undefined): T | null {
  if (!valor) return null
  return Array.isArray(valor) ? valor[0] ?? null : valor
}

export function normalizarPartidaPublica(partida: any): PartidaPublica | null {
  const equipeA = primeiroRelacao(partida?.equipeA)
  const equipeB = primeiroRelacao(partida?.equipeB)
  const id = Number(partida?.id)
  if (!Number.isFinite(id) || !equipeA?.id || !equipeB?.id) return null
  const liga = primeiroRelacao(partida?.liga)
  return {
    id,
    ligaId: Number(partida.ligaId ?? liga?.id ?? 0),
    categoria: partida.categoria ?? null,
    serie: partida.serie ?? null,
    rodada: Number(partida.rodada ?? 0),
    fase: partida.fase ?? null,
    status: String(partida.status ?? ''),
    dataHora: partida.dataHora ? String(partida.dataHora) : null,
    localNome: partida.localNome ?? null,
    setsPorA: partida.setsPorA ?? null,
    setsPorB: partida.setsPorB ?? null,
    equipeA,
    equipeB,
    sets: Array.isArray(partida.sets) ? [...partida.sets].sort((a, b) => Number(a.numero) - Number(b.numero)) : [],
    liga: liga ?? null,
  }
}

export function agruparPartidasPublicas(partidas: PartidaPublica[]): GruposPartidaPublica {
  const grupos: GruposPartidaPublica = { aoVivo: [], proximos: [], encerradas: [], analise: [], outras: [] }
  for (const partida of partidas) {
    const status = partida.status.toUpperCase()
    if (status === 'EM_ANDAMENTO') grupos.aoVivo.push(partida)
    else if (status === 'ENCERRADA' || status === 'WO') grupos.encerradas.push(partida)
    else if (status === 'AGENDADA' || status === 'PENDENTE') grupos.proximos.push(partida)
    else if (status === 'PENDENTE_APROVACAO') grupos.analise.push(partida)
    else grupos.outras.push(partida)
  }
  grupos.aoVivo.sort(porData)
  grupos.proximos.sort(porData)
  grupos.encerradas.sort((a, b) => porData(b, a))
  grupos.analise.sort(porData)
  return grupos
}

function porData(a: PartidaPublica, b: PartidaPublica) {
  return new Date(a.dataHora ?? 0).getTime() - new Date(b.dataHora ?? 0).getTime()
}
