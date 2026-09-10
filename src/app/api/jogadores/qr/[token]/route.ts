// Endpoint PÚBLICO (sem auth) — é literalmente o conteúdo apontado pelo QR
// Code impresso/exibido ao atleta. Por isso o payload é propositalmente
// restrito a nome completo + foto (conferência visual), nunca dados
// pessoais (CPF, RG, data de nascimento, telefone, e-mail, documentos).
// Confirmado por auditoria que nenhuma tela do app consome este GET — o
// fluxo real de check-in do árbitro (POST
// /api/arbitro/partidas/[token]/validar-qr) é autenticado e faz sua própria
// query, com campos operacionais adicionais; esse outro endpoint não foi
// alterado por esta refatoração.
import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { success, error } from '@/lib/api-response'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const { data: jogador, error: err } = await supabase
    .from('Jogador')
    .select('nome, fotoRostoUrl, fotoUrl, qrCodeGeradoEm')
    .eq('qrCodeToken', token)
    .single()

  if (err || !jogador) return error('QR Code inválido ou jogador não encontrado', 404)

  return success({
    nomeCompleto: jogador.nome,
    fotoUrl: jogador.fotoRostoUrl ?? jogador.fotoUrl ?? null,
    qrCodeGeradoEm: jogador.qrCodeGeradoEm,
  })
}
