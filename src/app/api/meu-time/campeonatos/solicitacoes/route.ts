import { lerCorpo, sucesso, validar } from '@/lib/meu-time/acesso'
import { exigirEquipe } from '@/lib/meu-time/dados'
import { limitarUsuario, rotaLider } from '@/lib/inscricoes-solicitacao/acesso'
import { solicitarInscricao, solicitarSchema } from '@/lib/inscricoes-solicitacao/servico'
import { garantirPagamentoSemFalhar } from '@/lib/pagamento-comprovante/servico'

export const dynamic = 'force-dynamic'

// POST /api/meu-time/campeonatos/solicitacoes {equipeId, categoriaId, mensagem?}:
//  - categoria AUTOMATICA: inscreve direto (caminho existente) e responde 201 {estado:'INSCRITA'};
//  - categoria APROVACAO: cria a solicitação PENDENTE (201 {id, estado:'PENDENTE'}) e avisa o organizador.
export const POST = rotaLider(async ({ req, usuarioId }) => {
  await limitarUsuario(req, 'solicitar', usuarioId, 20)
  const entrada = validar(solicitarSchema, await lerCorpo(req))
  const { equipe } = await exigirEquipe(usuarioId, entrada.equipeId, 'escrita')
  const resultado = await solicitarInscricao(usuarioId, equipe, entrada)
  // R19 (PAGAMENTO_COMPROVANTE_ATIVO): inscrição criada direto nasce com o pagamento PENDENTE e a cópia do valor.
  const corpo = resultado.corpo as { inscricaoId?: string }
  if (corpo.inscricaoId) await garantirPagamentoSemFalhar(corpo.inscricaoId)
  return sucesso(resultado.corpo, resultado.status)
})
