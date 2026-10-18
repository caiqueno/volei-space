import { NextResponse } from 'next/server'
import { isSupabaseServiceConfigured, supabaseAdmin } from '@/lib/supabase-admin'
import { cabecalhoCronValido, expurgarPreviasImportacao, segredoDoCron } from '@/lib/meu-time-fase2/expurgo'

export const dynamic = 'force-dynamic'

const SEM_CACHE = { 'Cache-Control': 'no-store' }

// POST: apaga as prévias de importação vencidas. Protegida por `Authorization: Bearer ${CRON_SECRET}`.
// Sem CRON_SECRET configurado a rota "não existe" (404). O agendamento (Vercel cron) não está configurado.
export async function POST(req: Request) {
  const segredo = segredoDoCron()
  if (!segredo) return NextResponse.json({ error: 'Não encontrado.' }, { status: 404, headers: SEM_CACHE })
  if (!cabecalhoCronValido(req.headers.get('authorization'), segredo)) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401, headers: SEM_CACHE })
  }
  if (!isSupabaseServiceConfigured) {
    return NextResponse.json({ error: 'Recurso ainda não habilitado neste ambiente.' }, { status: 503, headers: SEM_CACHE })
  }
  const r = await expurgarPreviasImportacao(supabaseAdmin as never)
  if (r.tipo === 'INDISPONIVEL') {
    return NextResponse.json({ error: 'Recurso ainda não habilitado neste ambiente.' }, { status: 503, headers: SEM_CACHE })
  }
  if (r.tipo === 'ERRO') {
    return NextResponse.json({ error: 'Não foi possível concluir a operação.' }, { status: 500, headers: SEM_CACHE })
  }
  return NextResponse.json({ data: { apagadas: r.apagadas } }, { headers: SEM_CACHE })
}
