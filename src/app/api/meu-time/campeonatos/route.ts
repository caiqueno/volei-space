import { sucesso } from '@/lib/meu-time/acesso'
import { exigirEquipe } from '@/lib/meu-time/dados'
import { limitarUsuario, rotaLider } from '@/lib/inscricoes-solicitacao/acesso'
import { listarCampeonatosDaEquipe } from '@/lib/inscricoes-solicitacao/servico'

export const dynamic = 'force-dynamic'

// GET /api/meu-time/campeonatos?equipeId=: vitrine de campeonatos publicados e abertos para a equipe
// (RESPONSAVEL ou TECNICO). Competição privada só aparece com convite. Atrás de INSCRICAO_SOLICITACAO_ATIVO=1.
export const GET = rotaLider(async ({ req, usuarioId }) => {
  await limitarUsuario(req, 'vitrine', usuarioId)
  const { equipe } = await exigirEquipe(usuarioId, new URL(req.url).searchParams.get('equipeId') ?? '', 'escrita')
  return sucesso(await listarCampeonatosDaEquipe(equipe))
})
