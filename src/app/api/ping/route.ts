import { NextResponse } from 'next/server'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'

export async function GET() {
  try {
    if (!isSupabaseConfigured) {
      return NextResponse.json({
        ok: true,
        database: 'not_configured',
        message: 'Supabase ainda não configurado neste ambiente.',
        url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      })
    }

    const { count, error } = await supabase
      .from('Equipe')
      .select('*', { count: 'exact', head: true })
    if (error) throw error
    return NextResponse.json({ ok: true, equipes: count, url: process.env.NEXT_PUBLIC_SUPABASE_URL })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
