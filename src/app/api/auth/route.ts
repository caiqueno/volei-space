import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { supabaseAdmin as supabase, isSupabaseServiceConfigured } from '@/lib/supabase-admin'
import { success, error } from '@/lib/api-response'
import { isReleasedPublicStatus, signPublicToken, signToken, setTokenCookie } from '@/lib/auth'
import { adminEmailAllowed } from '@/lib/admin-access'
import { loginDestination } from '@/lib/login-destination'
import { EMAIL_ARBITRO_SIMULACAO } from '@/lib/simulacao'
import { loginRateLimiter } from '@/lib/auth-rate-limit'

const CREDENCIAIS_INVALIDAS = 'Credenciais inválidas.'
const FALHA_ENTRADA = 'Não foi possível entrar agora. Tente novamente.'
const HASH_SENHA_AUSENTE = bcrypt.hashSync('conta-sem-senha-configurada', 8)

function ipDaRequisicao(req: NextRequest) {
  const encaminhado = req.headers.get('x-forwarded-for')
  if (encaminhado) return encaminhado.split(',')[0]?.trim() || 'desconhecido'
  return req.headers.get('x-real-ip')?.trim() || 'desconhecido'
}
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
      console.error('[AUTH] service role ausente')
      return error(FALHA_ENTRADA, 500)
    }

    if (!loginRateLimiter.permitir(ipDaRequisicao(req))) {
      return error('Muitas tentativas de entrada. Aguarde e tente novamente.', 429)
    }

    const adminResponse = await loginAdmin(email, senha)
    if (adminResponse) return adminResponse
    if (adminOnly) return error(CREDENCIAIS_INVALIDAS, 401)

    const perfil = parsed.data.perfil
    const usuario = perfil === 'publico'
      ? await findPublicAccount(email)
      : perfil === 'organizador'
        ? await findOrganizer(email)
        : perfil === 'participante'
          ? await findParticipant(email)
          : await findPublicUser(email)

    if (!usuario?.senhaHash) return error(CREDENCIAIS_INVALIDAS, 401)

    const senhaOk = await bcrypt.compare(senha, usuario.senhaHash)
    if (!senhaOk) return error(CREDENCIAIS_INVALIDAS, 401)
    if (perfil === 'organizador' && usuario.tipo !== 'organizador') return error(CREDENCIAIS_INVALIDAS, 401)
    if (perfil === 'participante' && usuario.tipo === 'organizador') return error(CREDENCIAIS_INVALIDAS, 401)
    if (usuario.tipo === 'organizador' && !isReleasedPublicStatus(usuario.status)) {
      return error('Seu cadastro de organizador ainda aguarda liberação do administrador.', 403)
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
    console.error('[AUTH ERROR]', err)
    return error(FALHA_ENTRADA, 500)
  }
}

async function loginAdmin(email: string, senha: string) {
  const { data, error: dbErr } = await supabase
    .from('Admin')
    .select('id,email,nome,senhaHash')
    .ilike('email', email)
    .limit(1)

  if (dbErr) {
    console.error('[AUTH ADMIN DB ERROR]', dbErr.message)
    return error(FALHA_ENTRADA, 500)
  }

  const admin = Array.isArray(data) && data.length > 0 ? data[0] : null
  if (!admin) {
    await bcrypt.compare(senha, HASH_SENHA_AUSENTE)
    return null
  }
  const permitido = adminEmailAllowed(email) && Boolean(admin.senhaHash)
  const senhaOk = await bcrypt.compare(senha, admin.senhaHash || HASH_SENHA_AUSENTE)
  if (!permitido || !senhaOk) return error(CREDENCIAIS_INVALIDAS, 401)

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
    if (/does not exist|schema cache/i.test(lookupError.message)) return null
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

function colunaAusenteNoSelect(mensagem: string, select: string) {
  if (!/does not exist|schema cache/i.test(mensagem)) return null
  const colunas = select.split(',').sort((a, b) => b.length - a.length)
  return colunas.find((coluna) => mensagem.includes(coluna)) ?? null
}

async function consultarPorEmail(table: string, select: string, email: string) {
  const pedir = (colunas: string) => supabase.from(table).select(colunas).ilike('email', email).limit(1)
  let resultado = await pedir(select)
  const colunaAusente = colunaAusenteNoSelect(resultado.error?.message ?? '', select)
  if (colunaAusente) {
    const semColuna = select.split(',').filter((coluna) => coluna !== colunaAusente).join(',')
    resultado = await pedir(semColuna)
  }
  return resultado
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
      const { data, error: lookupError } = await consultarPorEmail(lookup.table, lookup.select, email)

      if (lookupError) {
        console.error(`[AUTH PUBLIC DB ERROR] ${lookup.table}`, lookupError.message)
        if (/does not exist|schema cache/i.test(lookupError.message)) return null
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
