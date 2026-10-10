import { selecionarClassificados } from '@/lib/classificados'
import { faseDeGrupos, faseDeGruposEncerrada, type JogoDaCategoria } from '@/lib/configuracao-categoria-edicao'
import { getRequiredEliminatoryTeams } from '@/lib/eliminatorias'

const FASES_CHAVE = new Set(['FINAL', 'SEMIFINAL', 'QUARTAS', 'OITAVAS', 'DEZESSEIS_AVOS', 'TERCEIRO_LUGAR'])

export type EquipePublica = {
  id: number
  nome: string
  corHex: string | null
  logoUrl: string | null
}

export type LinhaClassificacao = {
  posicao: number
  pontos: number
  jogos: number
  vitorias: number
  derrotas: number
  setsPro: number
  setsContra: number
  pontosPro: number
  pontosContra: number
  punicoes: number
  equipe: EquipePublica
}

export type GrupoTabela = {
  id: string
  nome: string
  dados: LinhaClassificacao[]
  automaticLimit: number
}

export type TabelaCategoria = {
  id: string | null
  nome: string
  linhas: LinhaClassificacao[]
  groups: GrupoTabela[]
  groupStageFinished: boolean
  requiredClassified: number
  automaticClassifiedIds: number[]
  manualClassifiedIds: number[]
  locked: boolean
}

type ComCategoria = { categoriaCampeonatoId?: string | null }

export type EntradaBruta = ComCategoria & {
  equipeId?: number | null
  posicao?: number | null
  pontos?: number | null
  jogos?: number | null
  vitorias?: number | null
  derrotas?: number | null
  setsPro?: number | null
  setsContra?: number | null
  pontosPro?: number | null
  pontosContra?: number | null
  punicoes?: number | null
  equipe?: unknown
}

export type ConfigCategoria = {
  categoriaCampeonatoId: string
  formato?: string | null
  quantidadeGrupos?: number | null
  classificadosPorGrupo?: number | null
  melhoresClassificadosGerais?: number | null
  faseEliminatoria?: string | null
}

export type RegrasCampeonato = {
  formato?: string | null
  quantidadeGrupos?: number | null
  classificadosPorGrupo?: number | null
  melhoresClassificadosGerais?: number | null
  faseEliminatoria?: string | null
}

export function chaveDaVaga(categoriaId: string | null | undefined, fase: string, rodada: number) {
  return `${categoriaId ?? ''}:${String(fase ?? '').toUpperCase()}:${Number(rodada)}`
}

export function vagaOcupadaNaCategoria(
  existentes: Array<ComCategoria & { fase?: string | null; rodada?: number | null }>,
  categoriaId: string,
  fase: string,
  rodada: number,
) {
  const chave = chaveDaVaga(categoriaId, fase, rodada)
  return existentes.some((item) => chaveDaVaga(item.categoriaCampeonatoId, String(item.fase ?? ''), Number(item.rodada)) === chave)
}

export function faseDaCategoria(
  config: { faseEliminatoria?: string | null } | null | undefined,
  liga: { faseEliminatoria?: string | null } | null | undefined,
  temCategoria: boolean,
) {
  if (temCategoria) return String(config?.faseEliminatoria ?? 'NENHUMA')
  return String(liga?.faseEliminatoria ?? 'NENHUMA')
}

export function partidasDaCategoria<T extends ComCategoria>(partidas: T[], categoriaId: string | null, isolar: boolean) {
  if (!isolar) return partidas
  return partidas.filter((partida) => (partida.categoriaCampeonatoId ?? null) === categoriaId)
}

export function gruposEncerradosNaCategoria(
  partidas: Array<JogoDaCategoria & ComCategoria>,
  categoriaId: string | null,
  formato?: string | null,
  isolar = true,
) {
  const formatoNormal = formato === 'COPA_CURTA' ? 'MATA_MATA' : formato
  if (formatoNormal === 'MATA_MATA') return true
  const deGrupos = partidasDaCategoria(partidas, categoriaId, isolar).filter((partida) => faseDeGrupos(partida.fase))
  if (deGrupos.length === 0) return false
  return faseDeGruposEncerrada(deGrupos)
}

export function chaveIniciadaNaCategoria(
  partidas: Array<ComCategoria & { fase?: string | null }>,
  categoriaId: string | null,
  isolar = true,
) {
  return partidasDaCategoria(partidas, categoriaId, isolar).some((partida) => (
    FASES_CHAVE.has(String(partida.fase ?? '').trim().toUpperCase())
  ))
}

export function podeAvancarDeFase(input: { requiredClassified: number; classificados: number; groupStageFinished: boolean }) {
  return input.requiredClassified > 0 && input.classificados >= input.requiredClassified && input.groupStageFinished
}

export function equipePublica(valor: unknown): EquipePublica {
  const bruto = Array.isArray(valor) ? valor[0] : valor
  const equipe = bruto && typeof bruto === 'object' ? bruto as Record<string, unknown> : {}
  return {
    id: Number(equipe.id ?? 0),
    nome: String(equipe.nome ?? 'Equipe'),
    corHex: equipe.corHex == null || equipe.corHex === '' ? null : String(equipe.corHex),
    logoUrl: equipe.logoUrl == null || equipe.logoUrl === '' ? null : String(equipe.logoUrl),
  }
}

export function alimentadorUsaVencedorExplicito(partidas: Array<{ equipeAId: number; equipeBId: number; setsPorA?: number | null; setsPorB?: number | null; vencedorId?: number | null }>) {
  return partidas.some((partida) => {
    const vencedorId = partida.vencedorId == null ? null : Number(partida.vencedorId)
    const setsIguais = Number(partida.setsPorA ?? 0) === Number(partida.setsPorB ?? 0)
    return setsIguais && (vencedorId === Number(partida.equipeAId) || vencedorId === Number(partida.equipeBId))
  })
}

export function recusaClassificacaoManual(input: {
  faseEliminatoria?: string | null
  chaveIniciada: boolean
  equipeNaCategoria: boolean
  jaClassificada: boolean
  classificados: number
}) {
  if (!input.equipeNaCategoria) return 'A equipe não pertence a esta categoria.'
  if (input.chaveIniciada) return 'O chaveamento desta categoria já começou.'
  const exigidos = getRequiredEliminatoryTeams(input.faseEliminatoria)
  if (exigidos <= 0) return 'Esta categoria não possui fase eliminatória configurada.'
  if (input.jaClassificada) return 'Esta equipe já está classificada nesta categoria.'
  if (input.classificados >= exigidos) return 'As vagas desta categoria já foram preenchidas.'
  return ''
}

export type ErroRpc = { code?: string | null; message?: string | null }

export function mensagemRpcOperacao(erro: ErroRpc): { status: number; mensagem: string; motivo: 'ausente' | 'inelegivel' | 'vaga' | 'grupos' | 'outro' } {
  const code = String(erro.code ?? '')
  const message = String(erro.message ?? '')
  const texto = `${code} ${message}`.toLowerCase()
  if (code === '42883' || code === 'PGRST202' || /does not exist|could not find the function|schema cache/.test(texto)) {
    return { status: 503, mensagem: 'A operação por categoria ainda não está disponível neste banco.', motivo: 'ausente' }
  }
  if (code === '40001' || texto.includes('category changed')) {
    return { status: 409, mensagem: 'A categoria mudou. Atualize a tela e tente de novo.', motivo: 'outro' }
  }
  if (code === '23505' || texto.includes('slot or participant') || texto.includes('duplicate key')) {
    return { status: 409, mensagem: 'Esta vaga já está ocupada nesta categoria.', motivo: 'vaga' }
  }
  if (texto.includes('championship unavailable')) {
    return { status: 403, mensagem: 'Confirme o pagamento do campeonato antes de montar a chave.', motivo: 'outro' }
  }
  if (code === '42501' || texto.includes('acesso negado') || texto.includes('unauthorized')) {
    return { status: 403, mensagem: 'Você não pode alterar esta categoria.', motivo: 'outro' }
  }
  if (texto.includes('chaveamento ja iniciado') || texto.includes('chaveamento já iniciado')) {
    return { status: 409, mensagem: 'O chaveamento desta categoria já começou.', motivo: 'outro' }
  }
  if (texto.includes('vagas preenchidas') || texto.includes('ja classificada') || texto.includes('já classificada')) {
    return { status: 409, mensagem: 'As vagas desta categoria já foram preenchidas ou a equipe já está classificada.', motivo: 'vaga' }
  }
  if (code === '23514' || texto.includes('equipe fora da categoria') || texto.includes('invalid category teams')) {
    return { status: 422, mensagem: 'A equipe não pertence a esta categoria.', motivo: 'outro' }
  }
  if (texto.includes('group stage not finished')) {
    return { status: 422, mensagem: 'A fase de grupos desta categoria ainda não terminou.', motivo: 'grupos' }
  }
  if (texto.includes('teams are not eligible') || texto.includes('not eligible')) {
    return { status: 422, mensagem: 'Os times não estão classificados para esta vaga.', motivo: 'inelegivel' }
  }
  if (code === 'P0002' || texto.includes('no data found') || texto.includes('category has no')) {
    return { status: 422, mensagem: 'Configure a categoria antes desta operação.', motivo: 'outro' }
  }
  return { status: 500, mensagem: 'Não foi possível concluir a operação desta categoria.', motivo: 'outro' }
}

export function montarTabelasPorCategoria(input: {
  categorias: { id: string; nome: string }[]
  configs: ConfigCategoria[]
  liga: RegrasCampeonato | null
  entradas: EntradaBruta[]
  equipesAtivas: Array<ComCategoria & { id: number; nome?: string | null; corHex?: string | null; logoUrl?: string | null }>
  partidas: Array<JogoDaCategoria & ComCategoria>
  grupos: Array<ComCategoria & { id: number; nome: string; classificados?: number | null }>
  vinculos: Array<ComCategoria & { grupoId: number; equipeId: number; posicao?: number | null }>
  manuais: Array<ComCategoria & { equipeId: number }>
}): TabelaCategoria[] {
  const temCategoria = input.categorias.length > 0
  const alvos = temCategoria
    ? input.categorias
    : [{ id: '', nome: 'Classificação' }]
  return alvos.map((categoria) => tabelaDaCategoria(input, categoria.id || null, categoria.nome, temCategoria))
}

function tabelaDaCategoria(
  input: Parameters<typeof montarTabelasPorCategoria>[0],
  categoriaId: string | null,
  nome: string,
  temCategoria: boolean,
): TabelaCategoria {
  const config = temCategoria ? input.configs.find((item) => item.categoriaCampeonatoId === categoriaId) ?? null : null
  const regras = temCategoria ? config : input.liga
  const fase = faseDaCategoria(config, input.liga, temCategoria)
  const entradas = partidasDaCategoria(input.entradas, categoriaId, temCategoria)
    .slice()
    .sort((a, b) => numero(a.posicao) - numero(b.posicao) || numero(a.equipeId) - numero(b.equipeId))
  const presentes = new Set<number>()
  const linhas: LinhaClassificacao[] = []
  for (const entrada of entradas) {
    const equipeId = Number(entrada.equipeId ?? equipePublica(entrada.equipe).id)
    if (!Number.isInteger(equipeId) || presentes.has(equipeId)) continue
    presentes.add(equipeId)
    linhas.push(linhaDeEntrada(entrada, linhas.length + 1, equipeId))
  }
  const equipes = partidasDaCategoria(input.equipesAtivas, categoriaId, temCategoria)
    .slice()
    .sort((a, b) => String(a.nome ?? '').localeCompare(String(b.nome ?? ''), 'pt-BR'))
  for (const equipe of equipes) {
    if (presentes.has(equipe.id)) continue
    presentes.add(equipe.id)
    linhas.push({
      posicao: linhas.length + 1,
      pontos: 0,
      jogos: 0,
      vitorias: 0,
      derrotas: 0,
      setsPro: 0,
      setsContra: 0,
      pontosPro: 0,
      pontosContra: 0,
      punicoes: 0,
      equipe: equipePublica(equipe),
    })
  }
  const grupos = partidasDaCategoria(input.grupos, categoriaId, temCategoria)
  const vinculos = partidasDaCategoria(input.vinculos, categoriaId, temCategoria)
  const manuais = partidasDaCategoria(input.manuais, categoriaId, temCategoria).map((item) => Number(item.equipeId))
  const partidas = partidasDaCategoria(input.partidas, categoriaId, temCategoria)
  const classificados = selecionarClassificados({
    formato: regras?.formato,
    faseEliminatoria: fase,
    quantidadeGrupos: regras?.quantidadeGrupos,
    classificadosPorGrupo: regras?.classificadosPorGrupo,
    melhoresClassificadosGerais: regras?.melhoresClassificadosGerais,
    ordenados: linhas.map((linha) => linha.equipe.id),
    grupos: grupos.map((grupo) => ({ id: Number(grupo.id), classificados: numero(grupo.classificados) })),
    vinculos: vinculos.map((vinculo) => ({ grupoId: Number(vinculo.grupoId), equipeId: Number(vinculo.equipeId) })),
    manuais,
  })
  const manuaisSet = new Set(manuais)
  return {
    id: categoriaId,
    nome,
    linhas,
    groups: montarGrupos(linhas, grupos, vinculos),
    groupStageFinished: gruposEncerradosNaCategoria(partidas, categoriaId, regras?.formato, false),
    requiredClassified: getRequiredEliminatoryTeams(fase),
    automaticClassifiedIds: Array.from(classificados).filter((id) => !manuaisSet.has(id)),
    manualClassifiedIds: manuais,
    locked: chaveIniciadaNaCategoria(partidas, categoriaId, false),
  }
}

function montarGrupos(
  linhas: LinhaClassificacao[],
  grupos: Array<{ id: number; nome: string; classificados?: number | null }>,
  vinculos: Array<{ grupoId: number; equipeId: number; posicao?: number | null }>,
): GrupoTabela[] {
  const porEquipe = new Map(linhas.map((linha) => [linha.equipe.id, linha]))
  return grupos
    .map((grupo) => ({
      id: String(grupo.id),
      nome: grupo.nome,
      automaticLimit: Math.max(0, numero(grupo.classificados)),
      dados: vinculos
        .filter((vinculo) => Number(vinculo.grupoId) === Number(grupo.id))
        .sort((a, b) => numero(a.posicao) - numero(b.posicao) || numero(a.equipeId) - numero(b.equipeId))
        .map((vinculo) => porEquipe.get(Number(vinculo.equipeId)))
        .filter((linha): linha is LinhaClassificacao => Boolean(linha)),
    }))
    .filter((grupo) => grupo.dados.length > 0)
}

function linhaDeEntrada(entrada: EntradaBruta, posicao: number, equipeId: number): LinhaClassificacao {
  const equipe = equipePublica(entrada.equipe)
  return {
    posicao,
    pontos: numero(entrada.pontos),
    jogos: numero(entrada.jogos),
    vitorias: numero(entrada.vitorias),
    derrotas: numero(entrada.derrotas),
    setsPro: numero(entrada.setsPro),
    setsContra: numero(entrada.setsContra),
    pontosPro: numero(entrada.pontosPro),
    pontosContra: numero(entrada.pontosContra),
    punicoes: numero(entrada.punicoes),
    equipe: { ...equipe, id: equipe.id || equipeId },
  }
}

function numero(valor: unknown) {
  const lido = Number(valor ?? 0)
  return Number.isFinite(lido) ? lido : 0
}
