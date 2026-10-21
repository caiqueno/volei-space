import { lerCorpo, sucesso, validar } from '@/lib/meu-time/acesso'
import { rotaPainel } from '@/lib/painel-inscricoes/acesso'
import { adicionarMembroDaEquipe, listarEquipe, membroSchema, remocaoSchema, removerMembroDaEquipe } from '@/lib/painel-inscricoes/equipe'

export const dynamic = 'force-dynamic'

// GET: dono e membros da organização (e-mail mascarado). Qualquer papel lê.
export const GET = rotaPainel('equipe-ler', async ({ usuarioId, nome }) => sucesso(await listarEquipe(usuarioId, nome)))

// POST {email, papel:'ADMINISTRADOR'|'FINANCEIRO'|'ARBITRAGEM'}: dono ou ADMINISTRADOR (só o dono concede ADMINISTRADOR).
// Resposta uniforme: não revela se o e-mail tem conta de organizador.
export const POST = rotaPainel('equipe-gravar', async ({ req, usuarioId, nome }) => {
  const entrada = validar(membroSchema, await lerCorpo(req))
  return sucesso(await adicionarMembroDaEquipe(usuarioId, nome, entrada))
})

// DELETE {email} ou {usuarioId}: remove o membro. Membro inexistente = 404.
export const DELETE = rotaPainel('equipe-remover', async ({ req, usuarioId, nome }) => {
  const entrada = validar(remocaoSchema, await lerCorpo(req))
  return sucesso(await removerMembroDaEquipe(usuarioId, nome, entrada))
})
