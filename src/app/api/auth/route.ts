import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { supabaseAdmin as supabase, isSupabaseServiceConfigured } from '@/lib/supabase-admin'
import { success, error } from '@/lib/api-response'
import { OFFICIAL_ADMIN_EMAIL, signPublicToken, signToken, setTokenCookie } from '@/lib/auth'

const loginSchema = z.object({
  email: z.string().email(),
  senha: z.string().min(1),
})

type PublicUser = {
  id: string
  email: string
  nome: string
  status: string
  senhaHash: string | null
  tipo: 'equipe' | 'arbitro' | 'quadra' | 'organizador'
  perfil: string
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = loginSchema.safeParse(body)
    if (!parsed.success) return error('Dados inválidos.', 422)

    const adminOnly = req.nextUrl.searchParams.get('admin') === '1'
    const email = parsed.data.email.trim().toLowerCase()
    const senha = parsed.data.senha

    if (!isSupabaseServiceConfigured) {
      return error('SUPABASE_SERVICE_ROLE_KEY não está configurada no ambiente da Vercel.', 500)
    }

    if (adminOnly) {
      return loginAdmin(email, senha)
    }

    const usuario = await findPublicUser(email)
    if (!usuario?.senhaHash) return error('Credenciais inválidas.', 401)

    const senhaOk = await bcrypt.compare(senha, usuario.senhaHash)
    if (!senhaOk) return error('Credenciais inválidas.', 401)

    const token = await signPublicToken({
      userId: usuario.id,
      email: usuario.email,
      nome: usuario.nome,
      tipo: usuario.tipo,
      status: usuario.status,
    })
    const cookie = setTokenCookie(token)
    const res = success({
      redirectTo: usuario.tipo === 'equipe' ? '/capitao' : '/painel',
      user: {
        tipo: usuario.tipo,
        perfil: usuario.perfil,
        nome: usuario.nome,
        email: usuario.email,
        candidaturaId: usuario.id,
        status: usuario.status,
      },
    })
    res.cookies.set(cookie.name, cookie.value, cookie.options as Parameters<typeof res.cookies.set>[2])
    return res
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[AUTH ERROR]', msg)
    return error(`Erro ao autenticar: ${msg}`, 500)
  }
}

async function loginAdmin(email: string, senha: string) {
  if (email !== OFFICIAL_ADMIN_EMAIL) {
    return error('Esta conta não tem permissão de administrador.', 403)
  }

  const { data: admin, error: dbErr } = await supabase
    .from('Admin')
    .select('id,email,nome,senhaHash')
    .eq('email', email)
    .maybeSingle()

  if (dbErr) {
    console.error('[AUTH ADMIN DB ERROR]', dbErr.message)
    return error('Não foi possível consultar o usuário administrador.', 500)
  }

  if (!admin) return error('Administrador não encontrado. Verifique se este e-mail existe na tabela Admin.', 401)
  if (!admin.senhaHash) return error('Administrador sem senha configurada.', 401)

  const senhaOk = await bcrypt.compare(senha, admin.senhaHash)
  if (!senhaOk) return error('Credenciais inválidas.', 401)

  const token = await signToken({ adminId: admin.id, email: admin.email, nome: admin.nome })
  const cookie = setTokenCookie(token)

  const res = success({ token, admin: { id: admin.id, nome: admin.nome, email: admin.email }, redirectTo: '/admin' })
  res.cookies.set(cookie.name, cookie.value, cookie.options as Parameters<typeof res.cookies.set>[2])
  return res
}

async function findPublicUser(email: string): Promise<PublicUser | null> {
  const lookups = [
    {
      table: 'CandidaturaEquipe',
      tipo: 'equipe' as const,
      perfil: 'Equipe',
      select: 'id,email,responsavel,nome,status,senhaHash',
      name: (row: Record<string, unknown>) => String(row.responsavel || row.nome || ''),
    },
    {
      table: 'CandidaturaArbitro',
      tipo: 'arbitro' as const,
      perfil: 'Árbitro',
      select: 'id,email,nome,status,senhaHash',
      name: (row: Record<string, unknown>) => String(row.nome || ''),
    },
    {
      table: 'CandidaturaQuadra',
      tipo: 'quadra' as const,
      perfil: 'Fornecedor de quadra',
      select: 'id,email,responsavel,nome,status,senhaHash',
      name: (row: Record<string, unknown>) => String(row.responsavel || row.nome || ''),
    },
    {
      table: 'CandidaturaOrganizador',
      tipo: 'organizador' as const,
      perfil: 'Criador de campeonatos',
      select: 'id,email,nome,status,senhaHash',
      name: (row: Record<string, unknown>) => String(row.nome || ''),
    },
  ]

  for (const lookup of lookups) {
    const { data, error: lookupError } = await supabase
      .from(lookup.table)
      .select(lookup.select)
      .ilike('email', email)
      .limit(1)

    if (lookupError) {
      console.error(`[AUTH PUBLIC DB ERROR] ${lookup.table}`, lookupError.message)
      throw new Error(`Nao foi possivel consultar ${lookup.perfil}.`)
    }

    const row = Array.isArray(data) && data.length > 0
      ? data[0] as unknown as Record<string, unknown>
      : null

    if (row) {
      return {
        id: String(row.id),
        email: String(row.email),
        nome: lookup.name(row),
        status: String(row.status || 'PENDENTE'),
        senhaHash: typeof row.senhaHash === 'string' ? row.senhaHash : null,
        tipo: lookup.tipo,
        perfil: lookup.perfil,
      }
    }
  }

  return null
}

export async function DELETE() {
  const res = NextResponse.json({ data: { mensagem: 'Logout realizado' } })
  res.cookies.set('luva_token', '', { maxAge: 0, path: '/' })
  return res
}
