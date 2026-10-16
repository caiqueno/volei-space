import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { supabaseAdmin as supabase, isSupabaseServiceConfigured } from '@/lib/supabase-admin'
import { success, error } from '@/lib/api-response'
import { clearTokenCookie, isReleasedPublicStatus, signPublicToken, signToken, setTokenCookie } from '@/lib/auth'
import { adminEmailAllowed } from '@/lib/admin-access'
import { emailsConferem, padraoIlikeLiteral } from '@/lib/email-lookup'
import { loginDestination } from '@/lib/login-destination'
import { consumirCota, ipDaRequisicao } from '@/lib/rate-limit'
import { EMAIL_ARBITRO_SIMULACAO } from '@/lib/simulacao'
import { colunaAusente } from '@/lib/coluna-ausente'

const CREDENCIAIS = 'Usuário ou senha não conferem.'
const FALHA_ENTRADA = 'Não foi possível entrar agora. Tente novamente.'
const JANELA_LOGIN_MS = 10 * 60 * 1000
let hashComparacao: Promise<string> | null = null

function hashParaComparacao() {
  hashComparacao ??= bcrypt.hash('comparacao-login-volei-space', 10)
  return hashComparacao
}

function podeTentarLogin(req: NextRequest, email: string) {
  const ip = ipDaRequisicao(req)
  const porIp = consumirCota(`login:ip:${ip}`, 30, JANELA_LOGIN_MS)
  const porConta = consumirCota(`login:email:${ip}:${email}`, 8, JANELA_LOGIN_MS)
  return porIp.permitido && porConta.permitido
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

    if (!podeTentarLogin(req, email)) {
      return error('Muitas tentativas. Tente novamente em instantes.', 429)
    }

    if (!isSupabaseServiceConfigured) {
      console.error('[AUTH] service role ausente')
      return error(FALHA_ENTRADA, 500)
    }

    const adminResponse = await loginAdmin(email, senha)
    if (adminResponse) return adminResponse
    if (adminOnly) return error(CREDENCIAIS, 401)

    const perfil = parsed.data.perfil
    const usuario = perfil === 'publico'
      ? await findPublicAccount(email)
      : perfil === 'organizador'
        ? await findOrganizer(email)
        : perfil === 'participante'
          ? await findParticipant(email)
          : await findPublicUser(email)

    if (!usuario?.senhaHash) {
      await bcrypt.compare(senha, await hashParaComparacao())
      return error(CREDENCIAIS, 401)
    }

    const senhaOk = await bcrypt.compare(senha, usuario.senhaHash)
    if (!senhaOk) return error(CREDENCIAIS, 401)

    if (perfil === 'organizador' && usuario.tipo !== 'organizador') {
      return error('Esta conta não é de organizador.', 403)
    }
    if (perfil === 'participante' && usuario.tipo === 'organizador') {
      return error('Organizador entra com o usuário e a senha atribuídos pelo administrador.', 403)
    }
    if (usuario.tipo === 'organizador' && !isReleasedPublicStatus(usuario.status)) {
      return error('Seu cadastro de organizador ainda aguarda liberação do administrador.', 403)
    }
    if (EMAIL_ARBITRO_SIMULACAO.test(usuario.email) && process.env.NODE_ENV === 'production') {
      return error(CREDENCIAIS, 401)
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
    const cookie = setTokenCookie(token, usuario.tipo === 'organizador' ? 'navegador' : 'persistente')
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
    .ilike('email', padraoIlikeLiteral(email))
    .limit(1)

  if (dbErr) {
    console.error('[AUTH ADMIN DB ERROR]', dbErr.message)
    return error(FALHA_ENTRADA, 500)
  }

  const admin = Array.isArray(data) && data.length > 0 ? data[0] : null
  const adminEncontrado = Boolean(admin && emailsConferem(email, admin.email))
  if (adminEncontrado && !adminEmailAllowed(email)) {
    console.error('[AUTH] login de administrador recusado: ADMIN_EMAIL ausente ou diferente da conta')
  }
  if (!adminEncontrado || !admin?.senhaHash || !adminEmailAllowed(email)) {
    await bcrypt.compare(senha, await hashParaComparacao())
    return null
  }

  const senhaOk = await bcrypt.compare(senha, admin.senhaHash)
  if (!senhaOk) return error(CREDENCIAIS, 401)

  const token = await signToken({ adminId: admin.id, email: admin.email, nome: admin.nome })
  const cookie = setTokenCookie(token, 'navegador')

  const res = success({ admin: { id: admin.id, nome: admin.nome, email: admin.email }, redirectTo: '/admin' })
  res.cookies.set(cookie.name, cookie.value, cookie.options as Parameters<typeof res.cookies.set>[2])
  return res
}

async function findPublicAccount(email: string): Promise<PublicUser | null> {
  const { data, error: lookupError } = await supabase
    .from('ContaPublico')
    .select('id,email,nome,status,senhaHash')
    .ilike('email', padraoIlikeLiteral(email))
    .limit(1)

  if (lookupError) {
    console.error('[AUTH PUBLICO DB ERROR]', lookupError.message)
    if (colunaAusente({ message: lookupError.message }, ['does not exist', 'schema cache'])) return null
    throw new Error('Nao foi possivel consultar o publico.')
  }

  const row = Array.isArray(data) && data.length > 0 ? data[0] as Record<string, unknown> : null
  if (!row || !emailsConferem(email, row.email)) return null
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
  if (!colunaAusente({ message: mensagem }, ['does not exist', 'schema cache'])) return null
  const colunas = select.split(',').sort((a, b) => b.length - a.length)
  return colunas.find((coluna) => mensagem.includes(coluna)) ?? null
}

async function consultarPorEmail(table: string, select: string, email: string) {
  const pedir = (colunas: string) => supabase.from(table).select(colunas).ilike('email', padraoIlikeLiteral(email)).limit(1)
  let resultado = await pedir(select)
  const colunaQueFalta = colunaAusenteNoSelect(resultado.error?.message ?? '', select)
  if (colunaQueFalta) {
    const semColuna = select.split(',').filter((coluna) => coluna !== colunaQueFalta).join(',')
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
        if (colunaAusente({ message: lookupError.message }, ['does not exist', 'schema cache'])) return null
        throw new Error(`Nao foi possivel consultar ${lookup.perfil}.`)
      }

      const row = Array.isArray(data) && data.length > 0
        ? data[0] as unknown as Record<string, unknown>
        : null
      return row && emailsConferem(email, row.email) ? { lookup, row } : null
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

export async function DELETE(req: NextRequest) {
  const res = NextResponse.json({ data: { mensagem: 'Logout realizado' } })
  const cookie = clearTokenCookie()
  res.cookies.set(cookie.name, cookie.value, cookie.options)
  if (req.nextUrl.searchParams.get('gestao') !== '1') {
    res.cookies.set('luva_acesso_arbitro', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    })
  }
  return res
}
