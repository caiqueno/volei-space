import { idValido, sucesso } from '@/lib/meu-time/acesso'
import { entradaViaMeuTimeAtiva } from '@/lib/inscricao-entrada/resolver'
import { exigirEquipe } from '@/lib/meu-time/dados'
import { limitarUsuario, rotaLider } from '@/lib/inscricoes-solicitacao/acesso'
import { listarCampeonatosDaEquipe } from '@/lib/inscricoes-solicitacao/servico'

export const dynamic = 'force-dynamic'

// GET /api/meu-time/campeonatos?equipeId=: vitrine de campeonatos publicados e abertos para a equipe
// (RESPONSAVEL ou TECNICO). Competição privada só aparece com convite. Atrás de INSCRICAO_SOLICITACAO_ATIVO=1.
export const GET = rotaLider(async ({ req, usuarioId }) => {
  await limitarUsuario(req, 'vitrine', usuarioId)
  const consulta = new URL(req.url).searchParams
  const { equipe } = await exigirEquipe(usuarioId, consulta.get('equipeId') ?? '', 'escrita')
  // Porta de entrada (R15): `convite` (+ `categoriaId` opcional) libera na vitrine a competição privada do link.
  // Só vale com INSCRICAO_VIA_MEU_TIME_ATIVO=1; desligada, os parâmetros são ignorados e nada muda.
  const convite = entradaViaMeuTimeAtiva() ? (consulta.get('convite') ?? '').trim().slice(0, 200) : ''
  const categoriaId = convite ? consulta.get('categoriaId') : null
  return sucesso(await listarCampeonatosDaEquipe(equipe, convite ? { convite, categoriaId: idValido(categoriaId) ? categoriaId : null } : {}))
})
