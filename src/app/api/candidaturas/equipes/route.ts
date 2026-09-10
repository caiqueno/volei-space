import { NextRequest } from 'next/server'
import { randomUUID } from 'crypto'
import bcrypt from 'bcryptjs'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { success, error } from '@/lib/api-response'
import { candidaturaEquipeSchema } from '@/lib/schemas'
import { emailCadastroRecebido, sendEmail } from '@/lib/email'
import { setTokenCookie, signPublicToken } from '@/lib/auth'
import { duplicateDatabaseMessage, duplicateMessage, findCadastroDuplicate, formatCadastroPhone, normalizeCadastroEmail } from '@/lib/candidatura-duplicates'
import { errorDetail } from '@/lib/error-detail'
import { ensureEquipeForCandidatura } from '@/lib/team-activation'
import { countApprovedRegistrations, ensureClassificationAndCalendar } from '@/lib/championship-operations'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = candidaturaEquipeSchema.safeParse(body)
    if (!parsed.success) return error('Dados inválidos', 422, parsed.error.flatten())

    const { diasDisponiveis, horarios, quadraInfo, ligaId: requestedLigaId, instagram, senha, conviteToken, ...rest } = parsed.data
    const cadastro = {
      ...rest,
      email: normalizeCadastroEmail(rest.email),
      telefone: formatCadastroPhone(rest.telefone) || null,
    }
    const invitation = conviteToken
      ? await getValidInvitation(conviteToken, cadastro.email)
      : null
    if (conviteToken && !invitation) return error('Convite inválido, expirado ou destinado a outro e-mail.', 400)
    if (invitation && requestedLigaId && invitation.ligaId !== requestedLigaId) {
      return error('O convite não pertence ao campeonato informado.', 400)
    }

    const targetLigaId = invitation?.ligaId ?? requestedLigaId ?? null
    const ligaId = targetLigaId ?? await getOrCreateDefaultLigaId()
    if (!ligaId) return error('Não foi possível preparar a liga padrão para este cadastro', 400)

    if (targetLigaId) {
      const validacaoLiga = await validateChampionshipRegistration(targetLigaId)
      if (validacaoLiga) return validacaoLiga
    }

    const duplicate = await findCadastroDuplicate(cadastro.email)
    if (duplicate) return error(duplicateMessage(duplicate), 409)

    const { data: existing } = await supabase
      .from('CandidaturaEquipe')
      .select('id')
      .eq('email', cadastro.email)
      .in('status', ['PENDENTE', 'APROVADA', 'ATIVA'])
      .maybeSingle()

    if (existing) return error('Já existe uma candidatura pendente com este e-mail', 409)

    const senhaHash = await bcrypt.hash(senha, 10)

    const { data, error: err } = await supabase
      .from('CandidaturaEquipe')
      .insert({
        id: randomUUID(),
        ...cadastro,
        senhaHash,
        status: 'ATIVA',
        instagram: instagram?.replace(/^@/, '').trim() || null,
        ligaId,
        diasDisponiveis: JSON.stringify(diasDisponiveis),
        horarios: JSON.stringify(horarios),
        quadraInfo: JSON.stringify(quadraInfo),
      })
      .select()
      .single()

    if (err) throw err

    const equipe = await ensureEquipeForCandidatura(data.id)
    let inscricaoCriada = false
    if (targetLigaId && equipe?.id) {
      const registrationStatus = invitation ? 'APROVADA' : 'SOLICITADA'
      const { data: inscricao, error: inscricaoErr } = await supabase
        .from('InscricaoCampeonato')
        .upsert({
          ligaId: targetLigaId,
          equipeId: equipe.id,
          status: registrationStatus,
        }, { onConflict: 'ligaId,equipeId' })
        .select('id,ligaId,equipeId,liga:Liga(id,quantidadeEquipes,formato,quantidadeGrupos),equipe:Equipe(id,categoria,serie,nome)')
        .single()

      if (inscricaoErr) throw inscricaoErr
      if (registrationStatus === 'APROVADA' && inscricao) {
        await ensureClassificationAndCalendar(inscricao)
      }
      inscricaoCriada = true
    }

    if (conviteToken) {
      await supabase
        .from('ConviteEquipe')
        .update({ status: 'ACEITO', candidaturaEquipeId: data.id, aceitoEm: new Date().toISOString() })
        .eq('token', conviteToken)
        .eq('ligaId', targetLigaId)
        .eq('email', cadastro.email)
    }

    try {
      await sendEmail({
        to: cadastro.email,
        subject: 'Cadastro recebido - volei.space',
        html: emailCadastroRecebido(cadastro.nome, 'equipe'),
      })
    } catch (emailErr) {
      console.error('[candidaturas/equipes] erro ao enviar e-mail de cadastro', emailErr)
    }
    const token = await signPublicToken({ userId: data.id, email: cadastro.email, nome: cadastro.responsavel || cadastro.nome, tipo: 'equipe', status: data.status || 'ATIVA' })
    const cookie = setTokenCookie(token)
    const res = success({
      id: data.id,
      equipeId: equipe?.id ?? null,
      inscricaoCriada,
      mensagem: inscricaoCriada
        ? invitation
          ? 'Cadastro concluído. O convite foi aceito e sua equipe já está aprovada neste campeonato.'
          : 'Cadastro concluído. Sua equipe foi enviada ao organizador para análise neste campeonato.'
        : 'Cadastro concluído. Sua equipe já pode solicitar inscrição em campeonatos.',
    }, 201)
    res.cookies.set(cookie.name, cookie.value, cookie.options as Parameters<typeof res.cookies.set>[2])
    return res
  } catch (err) {
    const detail = errorDetail(err)
    const duplicateError = duplicateDatabaseMessage(detail)
    if (duplicateError) return error(duplicateError, 409)
    console.error('[candidaturas/equipes] erro ao registrar candidatura', err)
    return error(`Erro ao registrar candidatura: ${detail}`, 500)
  }
}

async function getValidInvitation(token: string, email: string) {
  const { data, error: invitationError } = await supabase
    .from('ConviteEquipe')
    .select('id,ligaId,email,status')
    .eq('token', token)
    .eq('email', email)
    .in('status', ['ENVIADO', 'ACEITO'])
    .maybeSingle()

  if (invitationError) throw invitationError
  return data
}

async function validateChampionshipRegistration(ligaId: number) {
  const { data: liga, error: ligaErr } = await supabase
    .from('Liga')
    .select('id,status,quantidadeEquipes,inscricoesAbertas')
    .eq('id', ligaId)
    .single()

  if (ligaErr || !liga) return error('Campeonato não encontrado.', 404)
  if (!['EM_BREVE', 'ATIVA'].includes(liga.status)) return error('Campeonato não está aberto para inscrição.', 400)
  if (liga.inscricoesAbertas === false) return error('As inscrições deste campeonato estão fechadas.', 400)

  const aprovadas = await countApprovedRegistrations(ligaId)
  if (liga.quantidadeEquipes && aprovadas >= liga.quantidadeEquipes) {
    return error('O limite de equipes aprovadas deste campeonato já foi atingido.', 400)
  }

  return null
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
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (!createError && created?.id) return created.id

  return created?.id ?? null
}
