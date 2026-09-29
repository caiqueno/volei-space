import { NextRequest } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { success, error } from '@/lib/api-response'
import { requireArbitroPartidaAccess } from '@/lib/arbitro-access'

const bodySchema = z.object({
  jogadorId: z.number().int().positive(),
  presente: z.boolean(),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const access = await requireArbitroPartidaAccess(req, token)
  if (access instanceof Response) return access

  if (String(access.partida.status || '').toUpperCase() === 'ENCERRADA') {
    return error('A presença não pode ser alterada depois que a partida encerra.', 409)
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return error('Informe o atleta e a presença.', 422)

  const atletas = [
    ...(access.partida.equipeA?.jogadores ?? []),
    ...(access.partida.equipeB?.jogadores ?? []),
  ]
  const atleta = atletas.find((jogador: { id: number }) => Number(jogador.id) === parsed.data.jogadorId)
  if (!atleta) return error('Este atleta não joga esta partida.', 422)

  const { data, error: presencaErr } = await supabase
    .from('SumulaPresenca')
    .upsert({
      partidaId: access.partida.id,
      jogadorId: atleta.id,
      equipeId: atleta.equipeId,
      presente: parsed.data.presente,
    }, { onConflict: 'partidaId,jogadorId' })
    .select('id,jogadorId,equipeId,presente')
    .single()

  if (presencaErr || !data) return error('Não foi possível salvar a presença.', 500)

  await supabase.from('OcorrenciaPartida').insert({
    partidaId: access.partida.id,
    tipo: 'OBSERVACAO',
    jogadorId: atleta.id,
    descricao: `Registro de presença pelo árbitro ${access.candidatura.arbitroId ?? 'sem identificação'} em ${new Date().toISOString()}: atleta ${atleta.id} ${parsed.data.presente ? 'confirmado' : 'ausente'}`,
  })

  return success(data)
}
