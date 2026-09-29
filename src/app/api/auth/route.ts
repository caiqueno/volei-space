import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { supabaseAdmin as supabase, isSupabaseServiceConfigured } from '@/lib/supabase-admin'
import { success, error } from '@/lib/api-response'
import { OFFICIAL_ADMIN_EMAIL, signPublicToken, signToken, setTokenCookie } from '@/lib/auth'
import { loginDestination } from '@/lib/login-destination'
import { EMAIL_ARBITRO_SIMULACAO } from '@/lib/simulacao'
const loginSchema = z.object({
  email: z.string().email(),
  senha: z.string().min(1),
  perfil: z.enum(['organizador', 'publico', 'participante']).optional(),
})

type PublicUser = {
  id: string
  email: string
  nome: string
  status: string
  senhaHash: string | null
  tipo: 'equipe' | 'arbitro' | 'quadra' | 'organizador' | 'publico'
  perfil: string
  trocarSenha: boolean
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

    if (adminOnly || email === OFFICIAL_ADMIN_EMAIL) {
      return loginAdmin(email, senha)
    }

    const perfil = parsed.data.perfil
    const usuario = perfil === 'publico'
      ? await findPublicAccount(email)
      : perfil === 'organizador'
        ? await findOrganizer(email)
        : perfil === 'participante'
          ? await findParticipant(email)
          : await findPublicUser(email)

    if (perfil === 'organizador' && usuario && usuario.tipo !== 'organizador') {
      return error('Esta conta não é de organizador.', 403)
    }
    if (perfil === 'participante' && usuario?.tipo === 'organizador') {
      return error('Organizador entra com o usuário e a senha atribuídos pelo administrador.', 403)
    }
    if (!usuario?.senhaHash) {
      return error(perfil === 'organizador' ? 'Usuário ou senha não conferem.' : 'Credenciais inválidas.', 401)
    }

    const senhaOk = await bcrypt.compare(senha, usuario.senhaHash)
    if (!senhaOk) {
      return error(perfil === 'organizador' ? 'Usuário ou senha não conferem.' : 'Credenciais inválidas.', 401)
    }
    if (EMAIL_ARBITRO_SIMULACAO.test(usuario.email) && process.env.NODE_ENV === 'production') {
      return error('Credenciais inválidas.', 401)
    }

    const trocarSenha = (usuario.tipo === 'organizador' || usuario.tipo === 'arbitro') && usuario.trocarSenha
    const token = await signPublicToken({
      userId: usuario.id,
      email: usuario.email,
      nome: usuario.nome,
      tipo: usuario.tipo,
      status: usuario.status,
      trocarSenha,
    })
    const cookie = setTokenCookie(token)
    const redirectTo = loginDestination(usuario.tipo, trocarSenha)
    const res = success({
      redirectTo,
      user: {
        tipo: usuario.tipo,
        perfil: usuario.perfil,
        nome: usuario.nome,
        email: usuario.email,
        candidaturaId: usuario.id,
        status: usuario.status,
        trocarSenha,
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

async function findPublicAccount(email: string): Promise<PublicUser | null> {
  const { data, error: lookupError } = await supabase
    .from('ContaPublico')
    .select('id,email,nome,status,senhaHash')
    .ilike('email', email)
    .limit(1)

  if (lookupError) {
    console.error('[AUTH PUBLICO DB ERROR]', lookupError.message)
    throw new Error('Nao foi possivel consultar o publico.')
  }

  const row = Array.isArray(data) && data.length > 0 ? data[0] as Record<string, unknown> : null
  if (!row) return null
  return {
    id: String(row.id),
    email: String(row.email),
    nome: String(row.nome || ''),
    status: String(row.status || 'ATIVA'),
    senhaHash: typeof row.senhaHash === 'string' ? row.senhaHash : null,
    tipo: 'publico',
    perfil: 'Público',
    trocarSenha: false,
  }
}

async function findOrganizer(email: string): Promise<PublicUser | null> {
  return findInTables(email, ['CandidaturaOrganizador'])
}

async function findParticipant(email: string): Promise<PublicUser | null> {
  return findInTables(email, ['CandidaturaEquipe', 'CandidaturaArbitro', 'CandidaturaQuadra'])
}

async function findPublicUser(email: string): Promise<PublicUser | null> {
  return findInTables(email, ['CandidaturaEquipe', 'CandidaturaArbitro', 'CandidaturaQuadra', 'CandidaturaOrganizador', 'ContaPublico'])
}

async function findInTables(email: string, tables: string[]): Promise<PublicUser | null> {
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
      select: 'id,email,nome,status,senhaHash,trocarSenha',
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
      select: 'id,email,nome,status,senhaHash,trocarSenha',
      name: (row: Record<string, unknown>) => String(row.nome || ''),
    },
  ]

  const selected = lookups.filter((item) => tables.includes(item.table))
  const [found, publicAccount] = await Promise.all([
    Promise.all(selected.map(async (lookup) => {
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
      return row ? { lookup, row } : null
    })),
    tables.includes('ContaPublico') ? findPublicAccount(email) : Promise.resolve(null),
  ])

  const match = found.find((item) => item !== null)
  if (match) {
    return {
      id: String(match.row.id),
      email: String(match.row.email),
      nome: match.lookup.name(match.row),
      status: String(match.row.status || 'PENDENTE'),
      senhaHash: typeof match.row.senhaHash === 'string' ? match.row.senhaHash : null,
      tipo: match.lookup.tipo,
      perfil: match.lookup.perfil,
      trocarSenha: (match.lookup.tipo === 'organizador' || match.lookup.tipo === 'arbitro') && match.row.trocarSenha === true,
    }
  }

  return publicAccount
}

export async function DELETE() {
  const res = NextResponse.json({ data: { mensagem: 'Logout realizado' } })
  res.cookies.set('luva_token', '', { maxAge: 0, path: '/' })
  return res
}
