import { NextRequest } from 'next/server'
import { error, success } from '@/lib/api-response'
import { requirePublicRole } from '@/lib/auth'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { rejectIfCampeonatoFinalizado } from '@/lib/championship-finalization'
import { getBracketRounds, getClassifiedTeamIds, THIRD_PLACE_FASE } from '@/lib/mata-mata'
import { confrontoRepetidoNaCategoria, lerIdCategoria } from '@/lib/isolamento-categoria'
import { alimentadorUsaVencedorExplicito, gruposEncerradosNaCategoria, mensagemRpcOperacao } from '@/lib/operacao-categoria'
import { perdedoresDasSemifinais, vencedoresDosAlimentadores } from '@/lib/resultado-partida'
import { FASES_ELIMINATORIAS } from '@/lib/eliminatorias'
import { gerarSumulaToken } from '@/lib/sumula-token'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const auth = await requirePublicRole(req, ['organizador'], { releasedOnly: true })
    if (auth instanceof Response) return auth

    const { id } = await context.params
    const ligaId = Number(id)
    if (!Number.isInteger(ligaId)) return error('Campeonato inválido.', 400)

    const body = await req.json().catch(() => null)
    const fase = String(body?.fase ?? '').toUpperCase()
    const rodada = Number(body?.rodada)
    const equipeAId = Number(body?.equipeAId)
    const equipeBId = Number(body?.equipeBId)
    const categoriaInformada = lerIdCategoria(body?.categoriaCampeonatoId)
    if ('erro' in categoriaInformada) return error(categoriaInformada.erro, 422)

    const isThirdPlace = fase === THIRD_PLACE_FASE
    if ((!isThirdPlace && (!FASES_ELIMINATORIAS.includes(fase as any) || fase === 'NENHUMA'))) return error('Fase inválida.', 400)
    if (!Number.isInteger(rodada) || rodada < 1 || (isThirdPlace && rodada !== 1)) return error('Jogo inválido.', 400)
    if (!Number.isInteger(equipeAId) || !Number.isInteger(equipeBId) || equipeAId === equipeBId) {
      return error('Selecione dois times diferentes para o confronto.', 400)
    }

    const { data: liga, error: ligaErr } = await supabase
      .from('Liga')
      .select('id,organizadorId,pagamentoConfirmadoEm')
      .eq('id', ligaId)
      .maybeSingle()
    if (ligaErr || !liga) return error('Campeonato não encontrado.', 404)
    if (liga.organizadorId !== auth.userId) return error('Você não pode alterar o chaveamento deste campeonato.', 403)
    if (!liga.pagamentoConfirmadoEm) return error('Confirme o pagamento do campeonato antes de montar a chave.', 403)
    const bloqueio = await rejectIfCampeonatoFinalizado(ligaId)
    if (bloqueio) return bloqueio

    const { data: equipes, error: equipesErr } = await supabase
      .from('Equipe')
      .select('id,categoria,categoriaCampeonatoId,ligaId,statusEquipe')
      .in('id', [equipeAId, equipeBId])
    if (equipesErr) return error('Erro ao carregar os times.', 500, equipesErr.message)
    const equipeA = (equipes ?? []).find((equipe: any) => equipe.id === equipeAId)
    const equipeB = (equipes ?? []).find((equipe: any) => equipe.id === equipeBId)
    if (!equipeA || !equipeB) return error('Um dos times selecionados não foi encontrado.', 404)
    if (Number(equipeA.ligaId) !== ligaId || Number(equipeB.ligaId) !== ligaId) {
      return error('Os times selecionados não pertencem a este campeonato.', 422)
    }
    if (!equipeA.categoriaCampeonatoId || equipeA.categoriaCampeonatoId !== equipeB.categoriaCampeonatoId) {
      return error('Os times do mata-mata precisam estar na mesma categoria.', 422)
    }
    const categoriaCampeonatoId = String(equipeA.categoriaCampeonatoId)
    if (categoriaInformada.id && categoriaInformada.id !== categoriaCampeonatoId) {
      return error('Os times não pertencem à categoria escolhida.', 422)
    }

    const [{ data: categoria }, { data: config }] = await Promise.all([
      supabase.from('CategoriaCampeonato').select('id,revisaoOperacional').eq('id', categoriaCampeonatoId).eq('ligaId', ligaId).is('removidaEm', null).maybeSingle(),
      supabase.from('CategoriaConfiguracao').select('versao,faseEliminatoria,disputaTerceiroLugar,formato').eq('ligaId', ligaId).eq('categoriaCampeonatoId', categoriaCampeonatoId).maybeSingle(),
    ])
    if (!categoria) return error('Categoria não encontrada neste campeonato.', 404)
    if (!config) return error('Configure a categoria antes de montar a chave.', 422)

    const rounds = getBracketRounds(config.faseEliminatoria)
    const roundIndex = isThirdPlace ? -1 : rounds.findIndex((round) => round.fase === fase)
    if (!isThirdPlace) {
      if (roundIndex === -1) return error('Esta fase não faz parte do chaveamento desta categoria.', 422)
      if (rodada > rounds[roundIndex].slots) return error('Este jogo não existe nessa fase.', 422)
    } else if (config.disputaTerceiroLugar === false) {
      return error('Esta categoria não tem disputa de 3º lugar.', 422)
    } else if (!rounds.some((round) => round.fase === 'SEMIFINAL')) {
      return error('Esta categoria não tem disputa de 3º lugar (a chave não passa por uma semifinal).', 422)
    }

    const { data: existentes, error: existingErr } = await supabase
      .from('Partida')
      .select('id,fase,rodada,categoriaCampeonatoId')
      .eq('ligaId', ligaId)
      .eq('categoriaCampeonatoId', categoriaCampeonatoId)
      .eq('fase', fase)
      .eq('rodada', rodada)
    if (existingErr) return error('Erro ao verificar o confronto.', 500, existingErr.message)
    if (confrontoRepetidoNaCategoria(existentes ?? [], categoriaCampeonatoId, fase, rodada)) return error('Este confronto já foi criado nesta categoria.', 409)

    let alimentadores: Array<{ equipeAId: number; equipeBId: number; setsPorA: number | null; setsPorB: number | null; vencedorId?: number | null }> = []
    if (!isThirdPlace && roundIndex === 0) {
      const { data: jogosGrupo, error: jogosErr } = await supabase
        .from('Partida')
        .select('fase,status,sumulaSubmetidaEm,sumulaAprovadaEm,vencedorId,categoriaCampeonatoId')
        .eq('ligaId', ligaId)
        .eq('categoriaCampeonatoId', categoriaCampeonatoId)
      if (jogosErr) return error('Erro ao verificar a fase de grupos.', 500, jogosErr.message)
      if (!gruposEncerradosNaCategoria(jogosGrupo ?? [], categoriaCampeonatoId, config.formato)) {
        return error('A fase de grupos desta categoria ainda não terminou.', 422)
      }
      const classifiedIds = await getClassifiedTeamIds(ligaId, categoriaCampeonatoId)
      const { data: existingMatches, error: matchesErr } = await supabase
        .from('Partida')
        .select('equipeAId,equipeBId')
        .eq('ligaId', ligaId)
        .eq('categoriaCampeonatoId', categoriaCampeonatoId)
        .eq('fase', fase)
      if (matchesErr) return error('Erro ao verificar confrontos já criados.', 500, matchesErr.message)
      const usedIds = new Set<number>()
      ;(existingMatches ?? []).forEach((row: any) => {
        usedIds.add(Number(row.equipeAId))
        usedIds.add(Number(row.equipeBId))
      })
      for (const equipeId of [equipeAId, equipeBId]) {
        if (!classifiedIds.has(equipeId)) return error('Um dos times selecionados não está classificado para o mata-mata.', 422)
        if (usedIds.has(equipeId)) return error('Um dos times selecionados já está em outro confronto desta fase.', 409)
      }
    } else {
      const faseAnterior = isThirdPlace ? 'SEMIFINAL' : rounds[roundIndex - 1].fase
      const rodadas = isThirdPlace ? [1, 2] : [rodada * 2 - 1, rodada * 2]
      const { data: feeders, error: feedersErr } = await supabase
        .from('Partida')
        .select('rodada,status,equipeAId,equipeBId,setsPorA,setsPorB,vencedorId')
        .eq('ligaId', ligaId)
        .eq('categoriaCampeonatoId', categoriaCampeonatoId)
        .eq('fase', faseAnterior)
        .in('rodada', rodadas)
      if (feedersErr) return error(isThirdPlace ? 'Erro ao verificar a semifinal.' : 'Erro ao verificar a rodada anterior.', 500, feedersErr.message)
      alimentadores = feeders ?? []
      const classificadosDoSlot = isThirdPlace ? perdedoresDasSemifinais(alimentadores as any) : vencedoresDosAlimentadores(alimentadores as any, rodada)
      if (!classificadosDoSlot) {
        return error(isThirdPlace ? 'Ainda falta o resultado de uma semifinal.' : 'Ainda falta o resultado de um confronto anterior desta chave.', 422)
      }
      const esperados = new Set(classificadosDoSlot)
      if (!esperados.has(equipeAId) || !esperados.has(equipeBId)) {
        return error(isThirdPlace
          ? 'Os times selecionados precisam ser os perdedores das duas semifinais.'
          : 'Os times selecionados precisam ser os vencedores dos dois confrontos anteriores desta chave.', 422)
      }
    }

    const gravado = await supabase.rpc('criar_confronto_categoria', {
      p_liga_id: ligaId,
      p_categoria_id: categoriaCampeonatoId,
      p_organizador_id: auth.userId,
      p_config_versao: Number(config.versao ?? 1),
      p_operacao_versao: Number(categoria.revisaoOperacional ?? 0),
      p_fase: fase,
      p_rodada: rodada,
      p_equipe_a: equipeAId,
      p_equipe_b: equipeBId,
    })
    if (!gravado.error) return success(gravado.data, 201)

    const mapeado = mensagemRpcOperacao(gravado.error)
    const woAntigo = mapeado.motivo === 'inelegivel' && alimentadorUsaVencedorExplicito(alimentadores)
    if (mapeado.motivo === 'ausente' || woAntigo) return inserirConfronto(ligaId, categoriaCampeonatoId, equipeAId, equipeBId, equipeA, equipeB, rodada, fase)
    if (mapeado.status === 500) console.error('[mata-mata] rpc', gravado.error)
    return error(mapeado.mensagem, mapeado.status)
  } catch (err) {
    console.error('[mata-mata] erro ao criar confronto', err)
    return error('Erro ao criar o confronto.', 500)
  }
}

async function inserirConfronto(
  ligaId: number,
  categoriaCampeonatoId: string,
  equipeAId: number,
  equipeBId: number,
  equipeA: { categoria?: string | null },
  equipeB: { categoria?: string | null },
  rodada: number,
  fase: string,
) {
  const { data: partida, error: insertErr } = await supabase
    .from('Partida')
    .insert({
      ligaId,
      equipeAId,
      equipeBId,
      categoria: equipeA.categoria || equipeB.categoria || 'GERAL',
      serie: null,
      categoriaCampeonatoId,
      rodada,
      status: 'AGENDADA',
      dataHora: null,
      localNome: 'A definir',
      sumulaToken: gerarSumulaToken(),
      grupoId: null,
      fase,
      atualizadoEm: new Date().toISOString(),
    })
    .select('id,rodada,fase,sumulaToken')
    .single()
  if (insertErr) {
    if (insertErr.code === '23505') return error('Este confronto já foi criado nesta categoria.', 409)
    console.error('[mata-mata] erro ao criar confronto', insertErr)
    return error('Erro ao criar o confronto.', 500)
  }
  return success(partida, 201)
}
