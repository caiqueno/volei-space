import { NextRequest } from 'next/server'
import { success, error } from '@/lib/api-response'
import {
  requireOwnedLigaForSetup,
  applySectionPatch,
  finalizeSectionPatch,
  readJsonBody,
  readSetupIntent,
} from '@/lib/championship-setup-access'
import { setupInformacoesSchema } from '@/lib/schemas'

const COLUMNS = 'id,organizadorId,nome,nomeCurto,subtitulo,descricao,logoUrl,capaUrl,corTematica,status,regulamento,premiacao'

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

  const parsed = setupInformacoesSchema.safeParse(body)
  if (!parsed.success) return error('Dados inválidos', 422, parsed.error.flatten())

  const patch = { ...parsed.data }
  const curto = String(patch.nomeCurto ?? liga.nomeCurto ?? '').trim()
  const nomePedido = String(patch.nome ?? '').trim()
  if (curto && curto !== 'Novo campeonato' && (nomePedido === 'Novo campeonato' || liga.nome === 'Novo campeonato')) {
    patch.nome = curto
  }

  const intent = readSetupIntent(req)
  const applied = await applySectionPatch({
    ligaId,
    section: 'informacoes',
    intent,
    liga,
    patch,
    columns: COLUMNS,
    errorMessage: 'Erro ao salvar informações do campeonato.',
  })
  if (applied instanceof Response) return applied

  const finalized = await finalizeSectionPatch({ ligaId, section: 'informacoes', intent, ligaAfterPatch: applied.data })

  return success({ ...applied.data, setupStatus: finalized.setupStatus, issues: finalized.issues })
}
