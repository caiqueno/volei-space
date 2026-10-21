// Contatos do usuário para o despacho (e-mail e telefone do cadastro). Resolvidos só na hora do envio:
// nada disso é copiado para NotificacaoEntrega nem vai para log.
import { supabaseAdmin } from '@/lib/supabase-admin'
import { normalizarTelefone, telefoneValido } from '@/lib/login-sem-senha/config'

const db = supabaseAdmin as any

export type Contatos = { email: string | null; telefone: string | null }

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** E-mail e telefone válidos da conta (equipe, organizador ou conta pública). Ausente/ inválido = null. */
export async function contatosDoUsuario(usuarioId: string): Promise<Contatos> {
  let email: string | null = null
  let telefone: string | null = null
  for (const tabela of ['CandidaturaEquipe', 'CandidaturaOrganizador']) {
    try {
      const r = await db.from(tabela).select('id,email,telefone').eq('id', usuarioId).maybeSingle()
      if (r.error || !r.data) continue
      if (!email && EMAIL.test(String(r.data.email ?? ''))) email = String(r.data.email).trim()
      if (!telefone && r.data.telefone && telefoneValido(String(r.data.telefone))) telefone = normalizarTelefone(r.data.telefone)
    } catch {
      /* tabela indisponível: tenta a próxima */
    }
  }
  if (!email) {
    try {
      const r = await db.from('ContaPublico').select('id,email').eq('id', usuarioId).maybeSingle()
      if (!r.error && r.data && EMAIL.test(String(r.data.email ?? ''))) email = String(r.data.email).trim()
    } catch {
      /* sem conta pública */
    }
  }
  return { email, telefone }
}
