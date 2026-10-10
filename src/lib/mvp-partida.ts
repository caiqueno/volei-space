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
