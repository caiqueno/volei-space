import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { error, success } from '@/lib/api-response'
import { requireSumulaLeitura, requireSumulaTokenAccess } from '@/lib/sumula-access'
import { regrasEfetivasDaPartida } from '@/lib/regras-da-partida'
import { configDaPartida, contextoDaPartida, type ClienteEventos } from '@/lib/sumula-eventos'
import { carregarAcoesScout, lerResumoScout, scoutAtivo } from '@/lib/scout'

/**
 * Scout (base), R10. Desligado por padrão: 404 sem `SCOUT_ATIVO=1`.
 * Mesmo acesso da leitura da súmula. Só leitura: deriva do log de eventos. Ver docs/analise/26-scout.md.
 */
export const dynamic = 'force-dynamic'

const partidaDoScout = (p: any) => ({ id: Number(p.id), equipeAId: p.equipeAId ?? null, equipeBId: p.equipeBId ?? null })
const cliente = supabaseAdmin as unknown as ClienteEventos

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  if (!scoutAtivo()) return error('Recurso não encontrado.', 404)
  const { token } = await params

  const access = await requireSumulaTokenAccess(token)
  if (access instanceof Response) return access
  const leitura = await requireSumulaLeitura(req, access.partida)
  if (leitura) return leitura

  try {
    const regras = await regrasEfetivasDaPartida(access.partida)
    const manuais = await carregarAcoesScout(cliente, partidaDoScout(access.partida))
    if (!manuais.ok) return error(manuais.mensagem, 500)
    const r = await lerResumoScout(cliente, {
      partidaId: Number(access.partida.id),
      config: configDaPartida(regras),
      contexto: contextoDaPartida(access.partida),
    })
    if (r.tipo === 'INDISPONIVEL') return error(r.mensagem, 503)
    if (r.tipo === 'ERRO') return error(r.mensagem, 500)
    return success(r.resumo)
  } catch {
    return error('Não foi possível montar o scout da partida.', 500)
  }
}
