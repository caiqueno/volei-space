import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import {
  isFieldRequired,
  resolveFormularioRapidaConfig,
  resolveInscricaoCategoria,
} from '@/lib/inscricao-rapida'
import { ensureClassificationAndCalendar } from '@/lib/championship-operations'
import { slugify } from '@/utils/slug'

export type RegistrationDraftStatus = 'RASCUNHO' | 'ENVIADA'

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
  if (draft.status === 'RASCUNHO') return registrationWindowDecision(liga, now)
  if (!liga.inscricaoPermiteEdicaoAposEnvio) return { allowed: false, reason: 'O organizador não permite editar a inscrição após o envio.' }
  if (!withinDays(draft.enviadaEm, liga.inscricaoPrazoEdicaoDias, now)) return { allowed: false, reason: 'O prazo para editar esta inscrição terminou.' }
  return { allowed: true, reason: null }
}

export function canEditRoster(draft: RegistrationDraft, liga: RegistrationLeague, registrationStatus: string | null, now = new Date()): RuleDecision {
  const registration = canEditRegistration(draft, liga, now)
  if (!registration.allowed) return registration
  if (draft.status === 'RASCUNHO' && liga.elencoCadastroDuranteInscricao === false) {
    return { allowed: false, reason: 'O cadastro de atletas durante a inscrição está desabilitado.' }
  }
  if (draft.status === 'ENVIADA' && registrationStatus === 'APROVADA' && liga.elencoCadastroAposAprovacao === false) {
    return { allowed: false, reason: 'O elenco não pode ser alterado após a aprovação.' }
  }
  if (draft.status === 'ENVIADA' && !withinDays(draft.enviadaEm, liga.prazoAlteracaoElencoDias, now)) {
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

export async function createRegistrationDraft(input: { ligaId: number; nomeEquipe: string; categoria?: string | null; serie?: string | null }) {
  const liga = await getLeague(input.ligaId)
  const window = registrationWindowDecision(liga)
  if (!window.allowed) throw new RegistrationDraftError(window.reason || 'Inscrições indisponíveis.', 403)
  if (liga.quantidadeEquipes != null) {
    const { count, error } = await supabase.from('InscricaoCampeonato').select('id', { count: 'exact', head: true }).eq('ligaId', liga.id).eq('status', 'APROVADA')
    if (error) throw error
    if ((count ?? 0) >= liga.quantidadeEquipes) throw new RegistrationDraftError('O limite de equipes aprovadas deste campeonato já foi atingido.', 409)
  }

  const fixed = resolveInscricaoCategoria(liga).categoriaFixa
  const categoria = fixed ? fixed.categoria : input.categoria || null
  const serie = fixed ? fixed.serie : input.serie || null
  const { data, error } = await supabase.from('InscricaoEquipeRascunho').insert({
    ligaId: input.ligaId,
    nomeEquipe: input.nomeEquipe,
    categoria,
    serie,
  }).select('*').single()
  if (error) throw error
  return data as unknown as RegistrationDraft
}

export async function getRegistrationDraftByToken(token: string) {
  const draft = await getDraft(token)
  const liga = await getLeague(draft.ligaId)
  const registrationStatus = await getRegistrationStatus(draft.inscricaoCampeonatoId)
  const edit = canEditRegistration(draft, liga)
  const rosterEdit = canEditRoster(draft, liga, registrationStatus)

  let team = draft
  let players: RegistrationPlayer[] = []
  if (draft.status === 'ENVIADA' && draft.equipeId) {
    const [{ data: equipe, error: equipeError }, { data: jogadores, error: jogadoresError }] = await Promise.all([
      supabase.from('Equipe').select('nome,logoUrl,lider,tecnico,categoria,serie').eq('id', draft.equipeId).single(),
      supabase.from('Jogador').select('id,nome,numero,posicao,fotoUrl,cpf,dataNascimento,documentoTipo,documentoNumero').eq('equipeId', draft.equipeId).eq('banido', false).order('criadoEm'),
    ])
    if (equipeError) throw equipeError
    if (jogadoresError) throw jogadoresError
    team = {
      ...draft,
      nomeEquipe: equipe.nome,
      logoUrl: equipe.logoUrl,
      lider: equipe.lider,
      tecnico: equipe.tecnico,
      categoria: equipe.categoria,
      serie: equipe.serie,
    }
    players = (jogadores ?? []) as RegistrationPlayer[]
  } else {
    const { data, error } = await supabase
      .from('InscricaoEquipeJogadorRascunho')
      .select('id,nome,numero,posicao,fotoUrl,cpf,dataNascimento,documentoTipo,documentoNumero')
      .eq('inscricaoRascunhoId', draft.id)
      .order('criadoEm')
    if (error) throw error
    players = (data ?? []) as RegistrationPlayer[]
  }

  return { draft: team, liga, players, registrationStatus, canEdit: edit.allowed, canEditRoster: rosterEdit.allowed, readOnlyReason: edit.reason || rosterEdit.reason }
}

export async function updateRegistrationDraft(token: string, patch: Record<string, unknown>) {
  const context = await getRegistrationDraftByToken(token)
  if (!context.canEdit) throw new RegistrationDraftError(context.readOnlyReason || 'Edição não permitida.', 403)
  if ('categoria' in patch || 'serie' in patch) {
    const categoria = String(patch.categoria ?? context.draft.categoria ?? '')
    const serie = String(patch.serie ?? context.draft.serie ?? '')
    const resolved = resolveInscricaoCategoria(context.liga)
    const allowed = resolved.categoriaFixa ? [resolved.categoriaFixa] : resolved.categoriaOptions
    if (!allowed.some((option) => option.categoria === categoria && option.serie === serie)) {
      throw new RegistrationDraftError('Selecione uma categoria válida para este campeonato.', 422)
    }
  }

  if (context.draft.status === 'ENVIADA' && context.draft.equipeId) {
    const map: Record<string, unknown> = {}
    const config = resolveFormularioRapidaConfig(context.liga.formularioInscricaoConfig)
    if ('nomeEquipe' in patch) map.nome = patch.nomeEquipe
    if ('logoUrl' in patch && config.equipe.logo !== 'disabled') map.logoUrl = patch.logoUrl
    if ('lider' in patch && config.lider.nomeCompleto !== 'disabled') map.lider = patch.lider
    for (const key of ['tecnico', 'categoria', 'serie']) if (key in patch) map[key] = patch[key]
    const { error } = await supabase.from('Equipe').update(map).eq('id', context.draft.equipeId)
    if (error?.code === '23505') throw new RegistrationDraftError('Já existe uma equipe cadastrada com esse nome nesta categoria/série.', 409)
    if (error) throw error
  } else {
    const { error } = await supabase.from('InscricaoEquipeRascunho').update(patch).eq('id', context.draft.id).eq('status', 'RASCUNHO')
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
  const config = resolveFormularioRapidaConfig(context.liga.formularioInscricaoConfig)
  const current = playerId ? context.players.find((player) => String(player.id) === String(playerId)) : undefined
  const numero = input.numero !== undefined ? input.numero : current?.numero
  if (numero != null && numero !== '' && context.players.some((player) => String(player.id) !== String(playerId ?? '') && player.numero === Number(numero))) {
    throw new RegistrationDraftError('Já existe um jogador ativo com esse número nesta equipe.', 409)
  }

  const foto = input.fotoUrl !== undefined ? input.fotoUrl : current?.fotoUrl
  const nascimento = input.dataNascimento !== undefined ? input.dataNascimento : current?.dataNascimento
  const documentoTipo = input.documentoTipo !== undefined ? input.documentoTipo : current?.documentoTipo
  const documentoNumero = input.documentoNumero !== undefined ? input.documentoNumero : current?.documentoNumero
  if (isFieldRequired(config.atleta.foto) && !foto) throw new RegistrationDraftError('Foto do jogador é obrigatória.', 422)
  if (isFieldRequired(config.atleta.dataNascimento) && !nascimento) throw new RegistrationDraftError('Data de nascimento do jogador é obrigatória.', 422)
  if (isFieldRequired(config.atleta.documento) && (!documentoTipo || !documentoNumero)) {
    throw new RegistrationDraftError('Documento do jogador é obrigatório.', 422)
  }
}

export async function createRegistrationPlayer(token: string, input: Record<string, unknown>) {
  const context = await editableRosterContext(token)
  assertRosterPlayer(input, context)
  const maximum = context.liga.elencoQuantidadeMaxima
  if (maximum != null && context.players.length >= maximum) throw new RegistrationDraftError(`O elenco permite no máximo ${maximum} jogadores.`, 422)
  const target = context.draft.status === 'ENVIADA' ? 'Jogador' : 'InscricaoEquipeJogadorRascunho'
  const extra = context.draft.status === 'ENVIADA'
    ? { equipeId: context.draft.equipeId, autoRegistrado: true }
    : { inscricaoRascunhoId: context.draft.id }
  const { data, error } = await supabase.from(target).insert({ ...configuredPlayerPayload(input, context.liga), ...extra }).select('id,nome,numero,posicao,fotoUrl,cpf,dataNascimento,documentoTipo,documentoNumero').single()
  if (error?.code === '23505') throw new RegistrationDraftError('Já existe um jogador ativo com esse número nesta equipe.', 409)
  if (error) throw error
  return data as RegistrationPlayer
}

export async function updateRegistrationPlayer(token: string, playerId: string, input: Record<string, unknown>) {
  const context = await editableRosterContext(token)
  assertRosterPlayer(input, context, playerId)
  const target = context.draft.status === 'ENVIADA' ? 'Jogador' : 'InscricaoEquipeJogadorRascunho'
  let query = supabase.from(target).update(configuredPlayerPayload(input, context.liga)).eq('id', playerId)
  query = context.draft.status === 'ENVIADA'
    ? query.eq('equipeId', context.draft.equipeId as number)
    : query.eq('inscricaoRascunhoId', context.draft.id)
  const { data, error } = await query.select('id,nome,numero,posicao,fotoUrl,cpf,dataNascimento,documentoTipo,documentoNumero').maybeSingle()
  if (error?.code === '23505') throw new RegistrationDraftError('Já existe um jogador ativo com esse número nesta equipe.', 409)
  if (error) throw error
  if (!data) throw new RegistrationDraftError('Jogador não encontrado nesta inscrição.', 404)
  return data as RegistrationPlayer
}

export async function deleteRegistrationPlayer(token: string, playerId: string) {
  const context = await editableRosterContext(token)
  const minimum = context.liga.elencoQuantidadeMinima
  if (context.draft.status === 'ENVIADA' && minimum != null && context.players.length <= minimum) {
    throw new RegistrationDraftError(`O elenco precisa manter ao menos ${minimum} jogadores.`, 422)
  }
  const target = context.draft.status === 'ENVIADA' ? 'Jogador' : 'InscricaoEquipeJogadorRascunho'
  let query = supabase.from(target).delete().eq('id', playerId)
  query = context.draft.status === 'ENVIADA'
    ? query.eq('equipeId', context.draft.equipeId as number)
    : query.eq('inscricaoRascunhoId', context.draft.id)
  const { data, error } = await query.select('id').maybeSingle()
  if (error) throw error
  if (!data) throw new RegistrationDraftError('Jogador não encontrado nesta inscrição.', 404)
}

function validateFinalData(context: Awaited<ReturnType<typeof getRegistrationDraftByToken>>) {
  const { draft, liga, players } = context
  const config = resolveFormularioRapidaConfig(liga.formularioInscricaoConfig)
  const issues: string[] = []
  if (!draft.nomeEquipe.trim()) issues.push('Nome da equipe é obrigatório.')
  if (isFieldRequired(config.equipe.logo) && !draft.logoUrl) issues.push('Logo da equipe é obrigatório.')
  if (isFieldRequired(config.lider.nomeCompleto) && !draft.lider) issues.push('Nome do líder é obrigatório.')
  const resolved = resolveInscricaoCategoria(liga)
  const allowed = resolved.categoriaFixa ? [resolved.categoriaFixa] : resolved.categoriaOptions
  if (!allowed.some((option) => option.categoria === draft.categoria && option.serie === draft.serie)) issues.push('Selecione uma categoria válida para este campeonato.')
  if (players.length === 0) issues.push('Cadastre ao menos um jogador.')
  if (liga.elencoQuantidadeMinima != null && players.length < liga.elencoQuantidadeMinima) issues.push(`Cadastre ao menos ${liga.elencoQuantidadeMinima} jogadores.`)
  if (liga.elencoQuantidadeMaxima != null && players.length > liga.elencoQuantidadeMaxima) issues.push(`O elenco permite no máximo ${liga.elencoQuantidadeMaxima} jogadores.`)
  players.forEach((player, index) => {
    const label = `Jogador ${index + 1} (${player.nome || 'sem nome'})`
    if (isFieldRequired(config.atleta.numeroCamisa) && player.numero == null) issues.push(`${label}: número da camisa é obrigatório.`)
    if (isFieldRequired(config.atleta.posicao) && !player.posicao) issues.push(`${label}: posição é obrigatória.`)
    if (isFieldRequired(config.atleta.foto) && !player.fotoUrl) issues.push(`${label}: foto é obrigatória.`)
    if (isFieldRequired(config.atleta.cpf) && !player.cpf) issues.push(`${label}: CPF é obrigatório.`)
    if (isFieldRequired(config.atleta.dataNascimento) && !player.dataNascimento) issues.push(`${label}: data de nascimento é obrigatória.`)
    if (isFieldRequired(config.atleta.documento) && (!player.documentoTipo || !player.documentoNumero)) issues.push(`${label}: documento é obrigatório.`)
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

export async function finalizeRegistration(token: string) {
  const context = await getRegistrationDraftByToken(token)
  if (context.draft.status === 'ENVIADA') {
    if (context.registrationStatus === 'APROVADA' && context.draft.inscricaoCampeonatoId) {
      await ensureApprovedRegistrationOperations(context.draft.inscricaoCampeonatoId)
    }
    return { equipeId: context.draft.equipeId, inscricaoCampeonatoId: context.draft.inscricaoCampeonatoId, status: context.registrationStatus, idempotent: true }
  }
  const window = registrationWindowDecision(context.liga)
  if (!window.allowed) throw new RegistrationDraftError(window.reason || 'Inscrições indisponíveis.', 403)
  validateFinalData(context)

  const slug = await uniqueTeamSlug(context.draft.nomeEquipe)
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
