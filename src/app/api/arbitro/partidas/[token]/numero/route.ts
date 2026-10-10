import { NextRequest } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { success, error } from '@/lib/api-response'
import { requireArbitroPartidaAccess } from '@/lib/arbitro-access'
import { NUMERO_SEM_CAMISA, numeroNaPartida, passagemDeNumeroCamisa } from '@/lib/numero-camisa-partida'
import { inserirSumulaPresenca, registrarOcorrencia } from '@/lib/sumula-presenca'

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
  const daEquipe = atletas.filter((jogador: { equipeId: number }) => Number(jogador.equipeId) === Number(atleta.equipeId))
  const atual = presencas.find((item: { jogadorId: number }) => Number(item.jogadorId) === Number(atleta.id))
  const efetivo = numeroNaPartida(atleta, presencas)

  if (parsed.data.numero == null) {
    if (atual == null || atual.numero == null) {
      return success(atual ?? vazio(atleta))
    }
    const gravado = await gravarNumero(access.partida.id, atleta, null, atual)
    if (!gravado) return error('Não foi possível salvar o número da camisa.', 500)
    await registrarTroca(access, atleta.id, efetivo, null)
    return success(gravado)
  }

  const plano = passagemDeNumeroCamisa({
    jogadorId: atleta.id,
    numero: parsed.data.numero,
    atletas: daEquipe,
    presencas,
  })
  if ('erro' in plano) return error(plano.erro, 422)
  if (parsed.data.numero === efetivo && plano.atribuicoes.length === 1) {
    return success({ ...(atual ?? vazio(atleta)), aviso: null, deslocados: [] })
  }

  const deslocados = []
  let editado = null
  for (const item of plano.atribuicoes) {
    const alvo = daEquipe.find((jogador: { id: number }) => Number(jogador.id) === item.jogadorId)
    if (!alvo) return error('Este atleta não joga esta partida.', 422)
    const linha = presencas.find((presenca: { jogadorId: number }) => Number(presenca.jogadorId) === item.jogadorId)
    const valor = item.numero == null ? NUMERO_SEM_CAMISA : item.numero
    const gravado = await gravarNumero(access.partida.id, alvo, valor, linha)
    if (!gravado) return error('Não foi possível salvar o número da camisa.', 500)
    if (item.jogadorId === Number(atleta.id)) editado = gravado
    else deslocados.push(gravado)
  }

  await registrarTroca(access, atleta.id, efetivo, parsed.data.numero)
  return success({ ...(editado ?? vazio(atleta)), aviso: plano.aviso, deslocados })
}

function vazio(atleta: { id: number; equipeId: number }) {
  return { id: null, jogadorId: atleta.id, equipeId: atleta.equipeId, presente: null, numero: null }
}

async function gravarNumero(
  partidaId: number,
  atleta: { id: number; equipeId: number },
  numero: number | null,
  atual: { id: number } | undefined,
) {
  const gravado = atual
    ? await supabase.from('SumulaPresenca').update({ numero }).eq('id', atual.id).select(COLUNAS).single()
    : await inserirSumulaPresenca(supabase, {
      partidaId,
      jogadorId: atleta.id,
      equipeId: atleta.equipeId,
      presente: null,
      numero,
    })

  let data = gravado.data
  let falha = gravado.error
  if (falha && !atual && falha.code === '23505') {
    const repetido = await supabase
      .from('SumulaPresenca')
      .update({ numero })
      .eq('partidaId', partidaId)
      .eq('jogadorId', atleta.id)
      .select(COLUNAS)
      .single()
    data = repetido.data
    falha = repetido.error
  }

  if (falha || !data) {
    console.error('[numero-camisa] falha ao gravar', falha)
    return null
  }
  return data
}

async function registrarTroca(
  access: { partida: { id: number }; candidatura: { arbitroId?: number | null } },
  jogadorId: number,
  anterior: number | null,
  proximo: number | null,
) {
  const de = anterior == null ? 'sem número' : String(anterior)
  const para = proximo == null ? 'sem número' : String(proximo)
  await registrarOcorrencia(supabase, {
    partidaId: access.partida.id,
    tipo: 'OBSERVACAO',
    jogadorId,
    descricao: `Registro de número de camisa pelo árbitro ${access.candidatura.arbitroId ?? 'sem identificação'} em ${new Date().toISOString()}: atleta ${jogadorId} passou de ${de} para ${para}`,
  })
}
