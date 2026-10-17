// Configuração das inscrições da Central de Parametrização. NÃO existe
// lista de espera aqui de propósito (fora de escopo desta refatoração) — o
// limite continua sendo Liga.quantidadeEquipes, já reaproveitado pelo fluxo
// existente de aprovação em src/app/api/inscricoes-campeonato/route.ts.
import { NextRequest } from 'next/server'
import { success, error } from '@/lib/api-response'
import {
  requireOwnedLigaForSetup,
  applySectionPatch,
  finalizeSectionPatch,
  readJsonBody,
  readSetupIntent,
} from '@/lib/championship-setup-access'
import { setupInscricoesSchema } from '@/lib/schemas'
import { categoryIdFromRequest, loadCategorySection, saveCategorySection } from '@/lib/category-setup-delegate'
import { separarElegibilidade } from '@/lib/elegibilidade-categoria'
import { CategoryScopeError, getCategoryConfiguration } from '@/lib/category-scope'
import { getDefaultFormularioInscricaoConfig } from '@/lib/championship-setup-defaults'
import { validateQrPhotoNameDependency } from '@/lib/championship-validation'
import { rejectIfCampeonatoFinalizado } from '@/lib/championship-finalization'
import { gravarVisibilidadeDaLiga, lerVisibilidadeDaLiga } from '@/lib/visibilidade-competicao'

const COLUMNS = 'id,organizadorId,inscricoesAbertas,inscricoesAberturaEm,inscricoesEncerramentoEm,inscricaoAprovacaoAutomatica,inscricaoPermiteEdicaoAposEnvio,inscricaoPrazoEdicaoDias,elencoQuantidadeMinima,elencoQuantidadeMaxima,elencoCadastroDuranteInscricao,elencoCadastroAposAprovacao,qrCodeEnabled,formularioInscricaoConfig,prazoAlteracaoElencoDias'

type FormularioConfig = ReturnType<typeof getDefaultFormularioInscricaoConfig>

// A coluna é jsonb e o UPDATE substitui o valor inteiro, mas
// formularioInscricaoConfigSchema é `.partial()` por grupo: um payload com
// apenas `{ atleta: {...} }` apagaria `equipe` e `lider`. O merge por grupo
// aqui protege contra qualquer cliente que envie só o pedaço que mudou.
function mergeFormularioConfig(atual: unknown, patch: unknown): FormularioConfig {
  const base = (atual && typeof atual === 'object' ? atual : getDefaultFormularioInscricaoConfig()) as FormularioConfig
  if (!patch || typeof patch !== 'object') return base
  const incoming = patch as Partial<FormularioConfig>

  return {
    equipe: { ...base.equipe, ...(incoming.equipe ?? {}) },
    lider: { ...base.lider, ...(incoming.lider ?? {}) },
    atleta: { ...base.atleta, ...(incoming.atleta ?? {}) },
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const liga = await requireOwnedLigaForSetup(req, Number(id), COLUMNS)
  if (liga instanceof Response) return liga
  // A visibilidade é lida à parte: sem a coluna (migration pendente) vale PUBLICA e o resto da leitura não quebra.
  const visibilidade = await lerVisibilidadeDaLiga(Number(id))
  const categoryView = await loadCategorySection(req, Number(id))
  if (categoryView) {
    if (categoryView.status !== 200) return categoryView
    const corpo = (await categoryView.json().catch(() => null)) as { data?: Record<string, unknown> } | null
    if (!corpo || typeof corpo.data !== 'object' || corpo.data === null) return categoryView
    return success({ ...corpo.data, visibilidade })
  }
  return success({ ...liga, visibilidade })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ligaId = Number(id)
  const liga = await requireOwnedLigaForSetup(req, ligaId, COLUMNS)
  if (liga instanceof Response) return liga

  const body = await readJsonBody(req)
  if (!body) return error('Corpo da requisição inválido.', 400)

  const parsed = setupInscricoesSchema.safeParse(body)
  if (!parsed.success) return error('Dados inválidos', 422, parsed.error.flatten())

  // Só a visibilidade no corpo: grava a coluna própria e não toca na seção (nem semeia o formulário).
  if (parsed.data.visibilidade !== undefined && Object.keys(parsed.data).length === 1) {
    const bloqueioFinalizado = await rejectIfCampeonatoFinalizado(ligaId)
    if (bloqueioFinalizado) return bloqueioFinalizado
    const gravada = await gravarVisibilidadeDaLiga(ligaId, parsed.data.visibilidade)
    if (!gravada.ok) return error(gravada.mensagem, gravada.status)
    return success({ ...liga, visibilidade: parsed.data.visibilidade })
  }

  // Dependência obrigatória QR -> nome/foto do atleta, verificada sobre o
  // estado EFETIVO (existente + patch mesclado), nunca só o payload isolado
  // — cobre tanto "liga já tem qrCodeEnabled=true e agora manda foto
  // opcional" quanto "liga já tem foto opcional e agora liga o QR".
  const categoryId = categoryIdFromRequest(req)
  let formBase: unknown = liga.formularioInscricaoConfig
  let qrBase = (liga.qrCodeEnabled as boolean | null) ?? false
  if (categoryId) {
    try {
      const config = await getCategoryConfiguration(ligaId, categoryId)
      formBase = config.formularioInscricaoConfig
      qrBase = config.qrCodeEnabled === true
    } catch (cause) {
      if (cause instanceof CategoryScopeError) return error(cause.message, cause.status)
      return error('Não foi possível carregar a categoria.', 500)
    }
  }

  const effectiveQrEnabled = parsed.data.qrCodeEnabled ?? qrBase

  // Visibilidade é da competição inteira (não da categoria) e tem coluna própria.
  const { visibilidade: visibilidadeNova, ...dadosDaSecao } = parsed.data
  const payload: Record<string, unknown> = { ...dadosDaSecao }
  let effectiveFormulario: FormularioConfig

  if (parsed.data.formularioInscricaoConfig !== undefined) {
    effectiveFormulario = mergeFormularioConfig(formBase, parsed.data.formularioInscricaoConfig)
    payload.formularioInscricaoConfig = effectiveFormulario
  } else if (!formBase) {
    // Primeira vez que a seção é tocada e nenhum formulário foi enviado:
    // semeia o default (já consistente com a dependência do QR) em vez de
    // rejeitar por falta de configuração que o organizador nem chegou a
    // decidir ainda.
    effectiveFormulario = getDefaultFormularioInscricaoConfig()
    payload.formularioInscricaoConfig = effectiveFormulario
  } else {
    effectiveFormulario = formBase as FormularioConfig
  }

  const qrIssues = validateQrPhotoNameDependency(effectiveQrEnabled, effectiveFormulario.atleta)
  if (qrIssues.length > 0) {
    return error(qrIssues[0].message, 422, qrIssues)
  }

  const intent = readSetupIntent(req)
  const categorySave = await saveCategorySection({
    req, ligaId, organizadorId: String(liga.organizadorId), section: 'inscricoes', patch: payload, intent,
  })
  if (categorySave) return categorySave
  const applied = await applySectionPatch({
    ligaId,
    section: 'inscricoes',
    intent,
    liga,
    patch: separarElegibilidade(payload).resto,
    columns: COLUMNS,
    errorMessage: 'Erro ao salvar as inscrições do campeonato.',
  })
  if (applied instanceof Response) return applied

  const finalized = await finalizeSectionPatch({ ligaId, section: 'inscricoes', intent, ligaAfterPatch: applied.data })
  if (finalized instanceof Response) return finalized

  let visibilidade = await lerVisibilidadeDaLiga(ligaId)
  if (visibilidadeNova !== undefined) {
    const gravada = await gravarVisibilidadeDaLiga(ligaId, visibilidadeNova)
    if (!gravada.ok) return error(`${gravada.mensagem} As demais configurações das inscrições foram salvas.`, gravada.status)
    visibilidade = visibilidadeNova
  }

  return success({ ...applied.data, visibilidade, setupStatus: finalized.setupStatus, issues: finalized.issues })
}
