/**
 * Modelo do placar ao vivo público. Normaliza a resposta de GET /api/ao-vivo/[partidaId]
 * ({data:{partida:{...},sets:[{numero,a,b}],atualizadoEm}}) e só deixa passar campos conhecidos:
 * nada de dados pessoais (nomes de atletas, documentos, contatos) chega à tela, mesmo que a API mande.
 */

export type Lado = 'A' | 'B'

export interface PlacarPublico {
  id: number
  equipeA: string
  equipeB: string
  status: string
  setsA: number
  setsB: number
  setAtual: number | null
  pontosA: number
  pontosB: number
  sacador: Lado | null
  sets: Array<{ numero: number; a: number; b: number }>
  atualizadoEm: string | null
}

const inteiro = (v: unknown, padrao = 0) => {
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 && n < 1000 ? Math.floor(n) : padrao
}
const texto = (v: unknown, padrao: string) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 80) : padrao)

function lerSacador(v: unknown, equipeA: string, equipeB: string): Lado | null {
  if (typeof v !== 'string') return null
  const s = v.trim()
  if (s === 'A' || s === 'teamA' || s === 'equipeA') return 'A'
  if (s === 'B' || s === 'teamB' || s === 'equipeB') return 'B'
  if (s && s === equipeA) return 'A'
  if (s && s === equipeB) return 'B'
  return null
}

/** Devolve null quando o corpo não tem o formato esperado (a tela mostra erro, não quebra). */
export function normalizarPlacar(corpo: unknown): PlacarPublico | null {
  const data = (corpo as { data?: any } | null)?.data
  const p = data?.partida
  if (!p || typeof p !== 'object') return null
  const id = Number(p.id)
  if (!Number.isSafeInteger(id) || id <= 0) return null
  const equipeA = texto(p.equipeA, 'Equipe A')
  const equipeB = texto(p.equipeB, 'Equipe B')
  const sets = (Array.isArray(data.sets) ? data.sets : [])
    .map((s: any) => ({ numero: inteiro(s?.numero), a: inteiro(s?.a), b: inteiro(s?.b) }))
    .filter((s: { numero: number }) => s.numero > 0)
    .sort((x: { numero: number }, y: { numero: number }) => x.numero - y.numero)
    .slice(0, 5)
  const setAtual = inteiro(p.setAtual, 0)
  return {
    id,
    equipeA,
    equipeB,
    status: typeof p.status === 'string' ? p.status.toUpperCase().slice(0, 30) : '',
    setsA: inteiro(p.setsA),
    setsB: inteiro(p.setsB),
    setAtual: setAtual > 0 ? setAtual : null,
    pontosA: inteiro(p.pontosA),
    pontosB: inteiro(p.pontosB),
    sacador: lerSacador(p.sacador, equipeA, equipeB),
    sets,
    atualizadoEm: typeof data.atualizadoEm === 'string' ? data.atualizadoEm : null,
  }
}

const FINAIS = new Set(['ENCERRADA', 'WO', 'CANCELADA'])

/** Partida em estado final: o polling pode parar. */
export const partidaFinalizada = (status: string) => FINAIS.has(status.toUpperCase())

export function rotuloStatus(status: string): string {
  switch (status.toUpperCase()) {
    case 'EM_ANDAMENTO':
      return 'Ao vivo'
    case 'ENCERRADA':
      return 'Encerrada'
    case 'WO':
      return 'W.O.'
    case 'CANCELADA':
      return 'Cancelada'
    case 'AGENDADA':
      return 'Aguardando início'
    default:
      return 'Partida'
  }
}

/** Decide o que mostrar com base no estado da consulta (puro, testável). */
export type VisaoAoVivo = 'carregando' | 'nao-encontrada' | 'erro' | 'placar'

export function decidirVisao(args: { temPlacar: boolean; naoEncontrada: boolean; falhou: boolean; carregou: boolean }): VisaoAoVivo {
  if (args.naoEncontrada) return 'nao-encontrada'
  if (args.temPlacar) return 'placar'
  if (args.falhou) return 'erro'
  return args.carregou ? 'erro' : 'carregando'
}
