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
import { normalizarNomeEquipe } from '@/lib/nome-equipe'

type ErroBanco = { code?: string; message?: string } | null

class FalhaWebhook extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'FalhaWebhook'
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
    console.error('[infinitepay] falha ao processar webhook', payload.id, tipo, candidaturaId, err)
    if (err instanceof FalhaWebhook) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: 'Não foi possível processar o pagamento.' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

function recusarBanco(contexto: string, erro: ErroBanco): never {
  console.error(`[infinitepay] ${contexto}`, erro)
  if (erro?.code === '23505') {
    throw new FalhaWebhook('Pagamento não confere com a candidatura.', 422)
  }
  throw new FalhaWebhook('Não foi possível processar o pagamento.', 500)
}

function dataPaga(paidAt?: string) {
  if (!paidAt) return new Date().toISOString()
  const data = new Date(paidAt)
  return Number.isNaN(data.getTime()) ? new Date().toISOString() : data.toISOString()
}

async function handleEquipePagamento(candidaturaId: string, payload: InfinitePayWebhookPayload) {
  const valorRecebido = payload.amount
  const { data: candidatura, error: candidaturaErr } = await supabase
    .from('CandidaturaEquipe')
    .select('id,nome,email,categoria,serie,ligaId,status,equipeId,pagamentoId,diasDisponiveis,horarios,quadraInfo')
    .eq('id', candidaturaId)
    .maybeSingle()
  if (candidaturaErr) recusarBanco('leitura da candidatura de equipe', candidaturaErr)
  if (!candidatura?.pagamentoId) throw new FalhaWebhook('Pagamento não confere com a candidatura.', 422)

  const { data: pagamento, error: pagamentoErr } = await supabase
    .from('Pagamento')
    .select('id,infinitePayId,status,valor')
    .eq('id', candidatura.pagamentoId)
    .maybeSingle()
  if (pagamentoErr) recusarBanco('leitura do pagamento da equipe', pagamentoErr)
  if (!pagamento) throw new FalhaWebhook('Pagamento não confere com a candidatura.', 422)
  if (pagamento.infinitePayId && pagamento.infinitePayId !== payload.id) {
    throw new FalhaWebhook('Pagamento não confere com a candidatura.', 422)
  }
  if (!paymentAmountsMatch(Number(pagamento.valor), valorRecebido)) {
    throw new FalhaWebhook('Pagamento não confere com a candidatura.', 422)
  }

  if (!pagamento.infinitePayId) {
    const { data: outro, error: outroErr } = await supabase
      .from('Pagamento')
      .select('id')
      .eq('infinitePayId', payload.id)
      .maybeSingle()
    if (outroErr) recusarBanco('conflito de identificador do pagamento', outroErr)
    if (outro && outro.id !== pagamento.id) throw new FalhaWebhook('Pagamento não confere com a candidatura.', 422)
  }

  if (pagamento.status !== 'PAGO') {
    const { error: pagoErr } = await supabase
      .from('Pagamento')
      .update({
        status: 'PAGO',
        pagoEm: dataPaga(payload.paid_at),
        webhookPayload: JSON.stringify(payload),
        infinitePayId: payload.id,
      })
      .eq('id', pagamento.id)
    if (pagoErr) recusarBanco('atualização do pagamento da equipe', pagoErr)
  }

  if (candidatura.equipeId) {
    if (candidatura.status !== 'ATIVA') {
      const { error: statusErr } = await supabase
        .from('CandidaturaEquipe')
        .update({ status: 'ATIVA' })
        .eq('id', candidatura.id)
      if (statusErr) recusarBanco('ativação da candidatura já vinculada', statusErr)
    }
    return
  }

  const equipe = await obterOuCriarEquipe(candidatura)
  const { data: vinculo, error: vinculoErr } = await supabase
    .from('CandidaturaEquipe')
    .update({ status: 'ATIVA', equipeId: equipe.id })
    .eq('id', candidatura.id)
    .is('equipeId', null)
    .select('id')
    .maybeSingle()
  if (vinculoErr) {
    if (equipe.criada) await descartarEquipeCriada(equipe.id)
    recusarBanco('vínculo da equipe', vinculoErr)
  }
  if (!vinculo) {
    const { data: atual, error: atualErr } = await supabase
      .from('CandidaturaEquipe')
      .select('equipeId,status')
      .eq('id', candidatura.id)
      .maybeSingle()
    if (atualErr) recusarBanco('releitura da candidatura de equipe', atualErr)
    if (equipe.criada && atual?.equipeId && atual.equipeId !== equipe.id) await descartarEquipeCriada(equipe.id)
    if (!atual?.equipeId) throw new FalhaWebhook('Não foi possível processar o pagamento.', 500)
    if (atual.status !== 'ATIVA') {
      const { error: statusErr } = await supabase.from('CandidaturaEquipe').update({ status: 'ATIVA' }).eq('id', candidatura.id)
      if (statusErr) recusarBanco('ativação após corrida da equipe', statusErr)
    }
    return
  }

  if (candidatura.status === 'ATIVA') return

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'
  const linkInscricao = `${appUrl}/inscricao/${equipe.slug}`
  try {
    await sendEmail({
      to: candidatura.email,
      subject: '✅ Pagamento confirmado — Cadastre seus jogadores',
      html: emailEquipeAtivada(candidatura.nome, linkInscricao),
    })
  } catch (emailErr) {
    console.error('[infinitepay] pagamento gravado; e-mail não enviado', emailErr)
  }
}

async function obterOuCriarEquipe(candidatura: {
  nome: string
  ligaId: number
  categoria: string
  serie: string
  diasDisponiveis: string
  horarios: string
  quadraInfo: string
}) {
  const nome = normalizarNomeEquipe(candidatura.nome)
  const slug = await slugifyUnique(nome)
  const { data, error } = await supabase
    .from('Equipe')
    .insert({
      nome,
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
    .select('id,slug')
    .single()
  if (!error && data) return { id: data.id as number, slug: String(data.slug || slug), criada: true }
  if (error?.code !== '23505') recusarBanco('criação da equipe', error)

  const { data: existente, error: leituraErr } = await supabase
    .from('Equipe')
    .select('id,slug')
    .eq('nome', nome)
    .eq('ligaId', candidatura.ligaId)
    .eq('categoria', candidatura.categoria)
    .eq('serie', candidatura.serie)
    .maybeSingle()
  if (leituraErr || !existente) recusarBanco('leitura da equipe já existente', leituraErr)
  return { id: existente.id as number, slug: String(existente.slug || slug), criada: false }
}

async function descartarEquipeCriada(equipeId: number) {
  const { error } = await supabase.from('Equipe').delete().eq('id', equipeId)
  if (error) console.error('[infinitepay] equipe órfã não removida', equipeId, error)
}

async function handleArbitroPagamento(candidaturaId: string, payload: InfinitePayWebhookPayload) {
  const { data: candidatura, error: candidaturaErr } = await supabase
    .from('CandidaturaArbitro')
    .select('id,nome,email,telefone,cref,diplomaUrl,status,arbitroId')
    .eq('id', candidaturaId)
    .maybeSingle()
  if (candidaturaErr) recusarBanco('leitura da candidatura de árbitro', candidaturaErr)
  if (!candidatura) throw new FalhaWebhook('Pagamento não confere com a candidatura.', 422)

  const { data: pagamento, error: pagamentoErr } = await supabase
    .from('Pagamento')
    .select('id,valor,status')
    .eq('infinitePayId', payload.id)
    .maybeSingle()
  if (pagamentoErr) recusarBanco('leitura do pagamento do árbitro', pagamentoErr)
  if (!pagamento || !paymentAmountsMatch(Number(pagamento.valor), payload.amount)) {
    throw new FalhaWebhook('Pagamento não confere com a candidatura.', 422)
  }

  const { data: equipeDona, error: donaErr } = await supabase
    .from('CandidaturaEquipe')
    .select('id')
    .eq('pagamentoId', pagamento.id)
    .maybeSingle()
  if (donaErr) recusarBanco('vínculo do pagamento com equipe', donaErr)
  if (equipeDona) throw new FalhaWebhook('Pagamento não confere com a candidatura.', 422)

  if (pagamento.status !== 'PAGO') {
    const { error: pagoErr } = await supabase
      .from('Pagamento')
      .update({
        status: 'PAGO',
        pagoEm: dataPaga(payload.paid_at),
        webhookPayload: JSON.stringify(payload),
      })
      .eq('id', pagamento.id)
    if (pagoErr) recusarBanco('atualização do pagamento do árbitro', pagoErr)
  }

  if (candidatura.status === 'ATIVA' && candidatura.arbitroId) return

  const { data: arbitro, error: arbitroErr } = await supabase
    .from('Arbitro')
    .upsert({
      nome: candidatura.nome,
      email: candidatura.email,
      telefone: candidatura.telefone,
      cref: candidatura.cref,
      diplomaUrl: candidatura.diplomaUrl,
      aprovado: true,
    }, { onConflict: 'email' })
    .select('id')
    .single()
  if (arbitroErr || !arbitro) recusarBanco('gravação do árbitro', arbitroErr)

  const { error: statusErr } = await supabase
    .from('CandidaturaArbitro')
    .update({ status: 'ATIVA', arbitroId: arbitro.id })
    .eq('id', candidaturaId)
  if (statusErr) recusarBanco('ativação da candidatura de árbitro', statusErr)
}
