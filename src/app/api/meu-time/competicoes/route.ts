import { sucesso } from '@/lib/meu-time/acesso'
import { limitarUsuario } from '@/lib/inscricoes-solicitacao/acesso'
import { rotaExplorar } from '@/lib/explorar-competicoes/acesso'
import { listarCompeticoes } from '@/lib/explorar-competicoes/servico'

export const dynamic = 'force-dynamic'

// GET /api/meu-time/competicoes?equipeId=&cidade=&de=&ate=&categoria=&naipe=&abertas=1&q=&pagina=
// Flag EXPLORAR_COMPETICOES_ATIVO. Só competições públicas e publicadas. Cada item traz o `selo` de elegibilidade do time
// (OK, AVISO ou BLOQUEIO) calculado no servidor, com o motivo em texto simples e sem dado pessoal.
export const GET = rotaExplorar(async ({ req, usuarioId }) => {
  await limitarUsuario(req, 'explorar', usuarioId, 60)
  const busca = new URL(req.url).searchParams
  return sucesso(
    await listarCompeticoes(usuarioId, {
      equipeId: busca.get('equipeId'),
      cidade: busca.get('cidade'),
      de: busca.get('de'),
      ate: busca.get('ate'),
      categoria: busca.get('categoria'),
      naipe: busca.get('naipe'),
      abertas: busca.get('abertas'),
      q: busca.get('q'),
      pagina: busca.get('pagina'),
    }),
  )
})
