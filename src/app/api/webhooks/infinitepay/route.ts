import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { validateWebhookSignature, InfinitePayWebhookPayload } from '@/lib/infinitepay'
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
    // Log other events but return 200 to acknowledge receipt
    return NextResponse.json({ received: true })
  }

  // Parse external_id to get tipo and candidaturaId
  // Format: "equipe:cuid" or "arbitro:cuid"
  const [tipo, candidaturaId] = (payload.external_id ?? '').split(':')

  try {
    if (tipo === 'equipe') {
      await handleEquipePagamento(candidaturaId, payload)
    } else if (tipo === 'arbitro') {
      await handleArbitroPagamento(candidaturaId, payload)
    }
  } catch (err) {
    console.error('Webhook processing error:', err)
    // Return 200 anyway so InfinitePay doesn't retry endlessly
  }

  return NextResponse.json({ received: true })
}

async function handleEquipePagamento(candidaturaId: string, payload: InfinitePayWebhookPayload) {
  // Update payment status
  await supabase
    .from('Pagamento')
    .update({ status: 'PAGO', pagoEm: new Date().toISOString(), webhookPayload: JSON.stringify(payload) })
    .eq('infinitePayId', payload.id)

  // Get candidatura
  const { data: candidatura } = await supabase
    .from('CandidaturaEquipe')
    .select('*')
    .eq('id', candidaturaId)
    .single()

  if (!candidatura || candidatura.status === 'ATIVA') return

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
    .eq('id', candidaturaId)

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

async function handleArbitroPagamento(candidaturaId: string, payload: InfinitePayWebhookPayload) {
  const { data: candidatura } = await supabase
    .from('CandidaturaArbitro')
    .select('*')
    .eq('id', candidaturaId)
    .single()

  if (!candidatura || candidatura.status === 'ATIVA') return

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
    .eq('id', candidaturaId)
}
