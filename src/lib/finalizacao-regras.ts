import { normalizeEliminatoryPhase } from '@/lib/eliminatorias'
import { perdedorDaPartida, vencedorDaPartida, type PartidaDecisao } from '@/lib/resultado-partida'

export type PartidaFinalizacao = PartidaDecisao & {
  fase?: string | null
  categoriaCampeonatoId?: string | null
}

export type LinhaFinalizacao = {
  equipeId: number
  posicao: number
  jogos?: number | null
  categoriaCampeonatoId?: string | null
}

export type RegraFinalizacao = {
  categoriaCampeonatoId?: string | null
  formato?: string | null
  faseEliminatoria?: string | null
  disputaTerceiroLugar?: boolean | null
}

const FASES_MATA = new Set(['FINAL', 'SEMIFINAL', 'QUARTAS', 'OITAVAS', 'DEZESSEIS_AVOS', 'TERCEIRO_LUGAR'])
const STATUS_ENCERRADO = new Set(['ENCERRADA', 'WO', 'FINALIZADA', 'APROVADA', 'CANCELADA', 'FINISHED'])

export type CampeaoDefinido = { categoriaCampeonatoId: string | null; equipeId: number }

export function avaliarFinalizacao(input: {
  liga: RegraFinalizacao
  categorias?: RegraFinalizacao[]
  partidas: PartidaFinalizacao[]
  classificacao: LinhaFinalizacao[]
}): { ok: true; campeoes: CampeaoDefinido[] } | { ok: false; mensagem: string } {
  const categorias = input.categorias ?? []
  const chaves = new Set<string>()
  if (categorias.length === 0) chaves.add('')
  for (const categoria of categorias) chaves.add(categoria.categoriaCampeonatoId ?? '')
  for (const partida of input.partidas) chaves.add(partida.categoriaCampeonatoId ?? '')
  for (const linha of input.classificacao) chaves.add(linha.categoriaCampeonatoId ?? '')

  if (input.partidas.length === 0) {
    return { ok: false, mensagem: 'Este campeonato ainda não tem partidas para definir um campeão.' }
  }

  const campeoes: CampeaoDefinido[] = []
  for (const chave of Array.from(chaves)) {
    const categoriaId = chave || null
    const regra = categorias.find((item) => (item.categoriaCampeonatoId ?? '') === chave) ?? { ...input.liga, categoriaCampeonatoId: categoriaId }
    const partidas = input.partidas.filter((partida) => (partida.categoriaCampeonatoId ?? '') === chave)
    const classificacao = input.classificacao.filter((linha) => (linha.categoriaCampeonatoId ?? '') === chave)
    if (partidas.length === 0) continue
    const resultado = avaliarChave(regra, partidas, classificacao)
    if (!resultado.ok) return resultado
    campeoes.push({ categoriaCampeonatoId: categoriaId, equipeId: resultado.equipeId })
  }

  if (campeoes.length === 0) {
    return { ok: false, mensagem: 'Ainda não há um campeão definido.' }
  }
  return { ok: true, campeoes }
}

function avaliarChave(
  regra: RegraFinalizacao,
  partidas: PartidaFinalizacao[],
  classificacao: LinhaFinalizacao[],
): { ok: true; equipeId: number } | { ok: false; mensagem: string } {
  const formato = regra.formato === 'COPA_CURTA' ? 'MATA_MATA' : regra.formato
  const fase = formato === 'PONTOS_CORRIDOS' ? 'NENHUMA' : normalizeEliminatoryPhase(regra.faseEliminatoria)
  const temMataNasPartidas = partidas.some((partida) => FASES_MATA.has(String(partida.fase ?? '').toUpperCase()))
  const temMata = temMataNasPartidas || (fase !== 'NENHUMA' && formato !== 'PONTOS_CORRIDOS')

  const gruposPendentes = partidas.filter((partida) => faseDeGrupos(partida.fase) && !STATUS_ENCERRADO.has(String(partida.status ?? '').trim().toUpperCase()))
  if (gruposPendentes.length > 0) {
    return { ok: false, mensagem: 'Ainda há partidas da fase de grupos sem resultado.' }
  }

  if (temMata) {
    const finais = partidas.filter((partida) => String(partida.fase ?? '').toUpperCase() === 'FINAL')
    if (finais.length === 0) return { ok: false, mensagem: 'A final ainda não foi disputada.' }
    const campeaoId = vencedorDaPartida(finais[0])
    if (campeaoId == null) return { ok: false, mensagem: 'A final ainda não tem vencedor.' }
    if (regra.disputaTerceiroLugar !== false && partidas.some((partida) => String(partida.fase ?? '').toUpperCase() === 'SEMIFINAL')) {
      const terceiro = partidas.find((partida) => String(partida.fase ?? '').toUpperCase() === 'TERCEIRO_LUGAR')
      if (!terceiro || vencedorDaPartida(terceiro) == null) {
        return { ok: false, mensagem: 'A disputa de terceiro lugar ainda não foi decidida.' }
      }
    }
    return { ok: true, equipeId: campeaoId }
  }

  const lider = [...classificacao].sort((a, b) => a.posicao - b.posicao || a.equipeId - b.equipeId)[0]
  if (!lider || Number(lider.jogos ?? 0) <= 0) {
    return { ok: false, mensagem: 'A classificação ainda não tem um campeão com partida válida.' }
  }
  return { ok: true, equipeId: Number(lider.equipeId) }
}

function faseDeGrupos(fase?: string | null) {
  const valor = String(fase ?? 'GERAL').trim().toUpperCase()
  return valor === '' || valor === 'GERAL' || valor === 'GRUPOS'
}

export function viceDaFinal(final: PartidaDecisao) {
  const campeaoId = vencedorDaPartida(final)
  if (campeaoId == null) return null
  return perdedorDaPartida(final)
}
