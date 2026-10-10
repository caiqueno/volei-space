import { NextRequest } from 'next/server'
import { error, success } from '@/lib/api-response'
import { requirePublicRole } from '@/lib/auth'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { rejectIfCampeonatoFinalizado } from '@/lib/championship-finalization'
import { getBracketRounds } from '@/lib/mata-mata'
import { montarConfrontosAutomaticos, ranquearGrupo } from '@/lib/chave-grupos'
import { faseContaNaClassificacao, type PartidaClassificacao } from '@/lib/classificacao'
import { gerarSumulaToken } from '@/lib/sumula-token'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const auth = await requirePublicRole(req, ['organizador'], { releasedOnly: true })
    if (auth instanceof Response) return auth

    const { id } = await context.params
    const ligaId = Number(id)
    if (!Number.isInteger(ligaId)) return error('Campeonato inválido.', 400)

    const body = await req.json().catch(() => ({}))
    const categoriaInformada = typeof body?.categoriaCampeonatoId === 'string' && body.categoriaCampeonatoId.trim()
      ? body.categoriaCampeonatoId.trim()
      : null

    const { data: liga, error: ligaErr } = await supabase
      .from('Liga')
      .select('id,organizadorId,faseEliminatoria,disputaTerceiroLugar,classificadosPorGrupo')
      .eq('id', ligaId)
      .maybeSingle()
    if (ligaErr || !liga) return error('Campeonato não encontrado.', 404)
    if (liga.organizadorId !== auth.userId) return error('Você não pode alterar o chaveamento deste campeonato.', 403)
    const bloqueio = await rejectIfCampeonatoFinalizado(ligaId)
    if (bloqueio) return bloqueio

    const { data: config } = categoriaInformada
      ? await supabase
        .from('CategoriaConfiguracao')
        .select('faseEliminatoria,disputaTerceiroLugar,classificadosPorGrupo')
        .eq('ligaId', ligaId)
        .eq('categoriaCampeonatoId', categoriaInformada)
        .maybeSingle()
      : { data: null }
    const faseEliminatoria = config?.faseEliminatoria || liga.faseEliminatoria
    const disputaTerceiro = (config?.disputaTerceiroLugar ?? liga.disputaTerceiroLugar) !== false
    const rounds = getBracketRounds(faseEliminatoria)
    if (rounds.length === 0) return success({ criados: 0, confrontos: [] })

    let gruposQuery = supabase.from('GrupoCampeonato').select('id,ordem,classificados,categoriaCampeonatoId').eq('ligaId', ligaId)
    let vinculosQuery = supabase.from('GrupoEquipeCampeonato').select('grupoId,equipeId,categoriaCampeonatoId').eq('ligaId', ligaId)
    let partidasQuery = supabase
      .from('Partida')
      .select('id,fase,rodada,status,equipeAId,equipeBId,setsPorA,setsPorB,vencedorId,sumulaAprovadaEm,sumulaSubmetidaEm,categoriaCampeonatoId,categoria,serie,sets:SetPartida(numero,pontosA,pontosB)')
      .eq('ligaId', ligaId)
    if (categoriaInformada) {
      gruposQuery = gruposQuery.eq('categoriaCampeonatoId', categoriaInformada)
      vinculosQuery = vinculosQuery.eq('categoriaCampeonatoId', categoriaInformada)
      partidasQuery = partidasQuery.eq('categoriaCampeonatoId', categoriaInformada)
    }

    const [{ data: grupos, error: gruposErr }, { data: vinculos, error: vinculosErr }, { data: partidas, error: partidasErr }, { data: equipes, error: equipesErr }] = await Promise.all([
      gruposQuery,
      vinculosQuery,
      partidasQuery,
      supabase.from('Equipe').select('id,categoria,categoriaCampeonatoId,ligaId').eq('ligaId', ligaId),
    ])
    if (gruposErr || vinculosErr || partidasErr || equipesErr) return error('Erro ao montar a chave.', 500)

    const limitePadrao = Number(config?.classificadosPorGrupo ?? liga.classificadosPorGrupo ?? 0)
    const porGrupo = new Map<number, number[]>()
    for (const vinculo of vinculos ?? []) {
      const grupoId = Number(vinculo.grupoId)
      const lista = porGrupo.get(grupoId) ?? []
      lista.push(Number(vinculo.equipeId))
      porGrupo.set(grupoId, lista)
    }
    const partidasGrupo = (partidas ?? []).filter((partida) => faseContaNaClassificacao(partida.fase)) as PartidaClassificacao[]
    const gruposRanqueados = (grupos ?? []).map((grupo) => {
      const equipeIds = porGrupo.get(Number(grupo.id)) ?? []
      const limiteGrupo = Number(grupo.classificados ?? 0) > 0 ? Number(grupo.classificados) : limitePadrao
      const limite = limiteGrupo > 0 ? limiteGrupo : Math.min(2, equipeIds.length)
      return {
        id: Number(grupo.id),
        ordem: Number(grupo.ordem ?? 0),
        classificados: ranquearGrupo(equipeIds, partidasGrupo, limite),
      }
    }).filter((grupo) => grupo.classificados.length > 0)

    const existentes = (partidas ?? [])
      .filter((partida) => !faseContaNaClassificacao(partida.fase))
      .map((partida) => ({ fase: String(partida.fase), rodada: Number(partida.rodada) }))
    const sugestoes = montarConfrontosAutomaticos({
      grupos: gruposRanqueados,
      faseInicial: rounds[0].fase,
      rounds,
      disputaTerceiro,
      existentes,
      partidas: (partidas ?? [])
        .filter((partida) => !faseContaNaClassificacao(partida.fase))
        .map((partida) => ({
          fase: String(partida.fase),
          rodada: Number(partida.rodada),
          status: partida.status,
          equipeAId: Number(partida.equipeAId),
          equipeBId: Number(partida.equipeBId),
          setsPorA: partida.setsPorA,
          setsPorB: partida.setsPorB,
          vencedorId: partida.vencedorId,
        })),
    })

    const equipePorId = new Map((equipes ?? []).map((equipe) => [Number(equipe.id), equipe]))
    const criados: Array<{ id: number; fase: string; rodada: number }> = []
    for (const jogo of sugestoes) {
      const equipeA = equipePorId.get(jogo.equipeAId)
      const equipeB = equipePorId.get(jogo.equipeBId)
      if (!equipeA || !equipeB) continue
      if (Number(equipeA.ligaId) !== ligaId || Number(equipeB.ligaId) !== ligaId) continue
      const categoriaCampeonatoId = equipeA.categoriaCampeonatoId || equipeB.categoriaCampeonatoId || categoriaInformada
      if (!categoriaCampeonatoId || (equipeA.categoriaCampeonatoId && equipeB.categoriaCampeonatoId && equipeA.categoriaCampeonatoId !== equipeB.categoriaCampeonatoId)) {
        continue
      }
      const { data: partida, error: insertErr } = await supabase
        .from('Partida')
        .insert({
          ligaId,
          equipeAId: jogo.equipeAId,
          equipeBId: jogo.equipeBId,
          categoria: equipeA.categoria || equipeB.categoria || 'GERAL',
          serie: null,
          categoriaCampeonatoId,
          rodada: jogo.rodada,
          status: 'AGENDADA',
          dataHora: null,
          localNome: 'A definir',
          sumulaToken: gerarSumulaToken(),
          grupoId: null,
          fase: jogo.fase,
        })
        .select('id,fase,rodada')
        .single()
      if (insertErr || !partida) {
        console.error('[mata-mata] erro ao gerar confronto automático', insertErr)
        continue
      }
      criados.push({ id: Number(partida.id), fase: String(partida.fase), rodada: Number(partida.rodada) })
    }

    return success({ criados: criados.length, confrontos: criados })
  } catch (err) {
    console.error('[mata-mata] erro ao gerar chave', err)
    return error('Erro ao gerar a chave.', 500)
  }
}
