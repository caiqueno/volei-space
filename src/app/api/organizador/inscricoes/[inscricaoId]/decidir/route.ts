import { lerCorpo, sucesso, validar } from '@/lib/meu-time/acesso'
import { rotaPainel } from '@/lib/painel-inscricoes/acesso'
import { decidirInscricao, decisaoSchema } from '@/lib/painel-inscricoes/servico'

export const dynamic = 'force-dynamic'

// POST /api/organizador/inscricoes/:id/decidir {acao:'APROVAR'|'ANALISAR'|'PEDIR_CORRECAO'|'LISTA_ESPERA'|'RECUSAR', mensagem?}
// PEDIR_CORRECAO e RECUSAR exigem mensagem. Transição inválida = 409; campeonato finalizado = 409; idempotente.
// APROVAR além do limite da categoria vai para LISTA_ESPERA; quando uma vaga abre o primeiro da fila é promovido.
// Só o dono ou o ADMINISTRADOR decidem (FINANCEIRO e ARBITRAGEM recebem 403). Outro organizador = 404.
export const POST = rotaPainel<{ inscricaoId: string }>('decidir', async ({ req, usuarioId, params }) => {
  const entrada = validar(decisaoSchema, await lerCorpo(req))
  return sucesso(await decidirInscricao(usuarioId, params.inscricaoId, entrada))
})
