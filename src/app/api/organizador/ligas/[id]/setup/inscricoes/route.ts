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
import { getDefaultFormularioInscricaoConfig } from '@/lib/championship-setup-defaults'
import { validateQrPhotoNameDependency } from '@/lib/championship-validation'

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
  return success(liga)
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

  // Dependência obrigatória QR -> nome/foto do atleta, verificada sobre o
  // estado EFETIVO (existente + patch mesclado), nunca só o payload isolado
  // — cobre tanto "liga já tem qrCodeEnabled=true e agora manda foto
  // opcional" quanto "liga já tem foto opcional e agora liga o QR".
  const effectiveQrEnabled = parsed.data.qrCodeEnabled ?? (liga.qrCodeEnabled as boolean | null) ?? false

  const payload: Record<string, unknown> = { ...parsed.data }
  let effectiveFormulario: FormularioConfig

  if (parsed.data.formularioInscricaoConfig !== undefined) {
    effectiveFormulario = mergeFormularioConfig(liga.formularioInscricaoConfig, parsed.data.formularioInscricaoConfig)
    payload.formularioInscricaoConfig = effectiveFormulario
  } else if (!liga.formularioInscricaoConfig) {
    // Primeira vez que a seção é tocada e nenhum formulário foi enviado:
    // semeia o default (já consistente com a dependência do QR) em vez de
    // rejeitar por falta de configuração que o organizador nem chegou a
    // decidir ainda.
    effectiveFormulario = getDefaultFormularioInscricaoConfig()
    payload.formularioInscricaoConfig = effectiveFormulario
  } else {
    effectiveFormulario = liga.formularioInscricaoConfig as FormularioConfig
  }

  const qrIssues = validateQrPhotoNameDependency(effectiveQrEnabled, effectiveFormulario.atleta)
  if (qrIssues.length > 0) {
    return error(qrIssues[0].message, 422, qrIssues)
  }

  const intent = readSetupIntent(req)
  const applied = await applySectionPatch({
    ligaId,
    section: 'inscricoes',
    intent,
    liga,
    patch: payload,
    columns: COLUMNS,
    errorMessage: 'Erro ao salvar as inscrições do campeonato.',
  })
  if (applied instanceof Response) return applied

  const finalized = await finalizeSectionPatch({ ligaId, section: 'inscricoes', intent, ligaAfterPatch: applied.data })

  return success({ ...applied.data, setupStatus: finalized.setupStatus, issues: finalized.issues })
}
