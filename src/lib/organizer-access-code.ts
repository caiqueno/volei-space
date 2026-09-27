import { randomBytes } from 'crypto'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function normalizeAccessCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '')
}

export function generateAccessCode() {
  const bytes = randomBytes(8)
  const part = (offset: number) => Array.from(bytes.subarray(offset, offset + 4), (byte) => alphabet[byte % alphabet.length]).join('')
  return `ORG-${part(0)}-${part(4)}`
}

export async function claimAccessCode(codigo: string, organizadorId: string) {
  const normalized = normalizeAccessCode(codigo)
  if (normalized.length < 8) return null

  const { data, error } = await supabase
    .from('CodigoAcessoOrganizador')
    .update({ organizadorId, usadoEm: new Date().toISOString() })
    .eq('codigo', normalized)
    .is('organizadorId', null)
    .select('id')
    .maybeSingle()

  if (error) throw error
  return data
}

export async function accessCodeMatchesOrganizer(codigo: string, organizadorId: string) {
  const normalized = normalizeAccessCode(codigo)
  if (!normalized) return false

  const { data, error } = await supabase
    .from('CodigoAcessoOrganizador')
    .select('id')
    .eq('codigo', normalized)
    .eq('organizadorId', organizadorId)
    .maybeSingle()

  if (error) throw error
  return Boolean(data)
}
