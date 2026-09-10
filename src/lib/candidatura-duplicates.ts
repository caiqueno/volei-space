import { supabaseAdmin as supabase } from '@/lib/supabase-admin'

type CadastroDuplicate = {
  field: 'email'
  table: string
}

const candidaturaTables = ['CandidaturaEquipe', 'CandidaturaArbitro', 'CandidaturaQuadra', 'CandidaturaOrganizador'] as const

export function normalizeCadastroEmail(email: string | null | undefined) {
  return String(email || '').trim().toLowerCase()
}

export function normalizeCadastroPhone(telefone: string | null | undefined) {
  return String(telefone || '').replace(/\D/g, '')
}

export function formatCadastroPhone(telefone: string | null | undefined) {
  const digits = normalizeCadastroPhone(telefone).slice(0, 11)
  if (digits.length <= 2) return digits ? `(${digits}` : ''
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

export async function findCadastroDuplicate(email: string, _telefone?: string | null): Promise<CadastroDuplicate | null> {
  const normalizedEmail = normalizeCadastroEmail(email)
  if (!normalizedEmail) return null

  for (const table of candidaturaTables) {
    const { data, error } = await supabase
      .from(table)
      .select('id,email')
      .eq('email', normalizedEmail)
      .limit(1)

    if (error) {
      console.error(`[cadastro-duplicates] erro ao consultar ${table}`, error)
      continue
    }

    if (data?.[0]) return { field: 'email', table }
  }

  return null
}

export function duplicateMessage(_duplicate: CadastroDuplicate) {
  return 'Este e-mail ja esta cadastrado. Use outro e-mail ou acesse sua conta.'
}

export function duplicateDatabaseMessage(message: string) {
  if (message.includes('DUPLICATE_CADASTRO_EMAIL')) return 'Este e-mail ja esta cadastrado. Use outro e-mail ou acesse sua conta.'
  return null
}
