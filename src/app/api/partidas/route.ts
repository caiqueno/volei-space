import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { success, error } from '@/lib/api-response'
import { exigirOrganizadorOuAdminDaLiga } from '@/lib/organizador-isolamento'
import { idInteiroPositivoSchema, partidaSchema } from '@/lib/schemas'
import { rejectIfCampeonatoFinalizado } from '@/lib/championship-finalization'
import { PARTIDA_PUBLICA_COLUNAS, normalizarPartidaPublica } from '@/lib/partida-publica'
import { consultarComVaga } from '@/lib/consulta-vaga'
import { categoriaCampeonatoDaPartida, equipesPertencemALiga } from '@/lib/partida-equipes'
import { grupoComumDasEquipes, recusarJogoDeGrupoCruzado } from '@/lib/confronto-grupo'
import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'

const categoriaCampeonatoIdSchema = z.string().uuid()

function inteiroDaQuery(params: URLSearchParams, nome: string) {
  if (!params.has(nome)) return { ok: true as const, valor: undefined }
  const parsed = idInteiroPositivoSchema.safeParse(params.get(nome))
  if (!parsed.success) return { ok: false as const }
  return { ok: true as const, valor: parsed.data }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    if (searchParams.has('serie')) return error('A série não separa mais a categoria. Use a categoria do campeonato.', 422)
    const ligaId = inteiroDaQuery(searchParams, 'ligaId')
    const rodada = inteiroDaQuery(searchParams, 'rodada')
    if (!ligaId.ok || !rodada.ok) return error('Identificador inválido.', 422)
    const categoria = searchParams.get('categoria')
    let categoriaCampeonatoId: string | undefined
    if (searchParams.has('categoriaCampeonatoId')) {
      const parsed = categoriaCampeonatoIdSchema.safeParse(searchParams.get('categoriaCampeonatoId'))
      if (!parsed.success) return error('Identificador inválido.', 422)
      categoriaCampeonatoId = parsed.data
    }

    const { data: simuladas } = await supabase.from('Liga').select('id').eq('simulacao', true)
    const simulacaoIds = (simuladas ?? []).map((liga) => liga.id)

    const colunas = `${PARTIDA_PUBLICA_COLUNAS},liga:Liga!Partida_ligaId_fkey(id,nome,simulacao)`
    const { data, error: err } = await consultarComVaga(colunas, (select) => {
      let q = supabase
        .from('Partida')
        .select(select)
        .order('dataHora', { ascending: true, nullsFirst: false })
        .order('rodada', { ascending: true })
        .order('id', { ascending: true })

      if (ligaId.valor) q = q.eq('ligaId', ligaId.valor)
      if (simulacaoIds.length) q = q.not('ligaId', 'in', `(${simulacaoIds.join(',')})`)
      if (categoriaCampeonatoId) q = q.eq('categoriaCampeonatoId', categoriaCampeonatoId)
      if (categoria) q = q.eq('categoria', categoria)
      if (rodada.valor) q = q.eq('rodada', rodada.valor)
      return q
    })
    if (err) throw err
    const partidas = (data ?? []).map((partida: any) => normalizarPartidaPublica(partida)).filter((partida: any): partida is NonNullable<typeof partida> => Boolean(partida))
    return success(partidas)
  } catch (err) {
    console.error('[api/partidas] erro ao buscar partidas', err)
    return error('Não foi possível carregar os jogos agora. Tente novamente em instantes.', 500)
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = partidaSchema.safeParse(body)
    if (!parsed.success) return error('Dados inválidos', 422, parsed.error.flatten())
    const acesso = await exigirOrganizadorOuAdminDaLiga(req, Number(parsed.data.ligaId))
    if (acesso instanceof NextResponse) return acesso
    const bloqueio = await rejectIfCampeonatoFinalizado(Number(parsed.data.ligaId))
    if (bloqueio) return bloqueio

    const equipesInvalidas = await equipesPertencemALiga(parsed.data.equipeAId, parsed.data.equipeBId, parsed.data.ligaId)
    if (equipesInvalidas) return error(equipesInvalidas, 422)

    const categoriaId = await categoriaCampeonatoDaPartida(parsed.data.ligaId, parsed.data.categoria)
    if (!categoriaId) return error('Esta categoria não está disponível no campeonato.', 422)
    const foraDoGrupo = await recusarJogoDeGrupoCruzado({
      ligaId: parsed.data.ligaId,
      categoriaCampeonatoId: categoriaId,
      fase: 'GRUPOS',
      equipeAId: parsed.data.equipeAId,
      equipeBId: parsed.data.equipeBId,
    })
    if (foraDoGrupo) return error(foraDoGrupo, 422)
    const grupoId = await grupoComumDasEquipes(parsed.data.ligaId, categoriaId, parsed.data.equipeAId, parsed.data.equipeBId)

    const token = uuidv4()
    const { data, error: err } = await supabase
      .from('Partida')
      .insert({
        ...parsed.data,
        serie: null,
        categoriaCampeonatoId: categoriaId,
        sumulaToken: token,
        sumulaTokenExpira: null,
        ...(grupoId != null ? { fase: 'GRUPOS', grupoId } : {}),
      })
      .select()
      .single()
    if (err) throw err
    return success(data, 201)
  } catch (err) {
    console.error('[api/partidas] erro ao criar partida', err)
    return error('Não foi possível criar a partida agora. Tente novamente em instantes.', 500)
  }
}
