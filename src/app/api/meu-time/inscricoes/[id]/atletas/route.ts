import { lerCorpo, sucesso, validar } from '@/lib/meu-time/acesso'
import { rotaElencoLider } from '@/lib/meu-time/elenco'
import { limitarUsuario } from '@/lib/inscricoes-solicitacao/acesso'
import { trocaLivreSchema, trocarLivremente } from '@/lib/pedido-troca/servico'

export const dynamic = 'force-dynamic'

// PATCH {sai, entra, numero?}: troca livre na lista da inscrição, ANTES de RegraElenco.prazoTrocaEm (ou sem prazo definido).
// Depois do prazo: 409 PRAZO_ENCERRADO e a troca passa a ser por pedido (POST .../pedidos-troca). Valida a lista nova
// contra a regra de elenco da categoria. Líder ou técnico da equipe.
export const PATCH = rotaElencoLider<{ id: string }>(async ({ req, usuarioId, params }) => {
  await limitarUsuario(req, 'troca-livre', usuarioId, 20)
  const entrada = validar(trocaLivreSchema, await lerCorpo(req))
  return sucesso(await trocarLivremente(usuarioId, params.id, entrada))
})
