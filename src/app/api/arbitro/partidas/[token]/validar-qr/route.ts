import { NextRequest } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { success, error } from '@/lib/api-response'
import { requireSumulaTokenAccess } from '@/lib/sumula-access'

const schema = z.object({
  qrToken: z.string().min(1),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  try {
    const access = await requireSumulaTokenAccess(token)
    if (access instanceof Response) return access
    if (access.partida.status === 'ENCERRADA') return error('Partida já encerrada.', 400)

    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return error('QR Code invalido', 422)

    const qrToken = extractQrToken(parsed.data.qrToken)
    const { data: jogador, error: jogadorErr } = await supabase
      .from('Jogador')
      .select('id,nome,numero,posicao,fotoRostoUrl,fotoUrl,equipeId,equipe:Equipe(id,nome,logoUrl,corHex)')
      .eq('qrCodeToken', qrToken)
      .single()

    if (jogadorErr || !jogador) return error('Atleta nao encontrado para este QR Code.', 404)
    if (![access.partida.equipeAId, access.partida.equipeBId].includes(jogador.equipeId)) {
      return error('Atleta nao pertence a uma das equipes desta partida.', 400)
    }

    const { error: presencaErr } = await supabase
      .from('SumulaPresenca')
      .upsert({
        partidaId: access.partida.id,
        jogadorId: jogador.id,
        equipeId: jogador.equipeId,
        presente: true,
      }, { onConflict: 'partidaId,jogadorId' })

    if (presencaErr) throw presencaErr
    return success({ jogador, validado: true })
  } catch (err) {
    console.error('[validar-qr] erro', err)
    return error('Erro ao validar QR Code', 500)
  }
}

function extractQrToken(value: string) {
  const trimmed = value.trim()
  const match = trimmed.match(/\/api\/jogadores\/qr\/([^/?#]+)/)
  return decodeURIComponent(match?.[1] ?? trimmed)
}
