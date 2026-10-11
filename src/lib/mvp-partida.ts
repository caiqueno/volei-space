import { lanceForaDoRanking } from '@/lib/classificacao-jogadores'

export type AtletaMvp = {
  id: number
  equipeId: number | string
  nome: string
  numeroCadastro: string
  numeroSumula?: string | null
}

export type DestaqueMvp = {
  jogadorId: number
  tipo: 'MVP'
}

export type PassoFechamento = 'encerrar-set' | 'encerrar-partida' | 'oficializar'

export const AVISO_ESCOLHA_MVP = 'A partida já tem vencedor. Escolha o MVP e oficialize a súmula.'

function normalizar(valor: string) {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

/** Camisa desta partida. Sem número na súmula, vale o cadastro. */
export function camisaDaSumula(atleta: AtletaMvp) {
  const daPartida = atleta.numeroSumula == null ? '' : String(atleta.numeroSumula).trim()
  return daPartida || String(atleta.numeroCadastro ?? '').trim()
}

export function atletaPelaCamisaDaSumula(
  atletas: readonly AtletaMvp[],
  numero: string,
  equipeId?: number | string | null,
) {
  const alvo = String(numero).replace(/^#/, '').trim()
  if (!alvo) return null
  const pool = equipeId == null || equipeId === ''
    ? atletas
    : atletas.filter((item) => String(item.equipeId) === String(equipeId))
  const encontrados = pool.filter((item) => camisaDaSumula(item) === alvo)
  return encontrados.length === 1 ? encontrados[0] : null
}

export function equipeIdPeloNome(
  nome: string,
  equipes: readonly { id: number | string; nome: string }[],
) {
  const alvo = normalizar(nome)
  if (!alvo) return null
  const achada = equipes.find((item) => normalizar(item.nome) === alvo)
  return achada ? achada.id : null
}

export function descricaoEscolheMvp(descricao: string) {
  const texto = normalizar(descricao).replace(/[.!]+$/, '')
  return texto === 'mvp' || texto === 'mvp da equipe' || texto === 'mvp da equipe vencedora'
}

export function lerMvpDaAnotacao(texto: string) {
  const semPrefixo = String(texto).replace(/^\s*\d{1,2}:\d{2}\s*\|\s*[^|]+\|\s*/, '')
  const match = semPrefixo.match(/^(?:\[[^\]]+\]\s*)?(.+?)\s+-\s+#(\d+)\b[\s\S]*?:\s*(.+)\s*$/)
  if (!match || !descricaoEscolheMvp(match[3])) return null
  return { equipe: match[1].trim(), numero: match[2] }
}

export function jogadorMvpDaAnotacao(
  texto: string,
  atletas: readonly AtletaMvp[],
  equipePorNome: (nome: string) => number | string | null,
) {
  const lido = lerMvpDaAnotacao(texto)
  if (!lido) return null
  const equipeId = equipePorNome(lido.equipe)
  if (equipeId == null) return null
  return atletaPelaCamisaDaSumula(atletas, lido.numero, equipeId)
}

export function mvpDasOcorrencias(
  ocorrencias: readonly { descricao?: string | null }[],
  atletas: readonly AtletaMvp[],
  equipePorNome: (nome: string) => number | string | null,
) {
  for (let indice = ocorrencias.length - 1; indice >= 0; indice -= 1) {
    const achado = jogadorMvpDaAnotacao(String(ocorrencias[indice]?.descricao ?? ''), atletas, equipePorNome)
    if (achado) return achado
  }
  return null
}

/** O mesmo registro que o POST de oficialização exige em DestaquesPartida. */
export function destaqueDoJogador(jogadorId: number | string | null | undefined): DestaqueMvp[] {
  const id = typeof jogadorId === 'string' ? Number(jogadorId) : jogadorId
  if (id == null || !Number.isInteger(id) || id <= 0) return []
  return [{ jogadorId: id, tipo: 'MVP' }]
}

export function passoDeFechamento(entrada: {
  partidaEncerrada: boolean
  setsA: number
  setsB: number
  setsParaVencer: number
  setAtualPodeFechar: boolean
  vencedorDoSetAtual: 'teamA' | 'teamB' | null
}): PassoFechamento | null {
  if (entrada.partidaEncerrada) return 'oficializar'
  if (entrada.setsA >= entrada.setsParaVencer || entrada.setsB >= entrada.setsParaVencer) return 'encerrar-partida'
  if (!entrada.setAtualPodeFechar || !entrada.vencedorDoSetAtual) return null
  const setsA = entrada.setsA + (entrada.vencedorDoSetAtual === 'teamA' ? 1 : 0)
  const setsB = entrada.setsB + (entrada.vencedorDoSetAtual === 'teamB' ? 1 : 0)
  if (setsA >= entrada.setsParaVencer || setsB >= entrada.setsParaVencer) return 'encerrar-partida'
  return 'encerrar-set'
}

/**
 * O aviso de vencedor sem MVP abre o modal uma vez nesta detecção.
 * Fechar não arma de novo; um novo fim de partida, depois de sair de encerrada, arma outra vez.
 */
export function deveAbrirModalMvp(entrada: {
  partidaEncerrada: boolean
  temMvp: boolean
  sumulaAprovada: boolean
  jaAbriuNestaDeteccao: boolean
}) {
  if (!entrada.partidaEncerrada || entrada.temMvp || entrada.sumulaAprovada) return false
  return !entrada.jaAbriuNestaDeteccao
}

/** Enquanto a súmula espera oficialização, o botão reabre o modal. */
export function reabreModalMvp(entrada: { partidaEncerrada: boolean; sumulaAprovada: boolean }) {
  return entrada.partidaEncerrada && !entrada.sumulaAprovada
}

export type PontosMvp = {
  ataque: number
  bloqueio: number
  ace: number
  total: number
}

export type OcorrenciaPontosMvp = {
  tipo?: string | null
  jogadorId?: number | string | null
  descricao?: string | null
}

const FUNDAMENTO_MVP: Record<string, keyof Omit<PontosMvp, 'total'>> = {
  attack: 'ataque',
  ataque: 'ataque',
  block: 'bloqueio',
  bloqueio: 'bloqueio',
  ace: 'ace',
  saque: 'ace',
}

export const PONTOS_MVP_ZERADOS: PontosMvp = Object.freeze({ ataque: 0, bloqueio: 0, ace: 0, total: 0 })

function semAcento(valor: string) {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

/** Ataque, bloqueio e ace desta ocorrência. Ponto genérico e lance desfeito ficam de fora. */
export function fundamentoPontosMvp(ocorrencia: OcorrenciaPontosMvp): keyof Omit<PontosMvp, 'total'> | null {
  if (ocorrencia.jogadorId == null || String(ocorrencia.jogadorId).trim() === '') return null
  if (lanceForaDoRanking(ocorrencia.descricao)) return null
  return FUNDAMENTO_MVP[semAcento(String(ocorrencia.tipo ?? ''))] ?? null
}

/** Totais de ataque, bloqueio e ace já presentes nas ocorrências desta partida. */
export function pontosPorJogador(ocorrencias: readonly OcorrenciaPontosMvp[]) {
  const mapa = new Map<string, PontosMvp>()
  for (const ocorrencia of ocorrencias) {
    const fundamento = fundamentoPontosMvp(ocorrencia)
    if (!fundamento || ocorrencia.jogadorId == null) continue
    const id = String(ocorrencia.jogadorId)
    const atual = mapa.get(id) ?? { ataque: 0, bloqueio: 0, ace: 0, total: 0 }
    atual[fundamento] += 1
    atual.total += 1
    mapa.set(id, atual)
  }
  return mapa
}

export function pontosMvpDoJogador(pontos: ReadonlyMap<string, PontosMvp>, jogadorId: number | string) {
  return pontos.get(String(jogadorId)) ?? PONTOS_MVP_ZERADOS
}

/** Maior total primeiro. Empate: ace, depois bloqueio, depois ataque. */
export function compararPontosMvp(a: PontosMvp, b: PontosMvp) {
  return b.total - a.total
    || b.ace - a.ace
    || b.bloqueio - a.bloqueio
    || b.ataque - a.ataque
}

/**
 * Maior pontuador dentre os atletas informados.
 * Sem scout, ou com empate depois de ace, bloqueio e ataque, não há um nome só.
 * O retorno não escolhe o MVP.
 */
export function idDoMaiorPontuador(
  atletas: readonly { id: number | string }[],
  pontos: ReadonlyMap<string, PontosMvp>,
) {
  let melhor: { id: string; pontos: PontosMvp } | null = null
  let empate = false
  for (const atleta of atletas) {
    const atual = pontosMvpDoJogador(pontos, atleta.id)
    if (atual.total <= 0) continue
    if (!melhor) {
      melhor = { id: String(atleta.id), pontos: atual }
      continue
    }
    const ordem = compararPontosMvp(atual, melhor.pontos)
    if (ordem < 0) {
      melhor = { id: String(atleta.id), pontos: atual }
      empate = false
    } else if (ordem === 0) {
      empate = true
    }
  }
  if (!melhor || empate) return null
  return melhor.id
}
