import { NextResponse } from 'next/server'
import { alvoSupabase, isSupabaseConfigured, supabaseConfigError } from '@/lib/supabase-config'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'

export async function GET() {
  try {
    if (!isSupabaseConfigured) {
      return NextResponse.json({
        ok: false,
        database: 'not_configured',
        error: supabaseConfigError,
      }, { status: 503 })
    }

    const { count, error } = await supabase
      .from('Equipe')
      .select('*', { count: 'exact', head: true })
    if (error) throw error
    return NextResponse.json({
      ok: true,
      alvo: alvoSupabase,
      equipes: count,
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
