import { lerCorpo, sucesso, validar } from '@/lib/meu-time/acesso'
import { rotaElencoOrganizador } from '@/lib/meu-time/elenco'
import { limitarUsuario } from '@/lib/inscricoes-solicitacao/acesso'
import { gravarRegraDaCategoria, lerRegraDaCategoria, regraElencoSchema } from '@/lib/regras-elenco/servico'

export const dynamic = 'force-dynamic'

// GET /api/organizador/categorias/:id/regra-elenco: regra da categoria (sem regra gravada: configurada=false e padrão amador livre).
export const GET = rotaElencoOrganizador<{ id: string }>(async ({ req, organizadorId, params }) => {
  await limitarUsuario(req, 'org-regra-elenco', organizadorId)
  return sucesso(await lerRegraDaCategoria(organizadorId, params.id))
})

// PUT {modelo, atletasMin?, atletasMax?, liberosMax?, nascimentoDe?, nascimentoAte?, documentosExigidos?, comissaoMax?, prazoTrocaEm?,
// exigeConsentimentoMenor?}. Só o dono do campeonato (outro organizador = 404); campeonato finalizado = 409.
// Campos omitidos assumem o padrão do modelo; null limpa o limite.
export const PUT = rotaElencoOrganizador<{ id: string }>(async ({ req, organizadorId, params }) => {
  await limitarUsuario(req, 'org-regra-elenco', organizadorId)
  const entrada = validar(regraElencoSchema, await lerCorpo(req))
  return sucesso(await gravarRegraDaCategoria(organizadorId, params.id, entrada))
})
