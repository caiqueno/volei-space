// Entrada comum das rotas de notificação multicanal (R18).
// Flag: NOTIFICACOES_MULTICANAL_ATIVO=1 (desligada = 404 nas rotas novas). Usuário: líder/técnico (equipe) ou organizador.
// Cron: Authorization Bearer CRON_SECRET em tempo constante; sem CRON_SECRET a rota "não existe" (404).
import { NextRequest, NextResponse } from 'next/server'
import { requirePublicRole } from '@/lib/auth'
import { ErroMeuTime, falha, lerCorpo, validar } from '@/lib/meu-time/acesso'
import { limitarUsuario } from '@/lib/inscricoes-solicitacao/acesso'
import { cabecalhoCronValido, segredoDoCron } from '@/lib/meu-time-fase2/expurgo'
import { isSupabaseServiceConfigured } from '@/lib/supabase-admin'
import { MENSAGEM_CANAIS_NAO_HABILITADO, multicanalAtivo } from './flags'

export { lerCorpo, validar }

export type ContextoNotificacoes<P> = { req: NextRequest; usuarioId: string; params: P }

export function rotaNotificacoes<P = Record<string, never>>(
  escopo: string,
  manipulador: (contexto: ContextoNotificacoes<P>) => Promise<Response>,
) {
  return async (req: NextRequest, argumentos?: { params?: P | Promise<P> }): Promise<Response> => {
    if (!multicanalAtivo()) return falha('Não encontrado.', 404)
    const auth = await requirePublicRole(req, ['equipe', 'organizador'])
    if (auth instanceof Response) return auth
    try {
      await limitarUsuario(req, `canais-${escopo}`, String(auth.userId), 30)
      const params = (await Promise.resolve(argumentos?.params ?? {})) as P
      return await manipulador({ req, usuarioId: String(auth.userId), params })
    } catch (erro) {
      if (erro instanceof ErroMeuTime) {
        const resposta = falha(erro.message, erro.status, erro.codigo, erro.extra)
        const espera = erro.extra?.retryAfterSeconds
        if (typeof espera === 'number') resposta.headers.set('Retry-After', String(espera))
        return resposta
      }
      console.error('[notificacoes-canais] erro inesperado', erro instanceof Error ? erro.message : 'desconhecido')
      return falha('Não foi possível concluir a operação. Tente novamente.', 500)
    }
  }
}

const SEM_CACHE = { 'Cache-Control': 'no-store' }

/** Rota de cron: 404 sem flag ou sem CRON_SECRET, 401 com segredo errado, 503 sem banco/tabela, 500 genérico. */
export function rotaCron(nome: string, executar: () => Promise<unknown>) {
  return async (req: Request): Promise<Response> => {
    const segredo = segredoDoCron()
    if (!multicanalAtivo() || !segredo) return NextResponse.json({ error: 'Não encontrado.' }, { status: 404, headers: SEM_CACHE })
    if (!cabecalhoCronValido(req.headers.get('authorization'), segredo)) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401, headers: SEM_CACHE })
    }
    if (!isSupabaseServiceConfigured) {
      return NextResponse.json({ error: MENSAGEM_CANAIS_NAO_HABILITADO }, { status: 503, headers: SEM_CACHE })
    }
    try {
      return NextResponse.json({ data: await executar() }, { headers: SEM_CACHE })
    } catch (erro) {
      if (erro instanceof ErroMeuTime) {
        return NextResponse.json({ error: erro.message, ...(erro.codigo ? { codigo: erro.codigo } : {}) }, { status: erro.status, headers: SEM_CACHE })
      }
      console.error(`[cron-${nome}] falha`, erro instanceof Error ? erro.name : 'desconhecido')
      return NextResponse.json({ error: 'Não foi possível concluir a operação.' }, { status: 500, headers: SEM_CACHE })
    }
  }
}
