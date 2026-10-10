import { dataHoraUtc, ordenarJogos } from '@/lib/data-hora'
import { rotuloValido } from '@/lib/vaga-a-definir'

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
  equipeA: { id: number; nome: string; corHex: string | null; logoUrl?: string | null; vaga?: boolean } | null
  equipeB: { id: number; nome: string; corHex: string | null; logoUrl?: string | null; vaga?: boolean } | null
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

function ladoPublico(equipe: { id?: number; nome?: string; corHex?: string | null; logoUrl?: string | null } | null, origem: unknown) {
  if (equipe?.id) return { ...equipe, id: Number(equipe.id), nome: equipe.nome ?? 'Equipe', corHex: equipe.corHex ?? null, vaga: false }
  const rotulo = rotuloValido(origem)
  if (!rotulo) return null
  return { id: 0, nome: rotulo, corHex: null, logoUrl: null, vaga: true }
}

export function normalizarPartidaPublica(partida: any): PartidaPublica | null {
  const equipeA = ladoPublico(primeiroRelacao(partida?.equipeA), partida?.origemVagaA)
  const equipeB = ladoPublico(primeiroRelacao(partida?.equipeB), partida?.origemVagaB)
  const id = Number(partida?.id)
  if (!Number.isFinite(id) || !equipeA || !equipeB) return null
  const liga = primeiroRelacao(partida?.liga)
  return {
    id,
    ligaId: Number(partida.ligaId ?? liga?.id ?? 0),
    categoria: partida.categoria ?? null,
    serie: partida.serie ?? null,
    rodada: Number(partida.rodada ?? 0),
    fase: partida.fase ?? null,
    status: String(partida.status ?? ''),
    dataHora: dataHoraUtc(partida.dataHora),
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
  grupos.aoVivo = ordenarJogos(grupos.aoVivo)
  grupos.proximos = ordenarJogos(grupos.proximos)
  grupos.encerradas = ordenarJogos(grupos.encerradas)
  grupos.analise = ordenarJogos(grupos.analise)
  return grupos
}
