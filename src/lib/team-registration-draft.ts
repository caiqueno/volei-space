import { randomUUID } from 'crypto'
import { normalizarNomeEquipe } from '@/lib/nome-equipe'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import {
  formularioDaInscricao,
  isFieldRequired,
  pendenciasDoAtleta,
  resolveFormularioRapidaConfig,
  resolveInscricaoCategoria,
} from '@/lib/inscricao-rapida'
import { ensureClassificationAndCalendar } from '@/lib/championship-operations'
import { registrarEventoInscricao } from '@/lib/link-inscricao-campeonato'
import { slugify } from '@/utils/slug'
import { mensagemDuplicataNaCategoria } from '@/lib/atleta-duplicado-consulta'
import {
  colunaElegibilidadeAusente,
  elegibilidadeAtiva,
  mensagemElegibilidade,
  normalizarElegibilidade,
  sexoAtleta,
  type ElegibilidadeCategoria,
} from '@/lib/elegibilidade-categoria'

export type RegistrationDraftStatus = 'NAO_INICIADO' | 'EM_PREENCHIMENTO' | 'CONCLUIDO' | 'RASCUNHO' | 'ENVIADA'

function inscricaoConcluida(status: string) {
  return status === 'CONCLUIDO' || status === 'ENVIADA'
}

function inscricaoAberta(status: string) {
  return status === 'NAO_INICIADO' || status === 'EM_PREENCHIMENTO' || status === 'RASCUNHO'
}

export type RegistrationLeague = {
  id: number
  nome: string
  nomeCurto?: string | null
  status: string
  inscricoesAbertas: boolean | null
  inscricoesAberturaEm: string | null
  inscricoesEncerramentoEm: string | null
  inscricaoAprovacaoAutomatica: boolean | null
  inscricaoPermiteEdicaoAposEnvio: boolean | null
  inscricaoPrazoEdicaoDias: number | null
  elencoQuantidadeMinima: number | null
  elencoQuantidadeMaxima: number | null
  elencoCadastroDuranteInscricao: boolean | null
  elencoCadastroAposAprovacao: boolean | null
  prazoAlteracaoElencoDias: number | null
  quantidadeEquipes: number | null
  formularioInscricaoConfig: unknown
  categoriasConfig: string | null
}

export type RegistrationPlayer = {
  id: string | number
  nome: string
  numero: number | null
  posicao: string | null
  fotoUrl: string | null
  cpf: string | null
  dataNascimento: string | null
  documentoTipo: string | null
  documentoNumero: string | null
  sexo?: string | null
}

export type RegistrationDraft = {
  id: string
  token: string
  ligaId: number
  nomeEquipe: string
  logoUrl: string | null
  lider: string | null
  tecnico: string | null
  categoria: string | null
  serie: string | null
  categoriaCampeonatoId?: string | null
  status: RegistrationDraftStatus
  equipeId: number | null
  inscricaoCampeonatoId: string | null
  criadaEm: string
  atualizadaEm: string
  enviadaEm: string | null
}

type RuleDecision = { allowed: boolean; reason: string | null }

export class RegistrationDraftError extends Error {
  constructor(message: string, public status = 400, public details?: unknown) {
    super(message)
    this.name = 'RegistrationDraftError'
  }
}

const LEAGUE_COLUMNS = [
  'id', 'nome', 'nomeCurto', 'status', 'inscricoesAbertas', 'inscricoesAberturaEm', 'inscricoesEncerramentoEm',
  'inscricaoAprovacaoAutomatica', 'inscricaoPermiteEdicaoAposEnvio', 'inscricaoPrazoEdicaoDias',
  'elencoQuantidadeMinima', 'elencoQuantidadeMaxima', 'elencoCadastroDuranteInscricao',
  'elencoCadastroAposAprovacao', 'prazoAlteracaoElencoDias', 'quantidadeEquipes',
  'formularioInscricaoConfig', 'categoriasConfig',
].join(',')

export function registrationWindowDecision(liga: Pick<RegistrationLeague, 'status' | 'inscricoesAbertas' | 'inscricoesAberturaEm' | 'inscricoesEncerramentoEm'>, now = new Date()): RuleDecision {
  if (liga.status === 'FINALIZADO') return { allowed: false, reason: 'Este campeonato está finalizado e não aceita novas inscrições.' }
  if (!['EM_BREVE', 'ATIVA'].includes(liga.status)) return { allowed: false, reason: 'Campeonato não está aberto para inscrição.' }
  if (liga.inscricoesAbertas === false) return { allowed: false, reason: 'As inscrições deste campeonato estão fechadas.' }
  if (liga.inscricoesAberturaEm && now < new Date(liga.inscricoesAberturaEm)) return { allowed: false, reason: 'As inscrições ainda não foram abertas.' }
  if (liga.inscricoesEncerramentoEm && now > new Date(liga.inscricoesEncerramentoEm)) return { allowed: false, reason: 'O prazo de inscrição foi encerrado.' }
  return { allowed: true, reason: null }
}

function withinDays(date: string | null, days: number | null, now: Date): boolean {
  if (!date || days == null) return true
  const deadline = new Date(date)
  deadline.setUTCDate(deadline.getUTCDate() + days)
  return now <= deadline
}

export function canEditRegistration(draft: RegistrationDraft, liga: RegistrationLeague, now = new Date()): RuleDecision {
  if (inscricaoAberta(draft.status)) return registrationWindowDecision(liga, now)
  if (!liga.inscricaoPermiteEdicaoAposEnvio) return { allowed: false, reason: 'O organizador não permite editar a inscrição após o envio.' }
  if (!withinDays(draft.enviadaEm, liga.inscricaoPrazoEdicaoDias, now)) return { allowed: false, reason: 'O prazo para editar esta inscrição terminou.' }
  return { allowed: true, reason: null }
}

export function canEditRoster(draft: RegistrationDraft, liga: RegistrationLeague, registrationStatus: string | null, now = new Date()): RuleDecision {
  const registration = canEditRegistration(draft, liga, now)
  if (!registration.allowed) return registration
  if (inscricaoAberta(draft.status) && liga.elencoCadastroDuranteInscricao === false) {
    return { allowed: false, reason: 'O cadastro de atletas durante a inscrição está desabilitado.' }
  }
  if (inscricaoConcluida(draft.status) && registrationStatus === 'APROVADA' && liga.elencoCadastroAposAprovacao === false) {
    return { allowed: false, reason: 'O elenco não pode ser alterado após a aprovação.' }
  }
  if (inscricaoConcluida(draft.status) && !withinDays(draft.enviadaEm, liga.prazoAlteracaoElencoDias, now)) {
    return { allowed: false, reason: 'O prazo para alterar o elenco terminou.' }
  }
  return { allowed: true, reason: null }
}

async function getLeague(ligaId: number): Promise<RegistrationLeague> {
  const { data, error } = await supabase.from('Liga').select(LEAGUE_COLUMNS).eq('id', ligaId).maybeSingle()
  if (error) throw error
  if (!data) throw new RegistrationDraftError('Campeonato não encontrado.', 404)
  return data as unknown as RegistrationLeague
}

async function getDraft(token: string): Promise<RegistrationDraft> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token)) {
    throw new RegistrationDraftError('Link de inscrição inválido ou inexistente.', 404)
  }
  const { data, error } = await supabase.from('InscricaoEquipeRascunho').select('*').eq('token', token).maybeSingle()
  if (error) throw error
  if (!data) throw new RegistrationDraftError('Link de inscrição inválido ou inexistente.', 404)
  return data as unknown as RegistrationDraft
}

async function getRegistrationStatus(id: string | null): Promise<string | null> {
  if (!id) return null
  const { data, error } = await supabase.from('InscricaoCampeonato').select('status').eq('id', id).maybeSingle()
  if (error) throw error
  return data?.status ?? null
}

export async function createRegistrationDraft(input: { ligaId?: number; linkToken?: string | null; tokenCategoria?: string | null; nomeEquipe: string; categoria?: string | null; serie?: string | null }) {
  input = { ...input, nomeEquipe: normalizarNomeEquipe(input.nomeEquipe) }
  let ligaId = input.ligaId
  let categoriaForcada: { id: string; codigo: string } | null = null
  if (input.tokenCategoria) {
    const { data: categoriaDoLink, error: categoriaDoLinkErr } = await supabase
      .from('CategoriaCampeonato')
      .select('id,ligaId,codigo')
      .eq('tokenInscricao', input.tokenCategoria)
      .is('removidaEm', null)
      .maybeSingle()
    if (categoriaDoLinkErr || !categoriaDoLink) throw new RegistrationDraftError('Este link de categoria não está disponível.', 404)
    ligaId = categoriaDoLink.ligaId
    categoriaForcada = { id: categoriaDoLink.id, codigo: categoriaDoLink.codigo }
  } else if (input.linkToken) {
    const { data: link, error: linkErr } = await supabase.from('LinkInscricaoCampeonato').select('id,ligaId,ativo,revogadoEm').eq('token', input.linkToken).maybeSingle()
    if (linkErr || !link || !link.ativo || link.revogadoEm) throw new RegistrationDraftError('As inscrições para este campeonato estão encerradas ou temporariamente indisponíveis.', 403)
    ligaId = link.ligaId
  }
  if (!ligaId) throw new RegistrationDraftError('Informe o campeonato.', 422)
  const liga = await getLeague(ligaId)
  const { data: mesmaEquipe } = await supabase.from('Equipe').select('id').eq('ligaId', liga.id).ilike('nome', input.nomeEquipe.trim()).limit(1)
  if (mesmaEquipe && mesmaEquipe.length > 0) throw new RegistrationDraftError('Esta equipe já está inscrita neste campeonato.', 409)
  const window = registrationWindowDecision(liga)
  if (!window.allowed) throw new RegistrationDraftError(window.reason || 'Inscrições indisponíveis.', 403)
  if (liga.quantidadeEquipes != null) {
    const { count, error } = await supabase.from('InscricaoCampeonato').select('id', { count: 'exact', head: true }).eq('ligaId', liga.id).eq('status', 'APROVADA')
    if (error) throw error
    if ((count ?? 0) >= liga.quantidadeEquipes) throw new RegistrationDraftError('O limite de equipes aprovadas deste campeonato já foi atingido.', 409)
  }

  const fixed = resolveInscricaoCategoria(liga).categoriaFixa
  const categoria = categoriaForcada ? categoriaForcada.codigo : fixed ? fixed.categoria : input.categoria || null
  if (!categoria) throw new RegistrationDraftError('Selecione a categoria do campeonato.', 422)
  let categoriaRow = categoriaForcada
  if (!categoriaRow) {
    const { data, error: categoriaErr } = await supabase
      .from('CategoriaCampeonato')
      .select('id,codigo')
      .eq('ligaId', ligaId)
      .eq('codigo', categoria)
      .is('removidaEm', null)
      .maybeSingle()
    if (categoriaErr) throw categoriaErr
    categoriaRow = data
  }
  if (!categoriaRow) throw new RegistrationDraftError('Esta categoria não está disponível no campeonato.', 422)
  const { data, error } = await supabase.from('InscricaoEquipeRascunho').insert({
    ligaId,
    nomeEquipe: input.nomeEquipe,
    categoria,
    serie: null,
    categoriaCampeonatoId: categoriaRow.id,
    status: 'NAO_INICIADO',
  }).select('*').single()
  if (error) throw error
  return data as unknown as RegistrationDraft
}

const COLUNAS_ATLETA = 'id,nome,numero,posicao,fotoUrl,cpf,dataNascimento,documentoTipo,documentoNumero'
let elegibilidadeIndisponivelAte = 0

export async function lerElegibilidadeDaCategoria(ligaId: number, categoriaCampeonatoId: string | null | undefined): Promise<ElegibilidadeCategoria | null> {
  if (!categoriaCampeonatoId) return null
  if (Date.now() < elegibilidadeIndisponivelAte) return null
  const consulta = await supabase
    .from('CategoriaConfiguracao')
    .select('genero,idadeMinima,idadeMaxima')
    .eq('ligaId', ligaId)
    .eq('categoriaCampeonatoId', categoriaCampeonatoId)
    .maybeSingle()
  if (consulta.error) {
    if (colunaElegibilidadeAusente(consulta.error)) {
      elegibilidadeIndisponivelAte = Date.now() + 10 * 60 * 1000
      return null
    }
    throw new Error(consulta.error.message)
  }
  return normalizarElegibilidade(consulta.data)
}

export async function lerFormularioDaCategoria(ligaId: number, categoriaCampeonatoId: string | null | undefined) {
  if (!categoriaCampeonatoId) return null
  const consulta = await supabase
    .from('CategoriaConfiguracao')
    .select('formularioInscricaoConfig')
    .eq('ligaId', ligaId)
    .eq('categoriaCampeonatoId', categoriaCampeonatoId)
    .maybeSingle()
  if (consulta.error) {
    const texto = `${consulta.error.code ?? ''} ${consulta.error.message ?? ''}`
    if (/formularioInscricaoConfig|42703|PGRST204/i.test(texto)) return null
    throw new Error(consulta.error.message)
  }
  return consulta.data?.formularioInscricaoConfig ?? null
}

export async function getRegistrationDraftByToken(token: string) {
  const draft = await getDraft(token)
  const lida = await getLeague(draft.ligaId)
  const daCategoria = await lerFormularioDaCategoria(draft.ligaId, draft.categoriaCampeonatoId)
  const elegibilidade = await lerElegibilidadeDaCategoria(draft.ligaId, draft.categoriaCampeonatoId)
  const liga = { ...lida, formularioInscricaoConfig: formularioDaInscricao(lida.formularioInscricaoConfig, daCategoria) }
  const registrationStatus = await getRegistrationStatus(draft.inscricaoCampeonatoId)
  const edit = canEditRegistration(draft, liga)
  const rosterEdit = canEditRoster(draft, liga, registrationStatus)

  let team = draft
  let players: RegistrationPlayer[] = []
  if (inscricaoConcluida(draft.status) && draft.equipeId) {
    const [{ data: equipe, error: equipeError }, jogadores] = await Promise.all([
      supabase.from('Equipe').select('nome,logoUrl,lider,tecnico,categoria,serie').eq('id', draft.equipeId).single(),
      listarAtletas(elegibilidade, (colunas) => supabase.from('Jogador').select(colunas).eq('equipeId', draft.equipeId).eq('banido', false).order('criadoEm') as unknown as Promise<{ data: RegistrationPlayer[] | null; error: { message?: string; code?: string; details?: string } | null }>),
    ])
    if (equipeError) throw equipeError
    team = {
      ...draft,
      nomeEquipe: equipe.nome,
      logoUrl: equipe.logoUrl,
      lider: equipe.lider,
      tecnico: equipe.tecnico,
      categoria: equipe.categoria,
      serie: equipe.serie,
    }
    players = jogadores
  } else {
    players = await listarAtletas(elegibilidade, (colunas) => (
      supabase.from('InscricaoEquipeJogadorRascunho').select(colunas).eq('inscricaoRascunhoId', draft.id).order('criadoEm') as unknown as Promise<{ data: RegistrationPlayer[] | null; error: { message?: string; code?: string; details?: string } | null }>
    ))
  }

  return { draft: team, liga, players, elegibilidade, registrationStatus, canEdit: edit.allowed, canEditRoster: rosterEdit.allowed, readOnlyReason: edit.reason || rosterEdit.reason }
}

function colunasDoAtleta(elegibilidade: ElegibilidadeCategoria | null) {
  return elegibilidadeAtiva(elegibilidade) ? `${COLUNAS_ATLETA},sexo` : COLUNAS_ATLETA
}

async function listarAtletas(
  elegibilidade: ElegibilidadeCategoria | null,
  consultar: (colunas: string) => PromiseLike<{ data: RegistrationPlayer[] | null; error: { message?: string; code?: string; details?: string } | null }>,
) {
  const primeira = await consultar(colunasDoAtleta(elegibilidade))
  if (primeira.error && elegibilidadeAtiva(elegibilidade) && colunaElegibilidadeAusente(primeira.error)) {
    const segunda = await consultar(COLUNAS_ATLETA)
    if (segunda.error) throw new Error(segunda.error.message)
    return segunda.data ?? []
  }
  if (primeira.error) throw new Error(primeira.error.message)
  return primeira.data ?? []
}

export function mascararCpf(cpf: string | null) {
  if (!cpf?.trim()) return null
  const digitos = cpf.replace(/\D/g, '')
  const fim = digitos.slice(-2).padStart(2, '*')
  return `***.***.***-${fim}`
}

export function mascararNascimento(valor: string | null) {
  if (!valor) return null
  return '****-**-**'
}

export function mascararLeituraInscricao<T extends { players: RegistrationPlayer[] }>(contexto: T): T {
  return {
    ...contexto,
    players: contexto.players.map((player) => ({
      ...player,
      cpf: mascararCpf(player.cpf),
      dataNascimento: mascararNascimento(player.dataNascimento),
    })),
  }
}

export async function updateRegistrationDraft(token: string, patch: Record<string, unknown>) {
  if ('nomeEquipe' in patch && typeof patch.nomeEquipe === 'string') patch.nomeEquipe = normalizarNomeEquipe(patch.nomeEquipe)
  const context = await getRegistrationDraftByToken(token)
  if (!context.canEdit) throw new RegistrationDraftError(context.readOnlyReason || 'Edição não permitida.', 403)
  if (context.draft.categoriaCampeonatoId) {
    delete patch.categoria
    delete patch.serie
  }
  if ('categoria' in patch || 'serie' in patch) {
    const categoria = String(patch.categoria ?? context.draft.categoria ?? '')
    const serie = String(patch.serie ?? context.draft.serie ?? '')
    const resolved = resolveInscricaoCategoria(context.liga)
    const allowed = resolved.categoriaFixa ? [resolved.categoriaFixa] : resolved.categoriaOptions
    if (!allowed.some((option) => option.categoria === categoria && option.serie === serie)) {
      throw new RegistrationDraftError('Selecione uma categoria válida para este campeonato.', 422)
    }
  }

  if (inscricaoConcluida(context.draft.status) && context.draft.equipeId) {
    const map: Record<string, unknown> = {}
    const config = resolveFormularioRapidaConfig(context.liga.formularioInscricaoConfig)
    if ('nomeEquipe' in patch) map.nome = patch.nomeEquipe
    if ('logoUrl' in patch && config.equipe.logo !== 'disabled') map.logoUrl = patch.logoUrl
    if ('lider' in patch && config.lider.nomeCompleto !== 'disabled') map.lider = patch.lider
    if ('tecnico' in patch) map.tecnico = patch.tecnico
    const { error } = await supabase.from('Equipe').update(map).eq('id', context.draft.equipeId)
    if (error?.code === '23505') throw new RegistrationDraftError('Já existe uma equipe cadastrada com esse nome nesta categoria/série.', 409)
    if (error) throw error
  } else {
    const { error } = await supabase.from('InscricaoEquipeRascunho').update(patch).eq('id', context.draft.id).in('status', ['NAO_INICIADO', 'EM_PREENCHIMENTO', 'RASCUNHO'])
    if (error) throw error
  }
  return getRegistrationDraftByToken(token)
}

function playerPayload(input: Record<string, unknown>) {
  return {
    ...(input.nome !== undefined ? { nome: input.nome } : {}),
    ...(input.numero !== undefined ? { numero: input.numero ?? null } : {}),
    ...(input.posicao !== undefined ? { posicao: input.posicao || null } : {}),
    ...(input.fotoUrl !== undefined ? { fotoUrl: input.fotoUrl || null } : {}),
    ...(input.cpf !== undefined ? { cpf: input.cpf || null } : {}),
    ...(input.dataNascimento !== undefined ? { dataNascimento: input.dataNascimento || null } : {}),
    ...(input.documentoTipo !== undefined ? { documentoTipo: input.documentoTipo || null } : {}),
    ...(input.documentoNumero !== undefined ? { documentoNumero: input.documentoNumero || null } : {}),
    ...(input.sexo !== undefined ? { sexo: sexoAtleta(input.sexo) } : {}),
  }
}

function configuredPlayerPayload(input: Record<string, unknown>, liga: RegistrationLeague) {
  const payload = playerPayload(input)
  const config = resolveFormularioRapidaConfig(liga.formularioInscricaoConfig)
  if (config.atleta.numeroCamisa === 'disabled') delete payload.numero
  if (config.atleta.posicao === 'disabled') delete payload.posicao
  if (config.atleta.foto === 'disabled') delete payload.fotoUrl
  if (config.atleta.cpf === 'disabled') delete payload.cpf
  if (config.atleta.dataNascimento === 'disabled') delete payload.dataNascimento
  if (config.atleta.documento === 'disabled') {
    delete payload.documentoTipo
    delete payload.documentoNumero
  }
  return payload
}

async function editableRosterContext(token: string) {
  const context = await getRegistrationDraftByToken(token)
  if (!context.canEditRoster) throw new RegistrationDraftError(context.readOnlyReason || 'Alteração de elenco não permitida.', 403)
  return context
}

function assertRosterPlayer(input: Record<string, unknown>, context: Awaited<ReturnType<typeof getRegistrationDraftByToken>>, playerId?: string) {
  const current = playerId ? context.players.find((player) => String(player.id) === String(playerId)) : undefined
  const numero = input.numero !== undefined ? input.numero : current?.numero
  if (numero != null && numero !== '' && context.players.some((player) => String(player.id) !== String(playerId ?? '') && player.numero === Number(numero))) {
    throw new RegistrationDraftError('Já existe um jogador ativo com esse número nesta equipe.', 409)
  }
}

function exigirAtletaConfigurado(input: Record<string, unknown>, liga: RegistrationLeague, elegibilidade: ElegibilidadeCategoria | null, atual?: RegistrationPlayer) {
  const config = resolveFormularioRapidaConfig(liga.formularioInscricaoConfig)
  const nascimento = input.dataNascimento !== undefined ? input.dataNascimento : atual?.dataNascimento
  const documento = input.documentoNumero !== undefined ? input.documentoNumero : atual?.documentoNumero
  const sexo = input.sexo !== undefined ? input.sexo : atual?.sexo
  const pendencias = pendenciasDoAtleta({
    dataNascimento: nascimento == null ? null : String(nascimento),
    documentoNumero: documento == null ? null : String(documento),
  }, config)
  const elegibilidadeMsg = mensagemElegibilidade(elegibilidade, {
    sexo: sexo == null ? null : String(sexo),
    dataNascimento: nascimento == null ? null : String(nascimento),
  })
  if (elegibilidadeMsg) pendencias.push(elegibilidadeMsg)
  if (pendencias.length) throw new RegistrationDraftError(pendencias[0], 422, pendencias)
}

export async function createRegistrationPlayer(token: string, input: Record<string, unknown>) {
  const context = await editableRosterContext(token)
  assertRosterPlayer(input, context)
  exigirAtletaConfigurado(input, context.liga, context.elegibilidade)
  await recusarDuplicata(context, input)
  const maximum = context.liga.elencoQuantidadeMaxima
  if (maximum != null && context.players.length >= maximum) throw new RegistrationDraftError(`O elenco permite no máximo ${maximum} jogadores.`, 422)
  const concluida = inscricaoConcluida(context.draft.status)
  const target = concluida ? 'Jogador' : 'InscricaoEquipeJogadorRascunho'
  const data = await gravarAtleta(target, 'insert', configuredPlayerPayload(input, context.liga), concluida
    ? { equipeId: context.draft.equipeId }
    : { inscricaoRascunhoId: context.draft.id })
  if (!data) throw new RegistrationDraftError('Não foi possível salvar o jogador.', 500)
  return data
}

export async function updateRegistrationPlayer(token: string, playerId: string, input: Record<string, unknown>) {
  const context = await editableRosterContext(token)
  assertRosterPlayer(input, context, playerId)
  exigirAtletaConfigurado(input, context.liga, context.elegibilidade, context.players.find((player) => String(player.id) === String(playerId)))
  await recusarDuplicata(context, input, playerId)
  const target = inscricaoConcluida(context.draft.status) ? 'Jogador' : 'InscricaoEquipeJogadorRascunho'
  const data = await gravarAtleta(target, 'update', configuredPlayerPayload(input, context.liga), {
    id: playerId,
    equipeId: context.draft.equipeId,
    inscricaoRascunhoId: context.draft.id,
  })
  if (!data) throw new RegistrationDraftError('Jogador não encontrado nesta inscrição.', 404)
  return data
}

async function gravarAtleta(
  target: 'Jogador' | 'InscricaoEquipeJogadorRascunho',
  operacao: 'insert' | 'update',
  payload: Record<string, unknown>,
  extra: { id?: string | number | true; equipeId?: number | null; inscricaoRascunhoId?: string },
) {
  const tentar = async (corpo: Record<string, unknown>) => {
    const colunas = 'sexo' in corpo ? `${COLUNAS_ATLETA},sexo` : COLUNAS_ATLETA
    if (operacao === 'insert') {
      return supabase.from(target).insert({ ...corpo, ...semId(extra) }).select(colunas).single()
    }
    let query = supabase.from(target).update(corpo).eq('id', extra.id as string | number)
    query = target === 'Jogador'
      ? query.eq('equipeId', extra.equipeId as number)
      : query.eq('inscricaoRascunhoId', extra.inscricaoRascunhoId as string)
    return query.select(colunas).maybeSingle()
  }
  let resultado = await tentar(payload)
  if (resultado.error && 'sexo' in payload && colunaElegibilidadeAusente(resultado.error)) {
    const semSexo = { ...payload }
    delete semSexo.sexo
    resultado = await tentar(semSexo)
  }
  if (resultado.error?.code === '23505') throw new RegistrationDraftError('Já existe um jogador ativo com esse número nesta equipe.', 409)
  if (resultado.error) throw resultado.error
  return resultado.data as RegistrationPlayer | null
}

function semId(extra: { equipeId?: number | null; inscricaoRascunhoId?: string }) {
  return extra.equipeId != null
    ? { equipeId: extra.equipeId, autoRegistrado: true }
    : { inscricaoRascunhoId: extra.inscricaoRascunhoId }
}

export async function deleteRegistrationPlayer(token: string, playerId: string) {
  const context = await editableRosterContext(token)
  const minimum = context.liga.elencoQuantidadeMinima
  if (inscricaoConcluida(context.draft.status) && minimum != null && context.players.length <= minimum) {
    throw new RegistrationDraftError(`O elenco precisa manter ao menos ${minimum} jogadores.`, 422)
  }
  const target = inscricaoConcluida(context.draft.status) ? 'Jogador' : 'InscricaoEquipeJogadorRascunho'
  let query = supabase.from(target).delete().eq('id', playerId)
  query = inscricaoConcluida(context.draft.status)
    ? query.eq('equipeId', context.draft.equipeId as number)
    : query.eq('inscricaoRascunhoId', context.draft.id)
  const { data, error } = await query.select('id').maybeSingle()
  if (error) throw error
  if (!data) throw new RegistrationDraftError('Jogador não encontrado nesta inscrição.', 404)
}

async function recusarDuplicata(
  context: Awaited<ReturnType<typeof getRegistrationDraftByToken>>,
  input: Record<string, unknown>,
  playerId?: string,
) {
  const atual = playerId ? context.players.find((player) => String(player.id) === String(playerId)) : undefined
  const documento = input.documentoNumero !== undefined ? input.documentoNumero : atual?.documentoNumero
  const nascimento = input.dataNascimento !== undefined ? input.dataNascimento : atual?.dataNascimento
  const nome = input.nome !== undefined ? input.nome : atual?.nome
  const aviso = await mensagemDuplicataNaCategoria({
    ligaId: context.liga.id,
    categoriaCampeonatoId: context.draft.categoriaCampeonatoId,
    equipeId: context.draft.equipeId,
    rascunhoId: context.draft.id,
    nome: nome == null ? null : String(nome),
    dataNascimento: nascimento == null ? null : String(nascimento),
    documentoNumero: documento == null ? null : String(documento),
  })
  if (aviso) throw new RegistrationDraftError(aviso, 422)
}

function validateFinalData(context: Awaited<ReturnType<typeof getRegistrationDraftByToken>>) {
  const { draft, liga, players } = context
  const config = resolveFormularioRapidaConfig(liga.formularioInscricaoConfig)
  const issues: string[] = []
  if (!draft.nomeEquipe.trim()) issues.push('Nome da equipe é obrigatório.')
  if (isFieldRequired(config.equipe.logo) && !draft.logoUrl) issues.push('Logo da equipe é obrigatório.')
  if (isFieldRequired(config.lider.nomeCompleto) && !draft.lider) issues.push('Nome do líder é obrigatório.')
  if (!draft.categoriaCampeonatoId) {
    const resolved = resolveInscricaoCategoria(liga)
    const allowed = resolved.categoriaFixa ? [resolved.categoriaFixa] : resolved.categoriaOptions
    if (!allowed.some((option) => option.categoria === draft.categoria && option.serie === draft.serie)) issues.push('Selecione uma categoria válida para este campeonato.')
  }
  if (players.length === 0) issues.push('Cadastre ao menos um jogador.')
  if (liga.elencoQuantidadeMinima != null && players.length < liga.elencoQuantidadeMinima) issues.push(`Cadastre ao menos ${liga.elencoQuantidadeMinima} jogadores.`)
  if (liga.elencoQuantidadeMaxima != null && players.length > liga.elencoQuantidadeMaxima) issues.push(`O elenco permite no máximo ${liga.elencoQuantidadeMaxima} jogadores.`)
  players.forEach((player, index) => {
    const label = `Jogador ${index + 1} (${player.nome || 'sem nome'})`
    if (isFieldRequired(config.atleta.numeroCamisa) && player.numero == null) issues.push(`${label}: número da camisa é obrigatório.`)
    if (isFieldRequired(config.atleta.posicao) && !player.posicao) issues.push(`${label}: posição é obrigatória.`)
    if (isFieldRequired(config.atleta.cpf) && !player.cpf) issues.push(`${label}: CPF é obrigatório.`)
    for (const pendencia of pendenciasDoAtleta(player, config)) issues.push(`${label}: ${pendencia}`)
    const elegibilidadeMsg = mensagemElegibilidade(context.elegibilidade, player)
    if (elegibilidadeMsg) issues.push(`${label}: ${elegibilidadeMsg}`)
  })
  if (issues.length) throw new RegistrationDraftError('Não foi possível concluir o cadastro.', 422, issues)
}

async function uniqueTeamSlug(name: string) {
  const base = slugify(name) || 'equipe'
  const { data, error } = await supabase.from('Equipe').select('slug').like('slug', `${base}%`)
  if (error) throw error
  const existing = new Set((data ?? []).map((item) => item.slug).filter(Boolean))
  if (!existing.has(base)) return base
  let suffix = 2
  while (existing.has(`${base}-${suffix}`)) suffix += 1
  return `${base}-${suffix}`
}

async function invalidarTokenInscricao(draftId: string, tokenAtual: string) {
  const { error } = await supabase
    .from('InscricaoEquipeRascunho')
    .update({ token: randomUUID() })
    .eq('id', draftId)
    .eq('token', tokenAtual)
  if (error) throw error
}

export async function finalizeRegistration(token: string) {
  const context = await getRegistrationDraftByToken(token)
  if (inscricaoConcluida(context.draft.status)) {
    if (context.registrationStatus === 'APROVADA' && context.draft.inscricaoCampeonatoId) {
      await ensureApprovedRegistrationOperations(context.draft.inscricaoCampeonatoId)
    }
    await invalidarTokenInscricao(context.draft.id, token)
    return { equipeId: context.draft.equipeId, inscricaoCampeonatoId: context.draft.inscricaoCampeonatoId, status: context.registrationStatus, idempotent: true }
  }
  const window = registrationWindowDecision(context.liga)
  if (!window.allowed) throw new RegistrationDraftError(window.reason || 'Inscrições indisponíveis.', 403)
  const { data: linkAtual } = await supabase.from('LinkInscricaoCampeonato').select('id,ativo,revogadoEm').eq('ligaId', context.liga.id).maybeSingle()
  if (linkAtual && (!linkAtual.ativo || linkAtual.revogadoEm)) throw new RegistrationDraftError('As inscrições para este campeonato estão encerradas ou temporariamente indisponíveis.', 403)
  validateFinalData(context)
  for (const player of context.players) {
    await recusarDuplicata(context, {
      nome: player.nome,
      dataNascimento: player.dataNascimento,
      documentoNumero: player.documentoNumero,
    }, String(player.id))
  }

  const nomeEquipe = normalizarNomeEquipe(context.draft.nomeEquipe)
  if (nomeEquipe !== context.draft.nomeEquipe) {
    const { error: nomeErr } = await supabase.from('InscricaoEquipeRascunho').update({ nomeEquipe }).eq('id', context.draft.id)
    if (nomeErr) throw nomeErr
    context.draft.nomeEquipe = nomeEquipe
  }
  const slug = await uniqueTeamSlug(nomeEquipe)
  const { data, error } = await supabase.rpc('finalizar_inscricao_equipe_rascunho', { p_token: token, p_slug: slug })
  if (error) {
    if (error.code === '23505') throw new RegistrationDraftError('Já existe uma equipe cadastrada com esse nome nesta categoria/série.', 409)
    if (['23514', 'P0001'].includes(error.code || '')) throw new RegistrationDraftError(error.message, 422)
    throw error
  }
  const result = data as { equipeId: number; inscricaoCampeonatoId: string; status: string; idempotent: boolean }
  if (result.status === 'APROVADA') {
    await ensureApprovedRegistrationOperations(result.inscricaoCampeonatoId)
  }
  if (!result.idempotent) {
    const { data: link } = await supabase.from('LinkInscricaoCampeonato').select('id').eq('ligaId', context.liga.id).maybeSingle()
    if (link) await registrarEventoInscricao({ ligaId: context.liga.id, linkId: link.id, tipo: 'INSCRICAO_EQUIPE_REALIZADA', resultado: 'ok' })
  }
  await invalidarTokenInscricao(context.draft.id, token)
  return result
}

async function ensureApprovedRegistrationOperations(registrationId: string) {
  const { data: registration, error: registrationError } = await supabase
    .from('InscricaoCampeonato')
    .select('id,ligaId,equipeId,liga:Liga(id,quantidadeEquipes,formato,quantidadeGrupos),equipe:Equipe(id,categoria,serie,nome)')
    .eq('id', registrationId)
    .single()
  if (registrationError) throw registrationError
  await ensureClassificationAndCalendar(registration)
}
