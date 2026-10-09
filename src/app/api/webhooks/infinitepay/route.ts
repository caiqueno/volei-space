import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { validateWebhookSignature, InfinitePayWebhookPayload, parseExternalId, pagamentoConfereExternalId } from '@/lib/infinitepay'
import { sendEmail, emailEquipeAtivada } from '@/lib/email'
import { slugifyUnique } from '@/utils/slug'

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-infinitepay-signature')

  if (!validateWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Assinatura inválida' }, { status: 401 })
  }

  let payload: InfinitePayWebhookPayload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
  }

  if (payload.status !== 'paid') {
    return NextResponse.json({ received: true })
  }

  const externo = parseExternalId(payload.external_id ?? '')
  if (!externo || !payload.id) {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
  }

  try {
    const resultado = await processarPagamentoConfirmado(payload, externo)
    return resultado
  } catch (err) {
    console.error('Webhook processing error:', err)
    return NextResponse.json({ error: 'Não foi possível processar o pagamento' }, { status: 500 })
  }
}

async function processarPagamentoConfirmado(
  payload: InfinitePayWebhookPayload,
  externo: { tipo: 'equipe' | 'arbitro'; candidaturaId: string },
) {
  const { data: pagamento, error: pagErr } = await supabase
    .from('Pagamento')
    .select('id,status,descricao,infinitePayId')
    .eq('infinitePayId', payload.id)
    .maybeSingle()
  if (pagErr) throw pagErr
  if (!pagamento) return NextResponse.json({ error: 'Pagamento não encontrado' }, { status: 422 })
  if (pagamento.status === 'PAGO') return NextResponse.json({ received: true })

  if (externo.tipo === 'equipe') {
    const { data: candidatura, error: candErr } = await supabase
      .from('CandidaturaEquipe')
      .select('*')
      .eq('id', externo.candidaturaId)
      .maybeSingle()
    if (candErr) throw candErr
    if (!candidatura || !pagamentoConfereExternalId(pagamento, payload.external_id, { id: candidatura.id, pagamentoId: candidatura.pagamentoId })) {
      return NextResponse.json({ error: 'Pagamento não confere' }, { status: 422 })
    }
    if (!(await reivindicarPagamento(pagamento.id, payload))) return NextResponse.json({ received: true })
    if (candidatura.status !== 'ATIVA' && !candidatura.equipeId) await ativarEquipe(candidatura)
    return NextResponse.json({ received: true })
  }

  const { data: candidatura, error: candErr } = await supabase
    .from('CandidaturaArbitro')
    .select('*')
    .eq('id', externo.candidaturaId)
    .maybeSingle()
  if (candErr) throw candErr
  if (!candidatura || !pagamentoConfereExternalId(pagamento, payload.external_id, { id: candidatura.id, pagamentoId: null })) {
    return NextResponse.json({ error: 'Pagamento não confere' }, { status: 422 })
  }
  if (!(await reivindicarPagamento(pagamento.id, payload))) return NextResponse.json({ received: true })
  if (candidatura.status !== 'ATIVA' && !candidatura.arbitroId) await ativarArbitro(candidatura)
  return NextResponse.json({ received: true })
}

async function reivindicarPagamento(pagamentoId: string, payload: InfinitePayWebhookPayload) {
  const { data, error: updateErr } = await supabase
    .from('Pagamento')
    .update({ status: 'PAGO', pagoEm: new Date().toISOString(), webhookPayload: JSON.stringify(payload) })
    .eq('id', pagamentoId)
    .neq('status', 'PAGO')
    .select('id')
  if (updateErr) throw updateErr
  return Array.isArray(data) && data.length > 0
}

async function ativarEquipe(candidatura: { id: string; status: string; equipeId?: number | null; nome: string; email: string; ligaId: number; categoria: string; serie: string; diasDisponiveis: string; horarios: string; quadraInfo: string }) {
  if (candidatura.status === 'ATIVA' || candidatura.equipeId) return

  // Generate unique slug for the team
  const slug = await slugifyUnique(candidatura.nome)

  // Create Equipe in DB
  const { data: equipe } = await supabase
    .from('Equipe')
    .insert({
      nome: candidatura.nome,
      ligaId: candidatura.ligaId,
      categoria: candidatura.categoria,
      serie: candidatura.serie,
      slug,
      statusEquipe: 'ATIVA',
      diasDisponiveis: candidatura.diasDisponiveis,
      horarios: candidatura.horarios,
      quadraInfo: candidatura.quadraInfo,
      inscricaoAtiva: true,
    })
    .select()
    .single()

  if (!equipe) return

  // Update candidatura to ATIVA, link equipeId
  await supabase
    .from('CandidaturaEquipe')
    .update({ status: 'ATIVA', equipeId: equipe.id })
    .eq('id', candidatura.id)
    .is('equipeId', null)

  // Send email with registration link
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'
  const linkInscricao = `${appUrl}/inscricao/${slug}`

  try {
    await sendEmail({
      to: candidatura.email,
      subject: '✅ Pagamento confirmado — Cadastre seus jogadores',
      html: emailEquipeAtivada(candidatura.nome, linkInscricao),
    })
  } catch (emailErr) {
    console.error('Email error:', emailErr)
  }
}

async function ativarArbitro(candidatura: { id: string; status: string; arbitroId?: number | null; nome: string; email: string; telefone?: string | null; cref?: string | null; diplomaUrl?: string | null }) {
  if (candidatura.status === 'ATIVA' || candidatura.arbitroId) return

  // Create or update Arbitro
  const { data: arbitro } = await supabase
    .from('Arbitro')
    .upsert({
      nome: candidatura.nome,
      email: candidatura.email,
      telefone: candidatura.telefone,
      cref: candidatura.cref,
      diplomaUrl: candidatura.diplomaUrl,
      aprovado: true,
    }, { onConflict: 'email' })
    .select()
    .single()

  if (!arbitro) return

  await supabase
    .from('CandidaturaArbitro')
    .update({ status: 'ATIVA', arbitroId: arbitro.id })
    .eq('id', candidatura.id)
    .is('arbitroId', null)
}
