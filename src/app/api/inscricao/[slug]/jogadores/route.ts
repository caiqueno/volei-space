import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { success, error } from '@/lib/api-response'
import { playerInscricaoSchema } from '@/lib/schemas'
import { generateQRToken, generateQRCodeDataUrl } from '@/lib/qrcode'
import { sendEmail, emailQRCodeJogador } from '@/lib/email'

const DUPLICATE_NUMBER_MESSAGE = 'Este número já está sendo utilizado por outro atleta desta equipe.'

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  // Verify team exists and inscription is active
  const { data: equipe, error: equipeErr } = await supabase
    .from('Equipe')
    .select('id, nome, inscricaoAtiva')
    .eq('slug', slug)
    .single()

  if (equipeErr || !equipe) return error('Equipe não encontrada', 404)
  if (!equipe.inscricaoAtiva) return error('Inscrições encerradas para esta equipe', 403)

  try {
    const body = await req.json()
    const parsed = playerInscricaoSchema.safeParse(body)
    if (!parsed.success) return error('Dados inválidos', 422, parsed.error.flatten())

    const documentoTipo = parsed.data.documentoTipo?.trim() || 'CPF'
    const documentoRaw = parsed.data.documentoNumero?.trim() || parsed.data.cpf?.trim() || ''
    const documentoNumero = documentoTipo === 'CPF' ? documentoRaw.replace(/\D/g, '') : documentoRaw
    const cpfNormalized = documentoTipo === 'CPF' ? documentoNumero : null
    if (!documentoNumero) return error('Documento obrigatório', 422)

    // Check duplicate document in same team
    const { data: existingPlayer } = await supabase
      .from('Jogador')
      .select('id')
      .eq('equipeId', equipe.id)
      .eq('documentoTipo', documentoTipo)
      .eq('documentoNumero', documentoNumero)
      .maybeSingle()

    if (existingPlayer) return error('Documento já cadastrado nesta equipe', 409)

    if (parsed.data.numero !== undefined && parsed.data.numero !== null) {
      const { data: existingNumber, error: numberErr } = await supabase
        .from('Jogador')
        .select('id')
        .eq('equipeId', equipe.id)
        .eq('numero', parsed.data.numero)
        .eq('banido', false)
        .limit(1)

      if (numberErr) return error('Erro ao validar número de camisa.', 500)
      if (existingNumber?.length) return error(DUPLICATE_NUMBER_MESSAGE, 409)
    }

    // Generate QR Code token
    const qrCodeToken = generateQRToken()

    // Create player
    const { data: jogador, error: insertErr } = await supabase
      .from('Jogador')
      .insert({
        nome: parsed.data.nome,
        equipeId: equipe.id,
        cpf: cpfNormalized,
        documentoTipo,
        documentoNumero,
        dataNascimento: new Date(parsed.data.dataNascimento).toISOString(),
        telefone: parsed.data.celular,
        telefoneEmergencia: parsed.data.telefoneEmergencia,
        fotoRostoUrl: parsed.data.fotoRostoUrl || null,
        posicao: parsed.data.posicao || null,
        numero: parsed.data.numero ?? null,
        qrCodeToken,
        qrCodeGeradoEm: new Date().toISOString(),
        autoRegistrado: true,
      })
      .select()
      .single()

    if (insertErr) {
      if (isDuplicateJerseyNumberDbError(insertErr)) return error(DUPLICATE_NUMBER_MESSAGE, 409)
      throw insertErr
    }

    // Generate QR Code image
    const qrCodeDataUrl = await generateQRCodeDataUrl(qrCodeToken)

    // Send email with QR Code
    try {
      await sendEmail({
        to: parsed.data.email,
        subject: `🏐 Sua credencial volei.space — ${equipe.nome}`,
        html: emailQRCodeJogador(parsed.data.nome, qrCodeDataUrl, equipe.nome),
      })
    } catch (emailErr) {
      console.error('Email error (non-fatal):', emailErr)
    }

    // Return QR Code data URL so frontend can display it immediately
    return success({
      jogadorId: jogador.id,
      qrCodeToken,
      qrCodeDataUrl,
      mensagem: 'Cadastro realizado com sucesso! Seu QR Code foi enviado por e-mail.',
    }, 201)
  } catch {
    return error('Erro ao cadastrar jogador', 500)
  }
}

function isDuplicateJerseyNumberDbError(err: any) {
  return err?.code === '23505' && String(err.message ?? err.details ?? '').includes('Jogador_equipe_numero_ativo_unique')
}
