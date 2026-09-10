import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://example.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'

export const isSupabaseConfigured =
  Boolean(supabaseUrl)
  && Boolean(supabaseAnonKey)
  && !supabaseUrl.includes('example.supabase.co')
  && !supabaseAnonKey.includes('placeholder')

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
