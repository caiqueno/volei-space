import { NextRequest } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { success, error } from '@/lib/api-response'
import { requireArbitroPartidaAccess } from '@/lib/arbitro-access'
import { numeroNaPartida, validarTrocaNumeroCamisa } from '@/lib/numero-camisa-partida'

const bodySchema = z.object({
  jogadorId: z.number().int().positive(),
  numero: z.number().int().min(0).max(99).nullable(),
})

const COLUNAS = 'id,jogadorId,equipeId,presente,numero'

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const access = await requireArbitroPartidaAccess(req, token)
  if (access instanceof Response) return access

  if (String(access.partida.status || '').toUpperCase() === 'ENCERRADA') {
    return error('O número da camisa não pode ser alterado depois que a partida encerra.', 409)
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return error('Informe o atleta e um número de camisa inteiro de 0 a 99.', 422)

  const atletas = [
    ...(access.partida.equipeA?.jogadores ?? []),
    ...(access.partida.equipeB?.jogadores ?? []),
  ]
  const atleta = atletas.find((jogador: { id: number }) => Number(jogador.id) === parsed.data.jogadorId)
  if (!atleta) return error('Este atleta não joga esta partida.', 422)

  const { data: presencasEquipe, error: leituraErr } = await supabase
    .from('SumulaPresenca')
    .select(COLUNAS)
    .eq('partidaId', access.partida.id)
    .eq('equipeId', atleta.equipeId)

  if (leituraErr) return error('Não foi possível conferir os números desta equipe.', 500)

  const presencas = presencasEquipe ?? []
  const mensagem = validarTrocaNumeroCamisa({
    jogadorId: atleta.id,
    numero: parsed.data.numero,
    atletas: atletas.filter((jogador: { equipeId: number }) => Number(jogador.equipeId) === Number(atleta.equipeId)),
    presencas,
  })
  if (mensagem) return error(mensagem, 422)

  const atual = presencas.find((item: { jogadorId: number }) => Number(item.jogadorId) === Number(atleta.id))
  const efetivo = numeroNaPartida(atleta, presencas)
  if (parsed.data.numero === efetivo || (parsed.data.numero == null && (atual == null || atual.numero == null))) {
    return success(atual ?? {
      id: null,
      jogadorId: atleta.id,
      equipeId: atleta.equipeId,
      presente: null,
      numero: null,
    })
  }

  const gravado = atual
    ? await supabase.from('SumulaPresenca').update({ numero: parsed.data.numero }).eq('id', atual.id).select(COLUNAS).single()
    : await supabase.from('SumulaPresenca').insert({
      partidaId: access.partida.id,
      jogadorId: atleta.id,
      equipeId: atleta.equipeId,
      presente: null,
      numero: parsed.data.numero,
    }).select(COLUNAS).single()

  let data = gravado.data
  let falha = gravado.error
  if (falha && !atual && falha.code === '23505') {
    const repetido = await supabase
      .from('SumulaPresenca')
      .update({ numero: parsed.data.numero })
      .eq('partidaId', access.partida.id)
      .eq('jogadorId', atleta.id)
      .select(COLUNAS)
      .single()
    data = repetido.data
    falha = repetido.error
  }

  if (falha || !data) {
    console.error('[numero-camisa] falha ao gravar', falha)
    return error('Não foi possível salvar o número da camisa.', 500)
  }

  const anterior = efetivo == null ? 'sem número' : String(efetivo)
  const proximo = data.numero == null ? 'sem número' : String(data.numero)
  await supabase.from('OcorrenciaPartida').insert({
    partidaId: access.partida.id,
    tipo: 'OBSERVACAO',
    jogadorId: atleta.id,
    descricao: `Registro de número de camisa pelo árbitro ${access.candidatura.arbitroId ?? 'sem identificação'} em ${new Date().toISOString()}: atleta ${atleta.id} passou de ${anterior} para ${proximo}`,
  })

  return success(data)
}
