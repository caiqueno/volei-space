import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { success, error } from '@/lib/api-response'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { candidaturaQuadraSchema } from '@/lib/schemas'
import { emailCadastroRecebido, sendEmail } from '@/lib/email'
import { setTokenCookie, signPublicToken } from '@/lib/auth'
import { duplicateDatabaseMessage, duplicateMessage, findCadastroDuplicate, formatCadastroPhone, normalizeCadastroEmail } from '@/lib/candidatura-duplicates'
import { errorDetail } from '@/lib/error-detail'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = candidaturaQuadraSchema.safeParse(body)
    if (!parsed.success) return error('Dados inválidos', 422, parsed.error.flatten())

    const { ligaId: providedLigaId, senha, ...dados } = parsed.data
    const cadastro = {
      ...dados,
      email: normalizeCadastroEmail(dados.email),
      telefone: formatCadastroPhone(dados.telefone) || null,
      instagram: dados.instagram?.replace(/^@/, '').trim() || null,
    }
    const ligaId = providedLigaId ?? await getOrCreateDefaultLigaId()

    const duplicate = await findCadastroDuplicate(cadastro.email)
    if (duplicate) return error(duplicateMessage(duplicate), 409)

    const { data: existing } = await supabase
      .from('CandidaturaQuadra')
      .select('id')
      .eq('email', cadastro.email)
      .eq('status', 'PENDENTE')
      .maybeSingle()

    if (existing) return error('Já existe uma candidatura pendente com este e-mail', 409)

    const senhaHash = await bcrypt.hash(senha, 10)

    const { data, error: err } = await supabase
      .from('CandidaturaQuadra')
      .insert({
        ...cadastro,
        senhaHash,
        ligaId,
        horarios: JSON.stringify(cadastro.horarios || { horariosDisponiveis: [] }),
        fotosUrls: JSON.stringify(cadastro.fotosUrls || []),
        cobertura: Boolean(cadastro.cobertura),
        banheiro: Boolean(cadastro.banheiro),
        estacionamento: Boolean(cadastro.estacionamento),
      })
      .select()
      .single()

    if (err) throw err
    try {
      await sendEmail({
        to: cadastro.email,
        subject: 'Cadastro recebido - volei.space',
        html: emailCadastroRecebido(cadastro.nome, 'fornecedor de quadra'),
      })
    } catch (emailErr) {
      console.error('[candidaturas/quadras] erro ao enviar e-mail de cadastro', emailErr)
    }
    const token = await signPublicToken({ userId: data.id, email: cadastro.email, nome: cadastro.responsavel || cadastro.nome, tipo: 'quadra', status: data.status || 'PENDENTE' })
    const cookie = setTokenCookie(token)
    const res = success({ id: data.id, mensagem: 'Cadastro de quadra recebido para análise.' }, 201)
    res.cookies.set(cookie.name, cookie.value, cookie.options as Parameters<typeof res.cookies.set>[2])
    return res
  } catch (err) {
    const detail = errorDetail(err)
    const duplicateError = duplicateDatabaseMessage(detail)
    if (duplicateError) return error(duplicateError, 409)
    console.error('[candidaturas/quadras] erro ao registrar cadastro', err)
    return error('Erro ao registrar cadastro de quadra.', 500)
  }
}

async function getOrCreateDefaultLigaId() {
  const { data: existing } = await supabase
    .from('Liga')
    .select('id')
    .in('status', ['ATIVA', 'EM_BREVE'])
    .order('criadoEm', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (existing?.id) return existing.id

  const slug = `campeonato-luv-c${Date.now().toString(36)}`
  const { data: created, error: createError } = await supabase
    .from('Liga')
    .insert({
      slug,
      nome: 'Campeonato volei.space',
      subtitulo: 'Campeonato inicial',
      descricao: 'A liga amadora de vôlei com calendário, resultados, classificação, atletas e súmula digital em um só lugar.',
      corTematica: '#EF9F27',
      status: 'ATIVA',
    })
    .select('id')
    .single()

  if (!createError && created?.id) return created.id

  return created?.id ?? null
}
