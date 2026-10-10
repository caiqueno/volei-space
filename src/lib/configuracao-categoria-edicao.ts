import { getRequiredEliminatoryTeams } from '@/lib/eliminatorias'
import { CAMPOS_SETS_POR_FASE } from '@/lib/sets-por-fase'

const STATUS_INICIADO_OU_ENCERRADO = new Set(['EM_ANDAMENTO', 'ENCERRADA', 'WO', 'FINALIZADA', 'APROVADA', 'FINISHED'])
const STATUS_GRUPO_ENCERRADO = new Set(['ENCERRADA', 'WO', 'FINALIZADA', 'APROVADA', 'FINISHED', 'CANCELADA'])
const FASES_ELIMINATORIAS = new Set(['FINAL', 'SEMIFINAL', 'QUARTAS', 'OITAVAS', 'DEZESSEIS_AVOS', 'TERCEIRO_LUGAR'])

const CAMPOS_LIGA = new Set([
  'quantidadeEquipes',
  'quantidadeEquipesMinima',
  'quantidadeEquipesMaxima',
  'formato',
  'quantidadeGrupos',
  'turnoReturno',
  'setsFormato',
  'setsPorPartida',
  'pontosPorSet',
  'diferencaMinimaSet',
  'tieBreakUltimoSet',
  'pontosUltimoSet',
  'sumulaScoutsEnabled',
  'criteriosClassificacao',
  'woSetsVencedor',
  'woSetsPerdedor',
  'woPontosSetVencedor',
  'woPontosSetPerdedor',
  'woPunicaoPontos',
  'classificadosPorGrupo',
  'melhoresClassificadosGerais',
  'faseEliminatoria',
  'metodoChaveamento',
  'eliminatoriaIdaVolta',
  'disputaTerceiroLugar',
  'goldenSet',
  'setsPorPartidaFinal',
  'setsPorPartidaSemifinal',
  'setsPorPartidaQuartas',
  'setsPorPartidaOitavas',
  'setsPorPartidaTerceiroLugar',
  'limiteSubstituicoesPorSet',
  'alertaRodizioIlegal',
  'formularioInscricaoConfig',
])

export type JogoDaCategoria = {
  status?: string | null
  fase?: string | null
  grupoId?: number | string | null
  sumulaSubmetidaEm?: string | null
  sumulaAprovadaEm?: string | null
  setsPorA?: number | null
  setsPorB?: number | null
  vencedorId?: number | null
}

export type SecaoSetup = {
  secao: string
  status: string
  revisaoConfirmada: number | null
}

export const MENSAGEM_EDICAO_BLOQUEADA =
  'Não é possível alterar esta seção: esta categoria já tem jogo em andamento, encerrado ou com súmula. A regra fica travada para não mudar uma partida que já começou. Equipes inscritas, sem jogo iniciado, não impedem a edição.'

export function jogoImpedeEdicaoDaCategoria(jogo: JogoDaCategoria) {
  const status = String(jogo.status ?? '').trim().toUpperCase()
  if (STATUS_INICIADO_OU_ENCERRADO.has(status)) return true
  if (jogo.sumulaSubmetidaEm || jogo.sumulaAprovadaEm) return true
  if (jogo.setsPorA != null || jogo.setsPorB != null) return true
  if (jogo.vencedorId != null) return true
  return false
}

export function faseDeGrupos(fase?: string | null) {
  const valor = String(fase ?? 'GERAL').trim().toUpperCase()
  return valor === '' || valor === 'GERAL' || valor === 'GRUPOS'
}

export function faseDeGruposEncerrada(partidas: JogoDaCategoria[]) {
  return partidas.filter((partida) => faseDeGrupos(partida.fase)).every((partida) => {
    const status = String(partida.status ?? '').trim().toUpperCase()
    if (status === 'EM_ANDAMENTO') return false
    if (STATUS_GRUPO_ENCERRADO.has(status)) return true
    if (partida.sumulaAprovadaEm) return true
    if (partida.sumulaSubmetidaEm && partida.vencedorId != null) return true
    return false
  })
}

export function partidaRemovivelAoRecriarGrupos(partida: JogoDaCategoria) {
  if (jogoImpedeEdicaoDaCategoria(partida)) return false
  const fase = String(partida.fase ?? 'GERAL').trim().toUpperCase()
  if (FASES_ELIMINATORIAS.has(fase)) return false
  if (partida.grupoId != null && String(partida.grupoId) !== '') return true
  return fase === '' || fase === 'GERAL' || fase === 'GRUPOS'
}

export function secoesDependentes(secao: string, patch: Record<string, unknown>) {
  const chaves = Object.keys(patch)
  const tem = (lista: string[]) => lista.some((chave) => chaves.includes(chave))
  if (secao === 'estrutura' && tem(['quantidadeEquipes', 'quantidadeEquipesMinima', 'quantidadeEquipesMaxima', 'formato', 'quantidadeGrupos', 'turnoReturno'])) {
    return ['classificacao', 'eliminatorias', 'calendario', 'inscricoes']
  }
  if (secao === 'estrutura' && tem(['setsFormato', 'setsPorPartida', 'pontosPorSet', 'tieBreakUltimoSet', 'pontosUltimoSet', 'terceiroSetObrigatorio'])) {
    return ['classificacao', 'eliminatorias']
  }
  if (secao === 'classificacao' && tem(['classificadosPorGrupo', 'melhoresClassificadosGerais'])) {
    return ['eliminatorias']
  }
  if (secao === 'eliminatorias' && chaves.length > 0 && !patchSoDeSetsPorFase(patch)) return ['classificacao', 'calendario']
  return []
}

const CAMPOS_ESTRUTURA_QUE_NAO_TRAVAM = new Set(['limiteSubstituicoesPorSet', 'alertaRodizioIlegal'])

export function patchSoDeLimiteDeSubstituicoes(patch: Record<string, unknown>) {
  const chaves = Object.keys(patch)
  return chaves.length > 0 && chaves.every((chave) => CAMPOS_ESTRUTURA_QUE_NAO_TRAVAM.has(chave))
}

const FASE_DO_CAMPO_DE_SETS: Record<(typeof CAMPOS_SETS_POR_FASE)[number], string> = {
  setsPorPartidaFinal: 'FINAL',
  setsPorPartidaSemifinal: 'SEMIFINAL',
  setsPorPartidaQuartas: 'QUARTAS',
  setsPorPartidaOitavas: 'OITAVAS',
  setsPorPartidaTerceiroLugar: 'TERCEIRO_LUGAR',
}

const NOME_DA_FASE_DE_SETS: Record<string, string> = {
  FINAL: 'A final',
  SEMIFINAL: 'A semifinal',
  QUARTAS: 'As quartas',
  OITAVAS: 'As oitavas',
  TERCEIRO_LUGAR: 'A disputa de 3º lugar',
}

export function patchSoDeSetsPorFase(patch: Record<string, unknown>) {
  const chaves = Object.keys(patch)
  return chaves.length > 0 && chaves.every((chave) => (CAMPOS_SETS_POR_FASE as readonly string[]).includes(chave))
}

/** A quantidade de sets de uma fase do mata-mata continua editável depois que a fase de grupos começa. Trava só a fase que já tem jogo iniciado. */
export function motivoBloqueioEdicao(secao: string, patch: Record<string, unknown>, jogos: JogoDaCategoria[]) {
  if (secao === 'estrutura' && patchSoDeLimiteDeSubstituicoes(patch)) return null
  if (secao === 'eliminatorias' && patchSoDeSetsPorFase(patch)) {
    for (const chave of Object.keys(patch) as Array<(typeof CAMPOS_SETS_POR_FASE)[number]>) {
      const fase = FASE_DO_CAMPO_DE_SETS[chave]
      const travou = jogos.some((jogo) => String(jogo.fase ?? '').trim().toUpperCase() === fase && jogoImpedeEdicaoDaCategoria(jogo))
      if (!travou) continue
      const nome = NOME_DA_FASE_DE_SETS[fase] ?? 'Esta fase'
      return `${nome} já tem jogo em andamento, encerrado ou com súmula. A quantidade de sets dessa fase fica travada.`
    }
    return null
  }
  if (['estrutura', 'classificacao', 'eliminatorias'].includes(secao) && jogos.some((jogo) => jogoImpedeEdicaoDaCategoria(jogo))) {
    return MENSAGEM_EDICAO_BLOQUEADA
  }
  return null
}

export function camposAlterados(atual: Record<string, unknown>, patch: Record<string, unknown>) {
  const saida: Record<string, unknown> = {}
  for (const [chave, valor] of Object.entries(patch)) {
    if (!valoresEquivalentes(atual[chave], valor)) saida[chave] = valor
  }
  return saida
}

export function camposParaEspelharNaLiga(patch: Record<string, unknown>) {
  const saida: Record<string, unknown> = {}
  for (const [chave, valor] of Object.entries(patch)) {
    if (CAMPOS_LIGA.has(chave)) saida[chave] = valor
  }
  return saida
}

export function proximoEstadoSecoes(input: {
  secoes: SecaoSetup[]
  secaoAtual: string
  versaoAnterior: number
  versaoNova: number
  dependentes: string[]
  concluir: boolean
}) {
  const dependentes = new Set(input.dependentes)
  const mapa = new Map(input.secoes.map((secao) => [secao.secao, { ...secao }]))
  for (const secao of Array.from(mapa.values())) {
    if (secao.status !== 'completed') continue
    if (secao.revisaoConfirmada !== input.versaoAnterior || dependentes.has(secao.secao)) {
      secao.status = 'attention-required'
      secao.revisaoConfirmada = null
    }
  }
  for (const secao of Array.from(mapa.values())) {
    if (secao.status === 'completed' && secao.revisaoConfirmada === input.versaoAnterior) {
      secao.revisaoConfirmada = input.versaoNova
    }
  }
  mapa.set(input.secaoAtual, {
    secao: input.secaoAtual,
    status: input.concluir ? 'completed' : 'in-progress',
    revisaoConfirmada: input.concluir ? input.versaoNova : null,
  })
  return Array.from(mapa.values())
}

export function statusConfiguracaoDaCategoria(formato: unknown, secoes: SecaoSetup[], versao: number) {
  const pulaClassificacao = formato === 'MATA_MATA' || formato === 'COPA_CURTA'
  const exigidas = pulaClassificacao
    ? ['estrutura', 'eliminatorias', 'calendario', 'inscricoes']
    : ['estrutura', 'classificacao', 'eliminatorias', 'calendario', 'inscricoes']
  const porNome = new Map(secoes.map((secao) => [secao.secao, secao]))
  const completas = exigidas.filter((nome) => {
    const secao = porNome.get(nome)
    return secao?.status === 'completed' && secao.revisaoConfirmada === versao
  }).length
  if (completas === exigidas.length) return 'CONCLUIDA'
  if (secoes.some((secao) => secao.status === 'attention-required')) return 'ATENCAO_NECESSARIA'
  return 'EM_ANDAMENTO'
}

export function erroAoConcluirCategoria(secao: string, efetivo: Record<string, unknown>) {
  if (secao === 'estrutura' && (efetivo.formato == null || efetivo.formato === '' || efetivo.quantidadeEquipes == null)) {
    return 'Para concluir a estrutura, informe o formato e a quantidade de equipes.'
  }
  const grupos = Number(efetivo.quantidadeGrupos)
  const equipes = Number(efetivo.quantidadeEquipes)
  if (Number.isFinite(grupos) && Number.isFinite(equipes) && grupos > equipes) {
    return 'A quantidade de grupos não pode ser maior que a de equipes.'
  }
  const fase = String(efetivo.faseEliminatoria ?? 'NENHUMA')
  if (fase === 'NENHUMA') return null
  const formato = String(efetivo.formato ?? '')
  if (formato === 'PONTOS_CORRIDOS') return 'Pontos corridos não possui fase eliminatória.'
  const exigidos = getRequiredEliminatoryTeams(fase)
  const total = formato === 'MATA_MATA'
    ? Number(efetivo.quantidadeEquipes ?? 0)
    : Number(efetivo.quantidadeGrupos ?? 0) * Number(efetivo.classificadosPorGrupo ?? 0) + Number(efetivo.melhoresClassificadosGerais ?? 0)
  if (total !== exigidos) {
    return `A quantidade de classificados (${total}) não corresponde à fase eliminatória, que exige ${exigidos}.`
  }
  return null
}

function valoresEquivalentes(atual: unknown, novo: unknown) {
  return JSON.stringify(canonico(atual)) === JSON.stringify(canonico(novo))
}

function canonico(valor: unknown): unknown {
  if (typeof valor === 'string') {
    const texto = valor.trim()
    if ((texto.startsWith('{') && texto.endsWith('}')) || (texto.startsWith('[') && texto.endsWith(']'))) {
      try {
        return canonico(JSON.parse(texto))
      } catch {
        return valor
      }
    }
  }
  if (Array.isArray(valor)) return valor.map(canonico)
  if (valor && typeof valor === 'object') {
    const objeto = valor as Record<string, unknown>
    return Object.keys(objeto).sort().reduce<Record<string, unknown>>((acc, chave) => {
      acc[chave] = canonico(objeto[chave])
      return acc
    }, {})
  }
  return valor
}
