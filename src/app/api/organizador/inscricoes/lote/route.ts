import { lerCorpo, sucesso, validar } from '@/lib/meu-time/acesso'
import { rotaPainel } from '@/lib/painel-inscricoes/acesso'
import { aprovarEmLote, loteSchema } from '@/lib/painel-inscricoes/servico'

export const dynamic = 'force-dynamic'

// POST /api/organizador/inscricoes/lote {ids (até 50), acao:'APROVAR'}: aprova uma a uma, cada qual com as mesmas regras de
// permissão, vagas e transição da decisão individual. Devolve o resultado de cada id (um erro não derruba as demais).
export const POST = rotaPainel('lote', async ({ req, usuarioId }) => {
  const entrada = validar(loteSchema, await lerCorpo(req))
  return sucesso(await aprovarEmLote(usuarioId, entrada.ids))
})
