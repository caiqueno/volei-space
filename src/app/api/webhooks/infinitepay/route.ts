import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import {
  validateWebhookSignature,
  infinitePayWebhookSchema,
  paymentAmountsMatch,
  type InfinitePayWebhookPayload,
} from '@/lib/infinitepay'
import { sendEmail, emailEquipeAtivada } from '@/lib/email'
import { slugifyUnique } from '@/utils/slug'

class WebhookFalha extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'WebhookFalha'
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-infinitepay-signature')

  if (!validateWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Assinatura inválida' }, { status: 401 })
  }

  let payload: InfinitePayWebhookPayload
  try {
    payload = infinitePayWebhookSchema.parse(JSON.parse(rawBody))
  } catch {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
  }

  if (payload.status !== 'paid') {
    return NextResponse.json({ received: true })
  }

  const externo = /^(equipe|arbitro):([a-z0-9-]{8,64})$/i.exec(payload.external_id)
  if (!externo) return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
  const tipo = externo[1].toLowerCase()
  const candidaturaId = externo[2]

  try {
    if (tipo === 'equipe') await handleEquipePagamento(candidaturaId, payload)
    else await handleArbitroPagamento(candidaturaId, payload)
  } catch (err) {
    if (err instanceof WebhookFalha) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('Webhook processing error:', err)
    return NextResponse.json({ error: 'Não foi possível processar o pagamento.' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

async function pagamentoDoEvento(payload: InfinitePayWebhookPayload) {
  const { data: pagamento, error } = await supabase
    .from('Pagamento')
    .select('id,valor,status')
    .eq('infinitePayId', payload.id)
    .maybeSingle()
  if (error) throw error
  if (!pagamento) throw new WebhookFalha('Pagamento não localizado para este evento.', 422)
  if (!paymentAmountsMatch(Number(pagamento.valor), payload.amount)) {
    throw new WebhookFalha('O valor informado não confere com a cobrança.', 422)
  }
  return pagamento
}

function dataPaga(paidAt?: string) {
  if (!paidAt) return new Date().toISOString()
  const data = new Date(paidAt)
  return Number.isNaN(data.getTime()) ? new Date().toISOString() : data.toISOString()
}

async function marcarPago(pagamentoId: string, payload: InfinitePayWebhookPayload) {
  const { error } = await supabase
    .from('Pagamento')
    .update({
      status: 'PAGO',
      pagoEm: dataPaga(payload.paid_at),
      webhookPayload: JSON.stringify(payload),
    })
    .eq('id', pagamentoId)
  if (error) throw error
}

async function handleEquipePagamento(candidaturaId: string, payload: InfinitePayWebhookPayload) {
  const pagamento = await pagamentoDoEvento(payload)

  const { data: candidatura, error: candidaturaErr } = await supabase
    .from('CandidaturaEquipe')
    .select('id,nome,email,ligaId,categoria,serie,diasDisponiveis,horarios,quadraInfo,status,equipeId,pagamentoId')
    .eq('id', candidaturaId)
    .maybeSingle()
  if (candidaturaErr) throw candidaturaErr
  if (!candidatura || candidatura.pagamentoId !== pagamento.id) {
    throw new WebhookFalha('O pagamento não pertence a esta candidatura.', 422)
  }

  const jaAtiva = candidatura.status === 'ATIVA' && Boolean(candidatura.equipeId)
  if (pagamento.status !== 'PAGO') await marcarPago(pagamento.id, payload)
  if (jaAtiva) return

  let equipeId = candidatura.equipeId as number | null
  let slug = ''
  if (!equipeId) {
    let busca = supabase
      .from('Equipe')
      .select('id,slug')
      .eq('ligaId', candidatura.ligaId)
      .eq('nome', candidatura.nome)
      .eq('categoria', candidatura.categoria)
    busca = candidatura.serie == null ? busca.is('serie', null) : busca.eq('serie', candidatura.serie)
    const { data: existente, error: existenteErr } = await busca.limit(1)
    if (existenteErr) throw existenteErr
    equipeId = existente?.[0]?.id ?? null
    slug = existente?.[0]?.slug ?? ''
  }

  if (!equipeId) {
    slug = await slugifyUnique(candidatura.nome)
    const { data: equipe, error: equipeErr } = await supabase
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
      .select('id')
      .single()
    if (equipeErr) throw equipeErr
    if (!equipe) throw new WebhookFalha('Não foi possível ativar a equipe.', 500)
    equipeId = equipe.id
  }

  const { error: ativaErr } = await supabase
    .from('CandidaturaEquipe')
    .update({ status: 'ATIVA', equipeId })
    .eq('id', candidaturaId)
  if (ativaErr) throw ativaErr

  if (!slug) return
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'
  try {
    await sendEmail({
      to: candidatura.email,
      subject: '✅ Pagamento confirmado — Cadastre seus jogadores',
      html: emailEquipeAtivada(candidatura.nome, `${appUrl}/inscricao/${slug}`),
    })
  } catch (emailErr) {
    console.error('Email error:', emailErr)
  }
}

async function handleArbitroPagamento(candidaturaId: string, payload: InfinitePayWebhookPayload) {
  await pagamentoDoEvento(payload)
  const { data: candidatura, error } = await supabase
    .from('CandidaturaArbitro')
    .select('id')
    .eq('id', candidaturaId)
    .maybeSingle()
  if (error) throw error
  if (!candidatura) throw new WebhookFalha('O pagamento não pertence a esta candidatura.', 422)
  // CandidaturaArbitro não tem pagamentoId. Sem essa coluna não dá para provar o vínculo.
  throw new WebhookFalha('O pagamento não pertence a esta candidatura.', 422)
}
