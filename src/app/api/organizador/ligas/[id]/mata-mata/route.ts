import { NextRequest } from 'next/server'
import { error, success } from '@/lib/api-response'
import { requirePublicRole } from '@/lib/auth'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { rejectIfCampeonatoFinalizado } from '@/lib/championship-finalization'
import { getBracketRounds, getClassifiedTeamIds, THIRD_PLACE_FASE } from '@/lib/mata-mata'
import { confrontoRepetidoNaCategoria } from '@/lib/isolamento-categoria'
import { perdedoresDasSemifinais, vencedoresDosAlimentadores } from '@/lib/resultado-partida'
import { FASES_ELIMINATORIAS } from '@/lib/eliminatorias'
import { gerarSumulaToken } from '@/lib/sumula-token'
import { classificarPorGrupos, type PartidaClassificacao } from '@/lib/classificacao'
import { cruzarSemifinais } from '@/lib/grupos-fase'

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
    if (body?.acao === 'cruzar-grupos') {
      return cruzarGrupos(ligaId, auth.userId, typeof body.categoriaCampeonatoId === 'string' ? body.categoriaCampeonatoId : null)
    }
    const fase = String(body?.fase ?? '').toUpperCase()
    const rodada = Number(body?.rodada)
    const equipeAId = Number(body?.equipeAId)
    const equipeBId = Number(body?.equipeBId)

    const isThirdPlace = fase === THIRD_PLACE_FASE
    if ((!isThirdPlace && (!FASES_ELIMINATORIAS.includes(fase as any) || fase === 'NENHUMA'))) return error('Fase inválida.', 400)
    if (!Number.isInteger(rodada) || rodada < 1 || (isThirdPlace && rodada !== 1)) return error('Jogo inválido.', 400)
    if (!Number.isInteger(equipeAId) || !Number.isInteger(equipeBId) || equipeAId === equipeBId) {
      return error('Selecione dois times diferentes para o confronto.', 400)
    }

    const { data: liga, error: ligaErr } = await supabase
      .from('Liga')
      .select('id,organizadorId,faseEliminatoria,disputaTerceiroLugar')
      .eq('id', ligaId)
      .maybeSingle()
    if (ligaErr || !liga) return error('Campeonato não encontrado.', 404)
    if (liga.organizadorId !== auth.userId) return error('Você não pode alterar o chaveamento deste campeonato.', 403)
    const bloqueio = await rejectIfCampeonatoFinalizado(ligaId)
    if (bloqueio) return bloqueio

    const { data: equipes, error: equipesErr } = await supabase
      .from('Equipe')
      .select('id,categoria,serie,categoriaCampeonatoId,ligaId')
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
    const { data: config } = await supabase
      .from('CategoriaConfiguracao')
      .select('faseEliminatoria,disputaTerceiroLugar')
      .eq('ligaId', ligaId)
      .eq('categoriaCampeonatoId', categoriaCampeonatoId)
      .maybeSingle()
    const faseEliminatoria = config?.faseEliminatoria || liga.faseEliminatoria
    const disputaTerceiroLugar = config?.disputaTerceiroLugar ?? liga.disputaTerceiroLugar

    const rounds = getBracketRounds(faseEliminatoria)
    const roundIndex = isThirdPlace ? -1 : rounds.findIndex((round) => round.fase === fase)
    if (!isThirdPlace) {
      if (roundIndex === -1) return error('Esta fase não faz parte do chaveamento deste campeonato.', 422)
      if (rodada > rounds[roundIndex].slots) return error('Este jogo não existe nessa fase.', 422)
    } else if (disputaTerceiroLugar === false) {
      return error('Este campeonato não tem disputa de 3º lugar.', 422)
    } else if (!rounds.some((round) => round.fase === 'SEMIFINAL')) {
      return error('Este campeonato não tem disputa de 3º lugar (a chave não passa por uma semifinal).', 422)
    }

    const { data: existentes, error: existingErr } = await supabase
      .from('Partida')
      .select('id,fase,rodada,categoriaCampeonatoId')
      .eq('ligaId', ligaId)
      .eq('categoriaCampeonatoId', categoriaCampeonatoId)
      .eq('fase', fase)
      .eq('rodada', rodada)
    if (existingErr) return error('Erro ao verificar o confronto.', 500, existingErr.message)
    if (confrontoRepetidoNaCategoria(existentes ?? [], categoriaCampeonatoId, fase, rodada)) return error('Este confronto já foi criado.', 409)

    if (isThirdPlace) {
      const { data: feeders, error: feedersErr } = await supabase
        .from('Partida')
        .select('rodada,status,equipeAId,equipeBId,setsPorA,setsPorB,vencedorId')
        .eq('ligaId', ligaId)
        .eq('categoriaCampeonatoId', categoriaCampeonatoId)
        .eq('fase', 'SEMIFINAL')
        .in('rodada', [1, 2])
      if (feedersErr) return error('Erro ao verificar a semifinal.', 500, feedersErr.message)
      const perdedores = perdedoresDasSemifinais(feeders ?? [])
      if (!perdedores) return error('Ainda falta o resultado de uma semifinal.', 422)
      const losers = new Set(perdedores)

      if (!losers.has(equipeAId) || !losers.has(equipeBId)) {
        return error('Os times selecionados precisam ser os perdedores das duas semifinais.', 422)
      }
    } else if (roundIndex === 0) {
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
      const previousRound = rounds[roundIndex - 1]
      const feederRodadas = [rodada * 2 - 1, rodada * 2]
      const { data: feeders, error: feedersErr } = await supabase
        .from('Partida')
        .select('rodada,status,equipeAId,equipeBId,setsPorA,setsPorB,vencedorId')
        .eq('ligaId', ligaId)
        .eq('categoriaCampeonatoId', categoriaCampeonatoId)
        .eq('fase', previousRound.fase)
        .in('rodada', feederRodadas)
      if (feedersErr) return error('Erro ao verificar a rodada anterior.', 500, feedersErr.message)
      const classificadosDoSlot = vencedoresDosAlimentadores(feeders ?? [], rodada)
      if (!classificadosDoSlot) return error('Ainda falta o resultado de um confronto anterior desta chave.', 422)
      const winners = new Set(classificadosDoSlot)

      if (!winners.has(equipeAId) || !winners.has(equipeBId)) {
        return error('Os times selecionados precisam ser os vencedores dos dois confrontos anteriores desta chave.', 422)
      }
    }

    const { data: partida, error: insertErr } = await supabase
      .from('Partida')
      .insert({
        ligaId,
        equipeAId,
        equipeBId,
        categoria: equipeA.categoria || equipeB.categoria || 'GERAL',
        serie: null,
        categoriaCampeonatoId: equipeA.categoriaCampeonatoId,
        rodada,
        status: 'AGENDADA',
        dataHora: null,
        localNome: 'A definir',
        sumulaToken: gerarSumulaToken(),
        grupoId: null,
        fase,
      })
      .select('id,rodada,fase,sumulaToken')
      .single()
    if (insertErr) {
      console.error('[mata-mata] erro ao criar confronto', insertErr)
      return error('Erro ao criar o confronto.', 500)
    }

    return success(partida, 201)
  } catch (err) {
    console.error('[mata-mata] erro ao criar confronto', err)
    return error('Erro ao criar o confronto.', 500)
  }
}

async function cruzarGrupos(ligaId: number, organizadorId: string, categoriaCampeonatoId: string | null) {
  const { data: liga, error: ligaErr } = await supabase
    .from('Liga')
    .select('id,organizadorId')
    .eq('id', ligaId)
    .maybeSingle()
  if (ligaErr || !liga) return error('Campeonato não encontrado.', 404)
  if (liga.organizadorId !== organizadorId) return error('Você não pode alterar o chaveamento deste campeonato.', 403)
  const bloqueio = await rejectIfCampeonatoFinalizado(ligaId)
  if (bloqueio) return bloqueio
  if (!categoriaCampeonatoId) return error('Escolha a categoria antes de cruzar as semifinais.', 422)

  const [gruposResposta, vinculosResposta, tabelaResposta, partidasResposta, existentesResposta] = await Promise.all([
    supabase.from('GrupoCampeonato').select('id,nome,ordem,classificados').eq('ligaId', ligaId).eq('categoriaCampeonatoId', categoriaCampeonatoId).order('ordem', { ascending: true }),
    supabase.from('GrupoEquipeCampeonato').select('grupoId,equipeId').eq('ligaId', ligaId).eq('categoriaCampeonatoId', categoriaCampeonatoId),
    supabase.from('ClassificacaoEntrada').select('equipeId,pontos,jogos,vitorias,derrotas,setsPro,setsContra,pontosPro,pontosContra,categoria').eq('ligaId', ligaId).eq('categoriaCampeonatoId', categoriaCampeonatoId),
    supabase.from('Partida').select('equipeAId,equipeBId,setsPorA,setsPorB,pontosPorA,pontosPorB,status,vencedorId,fase,sumulaAprovadaEm,sumulaSubmetidaEm').eq('ligaId', ligaId).eq('categoriaCampeonatoId', categoriaCampeonatoId),
    supabase.from('Partida').select('id').eq('ligaId', ligaId).eq('categoriaCampeonatoId', categoriaCampeonatoId).eq('fase', 'SEMIFINAL'),
  ])
  if (gruposResposta.error || vinculosResposta.error || tabelaResposta.error || partidasResposta.error || existentesResposta.error) {
    return error('Não foi possível ler os grupos para o cruzamento.', 500)
  }
  if ((existentesResposta.data ?? []).length > 0) return error('As semifinais desta categoria já foram criadas.', 409)

  const grupos = gruposResposta.data ?? []
  if (grupos.length !== 2) return error('O cruzamento 1º A x 2º B vale para exatamente dois grupos.', 422)
  const porGrupo = new Map<number, number[]>()
  for (const vinculo of vinculosResposta.data ?? []) {
    const lista = porGrupo.get(Number(vinculo.grupoId)) ?? []
    lista.push(Number(vinculo.equipeId))
    porGrupo.set(Number(vinculo.grupoId), lista)
  }
  const porEquipe = new Map((tabelaResposta.data ?? []).map((linha) => [Number(linha.equipeId), linha]))
  const equipeIds = Array.from(new Set((vinculosResposta.data ?? []).map((vinculo) => Number(vinculo.equipeId))))
  const linhas = equipeIds.map((equipeId) => {
    const linha = porEquipe.get(equipeId)
    return {
      equipeId,
      categoriaCampeonatoId,
      categoria: linha?.categoria || '',
      pontos: Number(linha?.pontos ?? 0),
      jogos: Number(linha?.jogos ?? 0),
      vitorias: Number(linha?.vitorias ?? 0),
      derrotas: Number(linha?.derrotas ?? 0),
      setsPro: Number(linha?.setsPro ?? 0),
      setsContra: Number(linha?.setsContra ?? 0),
      pontosPro: Number(linha?.pontosPro ?? 0),
      pontosContra: Number(linha?.pontosContra ?? 0),
    }
  })
  const tabelas = classificarPorGrupos({
    linhas,
    partidas: (partidasResposta.data ?? []) as PartidaClassificacao[],
    grupos: grupos.map((grupo) => ({
      id: grupo.id,
      nome: grupo.nome,
      equipeIds: porGrupo.get(Number(grupo.id)) ?? [],
    })),
  })
  const cruzamento = cruzarSemifinais(tabelas.map((grupo) => ({
    nome: grupo.nome,
    classificados: grupo.linhas.slice(0, 2).map((linha) => linha.equipeId),
  })))
  if (!cruzamento) return error('Cada grupo precisa ter pelo menos dois classificados para a semifinal.', 422)

  const { data: equipes, error: equipesErr } = await supabase
    .from('Equipe')
    .select('id,categoria,categoriaCampeonatoId')
    .in('id', cruzamento.flatMap((jogo) => [jogo.equipeAId, jogo.equipeBId]))
  if (equipesErr) return error('Erro ao carregar os times.', 500)
  const equipePorId = new Map((equipes ?? []).map((equipe) => [Number(equipe.id), equipe]))

  const rows = cruzamento.map((jogo) => {
    const equipeA = equipePorId.get(jogo.equipeAId)
    const equipeB = equipePorId.get(jogo.equipeBId)
    return {
      ligaId,
      equipeAId: jogo.equipeAId,
      equipeBId: jogo.equipeBId,
      categoria: equipeA?.categoria || equipeB?.categoria || 'GERAL',
      serie: null,
      categoriaCampeonatoId,
      rodada: jogo.rodada,
      status: 'AGENDADA',
      dataHora: null,
      localNome: 'A definir',
      sumulaToken: gerarSumulaToken(),
      grupoId: null,
      fase: jogo.fase,
    }
  })
  const { data: criadas, error: insertErr } = await supabase.from('Partida').insert(rows).select('id,rodada,fase')
  if (insertErr) {
    console.error('[mata-mata] erro ao cruzar semifinais', insertErr)
    return error('Erro ao criar as semifinais.', 500)
  }
  return success({ partidas: criadas }, 201)
}
