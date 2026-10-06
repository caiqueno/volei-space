import slugifyLib from 'slugify'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'

export function slugify(text: string): string {
  return slugifyLib(text, { lower: true, strict: true, locale: 'pt' })
}

export async function slugifyUnique(text: string): Promise<string> {
  const base = slugify(text)
  const { data } = await supabase.from('Equipe').select('slug').like('slug', `${base}%`)
  const existing = (data ?? []).map((e: any) => e.slug).filter(Boolean)
  if (!existing.includes(base)) return base
  let i = 2
  while (existing.includes(`${base}-${i}`)) i++
  return `${base}-${i}`
}
