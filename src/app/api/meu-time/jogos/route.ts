import { falha, rotaMeuTime, sucesso } from '@/lib/meu-time/acesso'
import { exigirEquipe } from '@/lib/meu-time/dados'
import { limitarUsuario } from '@/lib/inscricoes-solicitacao/acesso'
import { bancoPorSessaoDisponivel, listarJogosDaEquipe } from '@/lib/banco/sessao'

export const dynamic = 'force-dynamic'

// GET /api/meu-time/jogos?equipeId=: jogos de hoje e futuros da equipe nos campeonatos em que ela está inscrita,
// com o atalho para o banco por sessão (/api/banco/sessao/[partidaId]/[equipeId]). Sem PII.
// Flags: BANCO_SESSAO_ATIVO, BANCO_APP_ATIVO e MEU_TIME_ATIVO (qualquer uma desligada = 404).
// Qualquer membro da equipe pode ver os jogos.
export const GET = rotaMeuTime(async ({ req, usuarioId }) => {
  if (!bancoPorSessaoDisponivel()) return falha('Não encontrado.', 404)
  await limitarUsuario(req, 'jogos', usuarioId)
  const { equipe } = await exigirEquipe(usuarioId, new URL(req.url).searchParams.get('equipeId') ?? '', 'leitura')
  return sucesso(await listarJogosDaEquipe(equipe))
})
