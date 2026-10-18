import { lerCorpo, sucesso, validar } from '@/lib/meu-time/acesso'
import { limitarUsuario, rotaOrganizador } from '@/lib/inscricoes-solicitacao/acesso'
import { gravarModoDaCategoria, lerModoDaCategoria, modoSchema } from '@/lib/inscricoes-solicitacao/servico'

export const dynamic = 'force-dynamic'

// GET/PUT /api/organizador/categorias/:id/inscricao: modo de inscrição da categoria (AUTOMATICA | APROVACAO).
export const GET = rotaOrganizador<{ id: string }>(async ({ req, organizadorId, params }) => {
  await limitarUsuario(req, 'org-modo', organizadorId)
  return sucesso(await lerModoDaCategoria(organizadorId, params.id))
})

export const PUT = rotaOrganizador<{ id: string }>(async ({ req, organizadorId, params }) => {
  await limitarUsuario(req, 'org-modo', organizadorId)
  const entrada = validar(modoSchema, await lerCorpo(req))
  return sucesso(await gravarModoDaCategoria(organizadorId, params.id, entrada.modoInscricao))
})
