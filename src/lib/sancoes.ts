/**
 * Sanções da súmula. A sequência no mesmo jogo sobe sozinha:
 * advertência, penalidade, expulsão e desqualificação.
 * Uma sanção mais grave pode ser aplicada direto.
 * Expulsão, desqualificação e cada duas advertências geram uma suspensão
 * automática para a partida seguinte da equipe. A penalidade não suspende;
 * ela entra na coluna de punições, junto com expulsão e desqualificação.
 */

export const ESCALA_SANCAO = ['ADVERTENCIA', 'PENALIDADE', 'EXPULSAO', 'DESQUALIFICACAO'] as const
export type TipoSancao = (typeof ESCALA_SANCAO)[number]

const ALIAS: Record<string, TipoSancao> = {
  ADVERTENCIA: 'ADVERTENCIA',
  CARTAO_AMARELO: 'ADVERTENCIA',
  PENALIDADE: 'PENALIDADE',
  EXPULSAO: 'EXPULSAO',
  CARTAO_VERMELHO: 'EXPULSAO',
  DESQUALIFICACAO: 'DESQUALIFICACAO',
}

export const PESO_PUNICAO: Record<TipoSancao, number> = {
  ADVERTENCIA: 0,
  PENALIDADE: 1,
  EXPULSAO: 1,
  DESQUALIFICACAO: 2,
}

export function tipoSancao(valor?: string | null): TipoSancao | null {
  const chave = String(valor ?? '').trim().toUpperCase()
  return ALIAS[chave] ?? null
}

const MARCADOR_SAN = /\[\[SAN:(?:A|B):[^:\]]+:[A-Z]+:([A-Z_]+):\d+\]\]/

/** Sanções do marcador que o servidor conhece. Advertência verbal e atraso não são cartões. */
const MARCADOR_PARA_SANCAO: Record<string, TipoSancao> = {
  AMARELO: 'ADVERTENCIA',
  PENALIDADE: 'PENALIDADE',
  EXPULSAO: 'EXPULSAO',
  DESQUALIFICACAO: 'DESQUALIFICACAO',
}

/**
 * A tela grava penalidade, expulsão e desqualificação todas como "Cartão vermelho"
 * (CARTAO_VERMELHO). O marcador [[SAN:...]] da descrição diz qual foi. Só refina esse
 * tipo ambíguo; nota antiga sem marcador, ou com marcador que não seja penalidade,
 * expulsão ou desqualificação, segue como antes.
 */
export function tipoSancaoDaOcorrencia(ocorrencia: { tipo?: string | null; descricao?: string | null }): TipoSancao | null {
  const base = tipoSancao(ocorrencia.tipo)
  if (String(ocorrencia.tipo ?? '').trim().toUpperCase() !== 'CARTAO_VERMELHO') return base
  const marcado = String(ocorrencia.descricao ?? '').match(MARCADOR_SAN)?.[1]
  const refinado = marcado ? MARCADOR_PARA_SANCAO[marcado] : undefined
  if (!refinado || refinado === 'ADVERTENCIA') return base
  return refinado
}

export function sancaoEfetiva(anteriores: Array<string | null | undefined>, pedida: string): TipoSancao | null {
  const nova = tipoSancao(pedida)
  if (!nova) return null
  const aplicadas = anteriores.map(tipoSancao).filter((item): item is TipoSancao => item != null)
  if (aplicadas.length === 0) return nova
  const ultima = Math.max(...aplicadas.map((item) => ESCALA_SANCAO.indexOf(item)))
  const sequencia = Math.min(ESCALA_SANCAO.length - 1, ultima + 1)
  return ESCALA_SANCAO[Math.max(sequencia, ESCALA_SANCAO.indexOf(nova))]
}

export type OcorrenciaSancao = {
  tipo?: string | null
  descricao?: string | null
  jogadorId?: number | null
  set?: number | null
  partidaId?: number | null
}

/** Recusa sanção abaixo da sequência já registrada para o atleta na partida. */
export function mensagemSancaoInvalida(ocorrencias?: OcorrenciaSancao[] | null): string | null {
  const porAtleta = new Map<number, string[]>()
  for (const ocorrencia of ocorrencias ?? []) {
    const tipo = tipoSancaoDaOcorrencia(ocorrencia)
    if (!tipo || ocorrencia.jogadorId == null) continue
    const anteriores = porAtleta.get(Number(ocorrencia.jogadorId)) ?? []
    const efetiva = sancaoEfetiva(anteriores, tipo)
    if (efetiva && efetiva !== tipo) {
      return `A sanção deste atleta precisa ser registrada como ${rotulo(efetiva)}.`
    }
    anteriores.push(tipo)
    porAtleta.set(Number(ocorrencia.jogadorId), anteriores)
  }
  return null
}

export function punicoesPorOcorrencia(ocorrencias: OcorrenciaSancao[], jogadorEquipe: Map<number, number>) {
  const pesos = new Map<number, number>()
  for (const ocorrencia of ocorrencias) {
    const tipo = tipoSancaoDaOcorrencia(ocorrencia)
    if (!tipo || ocorrencia.jogadorId == null) continue
    const equipeId = jogadorEquipe.get(Number(ocorrencia.jogadorId))
    if (equipeId == null) continue
    pesos.set(equipeId, (pesos.get(equipeId) ?? 0) + PESO_PUNICAO[tipo])
  }
  return pesos
}

export type JogoDoAtleta = { id: number; sancoes: string[] }

/**
 * A partida seguinte à que gerou a suspensão é a do cumprimento.
 * Enquanto houver cumprimento pendente, o atleta não entra.
 */
export function suspensaoAutomatica(jogosAnteriores: JogoDoAtleta[]) {
  let pendente = 0
  let advertencias = 0
  let motivo: string | null = null
  for (const jogo of jogosAnteriores) {
    if (pendente > 0) {
      pendente -= 1
      advertencias = 0
      continue
    }
    for (const bruta of jogo.sancoes) {
      const tipo = tipoSancao(bruta)
      if (!tipo) continue
      if (tipo === 'ADVERTENCIA') advertencias += 1
      if (advertencias >= 2) {
        pendente += 1
        advertencias = 0
        motivo = 'Duas advertências acumuladas suspendem o atleta na próxima partida.'
      }
      if (tipo === 'EXPULSAO') {
        pendente += 1
        motivo = 'A expulsão suspende o atleta na próxima partida.'
      }
      if (tipo === 'DESQUALIFICACAO') {
        pendente += 1
        motivo = 'A desqualificação suspende o atleta na próxima partida.'
      }
    }
  }
  return { suspenso: pendente > 0, motivo: pendente > 0 ? motivo : null, jogos: pendente }
}

function rotulo(tipo: TipoSancao) {
  if (tipo === 'ADVERTENCIA') return 'advertência'
  if (tipo === 'PENALIDADE') return 'penalidade'
  if (tipo === 'EXPULSAO') return 'expulsão'
  return 'desqualificação'
}
