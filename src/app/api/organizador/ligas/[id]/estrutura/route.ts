// ATENÇÃO: esta é a rota de DISTRIBUIÇÃO REAL de equipes em grupos + geração
// de confrontos (roda depois que as inscrições fecham). Não confundir com
// src/app/api/organizador/ligas/[id]/setup/estrutura/route.ts, que só
// configura REGRAS (formato, quantidade prevista, sets/pontos etc.) da
// Central de Parametrização.
import { NextRequest } from 'next/server'
import { error, success } from '@/lib/api-response'
import { requirePublicRole } from '@/lib/auth'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { rejectIfCampeonatoFinalizado } from '@/lib/championship-finalization'
import { validateEliminatoryCapacity } from '@/lib/championship-validation'
import { jogoImpedeEdicaoDaCategoria, partidaRemovivelAoRecriarGrupos } from '@/lib/configuracao-categoria-edicao'
import { categoriaDaUrl, equipesDaCategoria, escopoDaGeracao } from '@/lib/isolamento-categoria'
import { garantirEquipesLegadasDaLiga } from '@/lib/meu-time/equipe-legada'
import { gerarSumulaToken } from '@/lib/sumula-token'
import { montarConfrontos } from '@/lib/rodadas'
import { mensagemParesForaDoGrupo } from '@/lib/grupos-fase'
import { liberarCampeonatoSemCobranca } from '@/lib/liberar-campeonato'
import { estruturaExigePagamentoConfirmado, pagamentoHabilitado } from '@/lib/pagamento-config'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type RouteContext = {
  params: Promise<{ id: string }>
}

type LigaRecord = {
  id: number
  nome: string
  slug: string
  organizadorId: string
  quantidadeEquipes?: number | null
  quantidadeGrupos?: number | null
  nomesGrupos?: unknown
  classificadosPorGrupo?: number | null
  faseEliminatoria?: string | null
  formato?: string | null
  categoriasConfig?: unknown
  pagamentoConfirmadoEm?: string | null
}

type EquipeRecord = {
  id: number
  nome: string
  categoria?: string | null
  serie?: string | null
  categoriaCampeonatoId?: string | null
  statusEquipe?: string | null
  jogadores?: JogadorRecord[]
  quantidadeJogadores?: number
  elencoAtualizadoEm?: string | null
}

type JogadorRecord = {
  id: number
  nome: string
  numero?: number | null
  posicao?: string | null
  fotoUrl?: string | null
  fotoRostoUrl?: string | null
  qrCodeToken?: string | null
  banido?: boolean
  criadoEm?: string | null
  status?: 'ATIVO' | 'INATIVO'
}

type GrupoInput = {
  nome?: string
  equipeIds?: number[]
}

export async function GET(req: NextRequest, context: RouteContext) {
  const auth = await requirePublicRole(req, ['organizador'], { releasedOnly: true })
  if (auth instanceof Response) return auth

  const { id } = await context.params
  const ligaId = Number(id)
  if (!Number.isInteger(ligaId)) return error('Campeonato inválido.', 400)

  const ligaResult = await getOwnedLiga(ligaId, auth.userId)
  if (ligaResult instanceof Response) return ligaResult
  const liga = ligaResult
  const gate = await resolverPagamentoDaEstrutura(liga)
  if (gate) return gate
  const categorias = await listarCategorias(ligaId)
  if (categorias instanceof Response) return categorias
  const pedido = categoriaDaUrl(req.nextUrl.searchParams)
  if ('erro' in pedido) return error(pedido.erro, 422)
  const categoriaId = pedido.id && categorias.some((item) => item.id === pedido.id)
    ? pedido.id
    : pedido.id
      ? null
      : categorias.length === 1
        ? categorias[0].id
        : null
  if (pedido.id && !categoriaId) return error('Categoria não encontrada neste campeonato.', 404)
  const escolhaCategoria = !categoriaId && categorias.length > 1

  let gruposQuery = supabase
    .from('GrupoCampeonato')
    .select('id,ligaId,nome,ordem,classificados,categoriaCampeonatoId')
    .eq('ligaId', ligaId)
    .order('ordem', { ascending: true })
  let vinculosQuery = supabase
    .from('GrupoEquipeCampeonato')
    .select('id,grupoId,ligaId,equipeId,posicao,categoriaCampeonatoId')
    .eq('ligaId', ligaId)
    .order('posicao', { ascending: true })
  let partidasQuery = supabase
    .from('Partida')
    .select('id,ligaId,equipeAId,equipeBId,rodada,status,dataHora,localNome,grupoId,fase,setsPorA,setsPorB,sumulaToken,categoriaCampeonatoId,escala:EscalaArbitro(id,arbitroId,cargo,arbitro:Arbitro(id,nome,email))')
    .eq('ligaId', ligaId)
    .order('rodada', { ascending: true })
  if (categoriaId) {
    gruposQuery = gruposQuery.eq('categoriaCampeonatoId', categoriaId)
    vinculosQuery = vinculosQuery.eq('categoriaCampeonatoId', categoriaId)
    partidasQuery = partidasQuery.eq('categoriaCampeonatoId', categoriaId)
  }

  const [equipesResult, gruposResult, vinculosResult, partidasResult, regras] = await Promise.all([
    getApprovedTeams(ligaId),
    escolhaCategoria ? Promise.resolve({ data: [], error: null }) : gruposQuery,
    escolhaCategoria ? Promise.resolve({ data: [], error: null }) : vinculosQuery,
    escolhaCategoria ? Promise.resolve({ data: [], error: null }) : partidasQuery,
    categoriaId ? lerRegrasDaCategoria(ligaId, categoriaId) : Promise.resolve(null),
  ])

  if ('error' in equipesResult) return error('Erro ao buscar equipes aprovadas.', 500, equipesResult.error)
  if (gruposResult.error) return error('Erro ao buscar grupos do campeonato. Rode o SQL do bloco 4 no Supabase.', 500, gruposResult.error)
  if (vinculosResult.error) return error('Erro ao buscar distribuição dos grupos.', 500, vinculosResult.error)
  if (partidasResult.error) return error('Erro ao buscar partidas do campeonato.', 500, partidasResult.error)

  const equipes = categoriaId ? equipesDaCategoria(equipesResult.data, categoriaId) : escolhaCategoria ? [] : equipesResult.data

  return success({
    liga,
    categorias,
    categoriaCampeonatoId: categoriaId,
    escolhaCategoria,
    regras,
    equipes,
    grupos: (gruposResult.data ?? []).map((grupo: any) => ({
      ...grupo,
      equipes: (vinculosResult.data ?? [])
        .filter((vinculo: any) => vinculo.grupoId === grupo.id)
        .map((vinculo: any) => ({
          ...vinculo,
          equipe: equipes.find((equipe) => equipe.id === vinculo.equipeId) ?? null,
        })),
    })),
    partidas: partidasResult.data ?? [],
  })
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const auth = await requirePublicRole(req, ['organizador'], { releasedOnly: true })
    if (auth instanceof Response) return auth

    const { id } = await context.params
    const ligaId = Number(id)
    if (!Number.isInteger(ligaId)) return error('Campeonato inválido.', 400)

    const ligaResult = await getOwnedLiga(ligaId, auth.userId)
    if (ligaResult instanceof Response) return ligaResult
    const liga = ligaResult
    const gate = await resolverPagamentoDaEstrutura(liga)
    if (gate) return gate
    const bloqueio = await rejectIfCampeonatoFinalizado(ligaId)
    if (bloqueio) return bloqueio

    const body = await req.json()
    // Inscrições do Meu Time sem Equipe legada (ex.: criadas antes da ponte) ganham a equipe antes de gerar os jogos.
    await garantirEquipesLegadasDaLiga(ligaId, typeof body?.categoriaCampeonatoId === 'string' ? body.categoriaCampeonatoId : null)
    const equipesResult = await getApprovedTeams(ligaId)
    if ('error' in equipesResult) return error('Erro ao buscar equipes aprovadas.', 500, equipesResult.error)
    const escopo = escopoDaGeracao(equipesResult.data, body.categoriaCampeonatoId)
    if (escopo.tipo !== 'categoria') {
      return error(escopo.tipo === 'erro' ? escopo.mensagem : 'Escolha a categoria antes de gerar grupos, calendário ou chave.', 422)
    }
    const categoriaCampeonatoId = escopo.id
    const categorias = await listarCategorias(ligaId)
    if (categorias instanceof Response) return categorias
    if (!categorias.some((item) => item.id === categoriaCampeonatoId)) return error('Categoria não encontrada neste campeonato.', 404)
    const regras = await lerRegrasDaCategoria(ligaId, categoriaCampeonatoId)
    if (!regras) return error('Configure a categoria antes de gerar os grupos.', 422)
    const equipes = equipesDaCategoria(equipesResult.data, categoriaCampeonatoId)
    const quantidadeGrupos = Math.max(1, Number(body.quantidadeGrupos ?? regras.quantidadeGrupos ?? 1))
    const classificadosPorGrupo = Math.max(0, Number(body.classificadosPorGrupo ?? regras.classificadosPorGrupo ?? 0))
    const nomesGrupos = normalizeGroupNames(body.nomesGrupos, quantidadeGrupos)
    const turnoReturno = Boolean(body.turnoReturno)
    const dataInicial = typeof body.dataInicial === 'string' ? body.dataInicial : ''
    const horarioPadrao = typeof body.horarioPadrao === 'string' ? body.horarioPadrao : ''
    const localPadrao = typeof body.localPadrao === 'string' ? body.localPadrao.trim() : ''
    if (equipes.length < 2) return error('A estrutura desta categoria precisa de pelo menos 2 equipes aprovadas.', 400)

    const groups = normalizeGroups(body.grupos, nomesGrupos, equipes)
    if (!groups) return error('A quantidade de grupos não confere com a distribuição enviada.', 422)
    const validation = validateGroups(groups, equipes, classificadosPorGrupo, regras.faseEliminatoria, regras.formato)
    if (validation) return error(validation, 422)

    const { data: partidasExistentes, error: partidasErr } = await supabase
      .from('Partida')
      .select('id,status,fase,grupoId,categoriaCampeonatoId,sumulaSubmetidaEm,sumulaAprovadaEm,setsPorA,setsPorB,vencedorId')
      .eq('ligaId', ligaId)
      .eq('categoriaCampeonatoId', categoriaCampeonatoId)

    if (partidasErr) {
      console.error('[estrutura] erro ao validar partidas', partidasErr)
      return error('Erro ao validar partidas existentes.', 500)
    }

    const lockedMatches = (partidasExistentes ?? []).filter((partida: any) => jogoImpedeEdicaoDaCategoria(partida))
    if (lockedMatches.length > 0) {
      return error('Não é possível recriar os confrontos desta categoria: já existe jogo em andamento, encerrado ou com súmula.', 409)
    }

    const removableIds = (partidasExistentes ?? [])
      .filter((partida: any) => partida.categoriaCampeonatoId === categoriaCampeonatoId && partidaRemovivelAoRecriarGrupos(partida))
      .map((partida: any) => partida.id)
    if (removableIds.length > 0) {
      const { error: escalaErr } = await supabase.from('EscalaArbitro').delete().in('partidaId', removableIds)
      if (escalaErr) console.error('[estrutura] escala do calendário anterior permanece', escalaErr)
      const { error: deletePartidasErr } = await supabase.from('Partida').delete().in('id', removableIds)
      if (deletePartidasErr) {
        console.error('[estrutura] erro ao remover calendário; cancelando jogos não iniciados', deletePartidasErr)
        const { error: cancelErr } = await supabase.from('Partida').update({ status: 'CANCELADA' }).in('id', removableIds)
        if (cancelErr) {
          console.error('[estrutura] erro ao cancelar calendário anterior', cancelErr)
          return error('Erro ao remover calendário anterior.', 500)
        }
      }
    }

    const { data: gruposAtuais } = await supabase.from('GrupoCampeonato').select('id').eq('ligaId', ligaId).eq('categoriaCampeonatoId', categoriaCampeonatoId)
    const grupoIds = (gruposAtuais ?? []).map((grupo: { id: number }) => grupo.id)
    if (grupoIds.length > 0) await supabase.from('GrupoEquipeCampeonato').delete().in('grupoId', grupoIds)
    await supabase.from('GrupoEquipeCampeonato').delete().eq('ligaId', ligaId).eq('categoriaCampeonatoId', categoriaCampeonatoId)
    await supabase.from('GrupoCampeonato').delete().eq('ligaId', ligaId).eq('categoriaCampeonatoId', categoriaCampeonatoId)

    const gruposRows = groups.map((grupo, index) => ({
      ligaId,
      nome: grupo.nome,
      ordem: index + 1,
      classificados: classificadosPorGrupo,
      categoriaCampeonatoId,
    }))
    const { data: createdGroups, error: gruposInsertErr } = await supabase
      .from('GrupoCampeonato')
      .insert(gruposRows)
      .select('id,nome,ordem')

    if (gruposInsertErr || !createdGroups) {
      console.error('[estrutura] erro ao criar grupos', gruposInsertErr)
      return error('Erro ao criar grupos.', 500)
    }

    const createdByName = new Map((createdGroups ?? []).map((grupo: any) => [grupo.nome, grupo]))
    const vinculos = groups.flatMap((grupo) => {
      const created = createdByName.get(grupo.nome)
      return grupo.equipeIds.map((equipeId, index) => ({
        ligaId,
        grupoId: created.id,
        equipeId,
        posicao: index + 1,
        categoriaCampeonatoId,
      }))
    })

    const { error: vinculosErr } = await supabase.from('GrupoEquipeCampeonato').insert(vinculos)
    if (vinculosErr) {
      console.error('[estrutura] erro ao salvar grupos', vinculosErr)
      return error('Erro ao salvar distribuição dos grupos.', 500)
    }

    const partidas = buildGroupMatches(ligaId, groups, createdByName, equipes, turnoReturno, dataInicial, horarioPadrao, localPadrao, categoriaCampeonatoId)
    const foraDoGrupo = mensagemParesForaDoGrupo(groups, partidas)
    if (foraDoGrupo) return error(foraDoGrupo, 422)
    if (partidas.length > 0) {
      const { error: insertPartidasErr } = await supabase.from('Partida').insert(partidas)
      if (insertPartidasErr) {
        console.error('[estrutura] erro ao gerar confrontos', insertPartidasErr)
        return error('Erro ao gerar confrontos.', 500)
      }
    }

    const { error: configErr } = await supabase
      .from('CategoriaConfiguracao')
      .update({ quantidadeGrupos: groups.length })
      .eq('ligaId', ligaId)
      .eq('categoriaCampeonatoId', categoriaCampeonatoId)
    if (configErr) console.error('[estrutura] quantidade de grupos da categoria não foi gravada', configErr)
    if (categorias.length === 1) {
      const { error: ligaErr } = await supabase.from('Liga').update({ quantidadeGrupos: groups.length }).eq('id', ligaId)
      if (ligaErr) console.error('[estrutura] quantidade de grupos do campeonato não foi gravada', ligaErr)
    }

    return success({
      grupos: createdGroups,
      partidasGeradas: partidas.length,
    })
  } catch (err) {
    console.error('[estrutura] erro ao gerar', err)
    return error('Erro ao gerar estrutura do campeonato.', 500)
  }
}

async function resolverPagamentoDaEstrutura(liga: LigaRecord): Promise<Response | null> {
  if (estruturaExigePagamentoConfirmado(liga.pagamentoConfirmadoEm)) {
    return error(
      'A criação de grupos e do calendário só fica disponível depois que o pagamento da ativação deste campeonato é confirmado.',
      402,
      { code: 'PAGAMENTO_PENDENTE' },
    )
  }
  if (!pagamentoHabilitado() && !liga.pagamentoConfirmadoEm) {
    const liberado = await liberarCampeonatoSemCobranca(liga.id)
    if (!liberado.ok) return error('Não foi possível liberar o campeonato.', 500)
    liga.pagamentoConfirmadoEm = liberado.pagamentoConfirmadoEm
  }
  return null
}

async function getOwnedLiga(ligaId: number, organizadorId: string): Promise<LigaRecord | Response> {
  const { data, error: ligaErr } = await supabase
    .from('Liga')
    .select('id,nome,slug,organizadorId,quantidadeEquipes,quantidadeGrupos,nomesGrupos,classificadosPorGrupo,faseEliminatoria,formato,categoriasConfig,pagamentoConfirmadoEm')
    .eq('id', ligaId)
    .single()

  if (ligaErr || !data) {
    if (ligaErr) console.error('[estrutura] campeonato não encontrado', ligaErr)
    return error('Campeonato não encontrado.', 404)
  }
  if (data.organizadorId !== organizadorId) return error('Acesso negado para este campeonato.', 403)
  return data as LigaRecord
}

async function getApprovedTeams(ligaId: number): Promise<{ data: EquipeRecord[] } | { error: unknown }> {
  const { data, error: equipesErr } = await supabase
    .from('InscricaoCampeonato')
    .select(`
      equipe:Equipe(
        id,
        nome,
        categoria,
        serie,
        categoriaCampeonatoId,
        statusEquipe,
        jogadores:Jogador(
          id,
          nome,
          numero,
          posicao,
          fotoUrl,
          fotoRostoUrl,
          qrCodeToken,
          banido,
          criadoEm
        )
      )
    `)
    .eq('ligaId', ligaId)
    .eq('status', 'APROVADA')
    .order('criadaEm', { ascending: true })

  if (equipesErr) return { error: equipesErr }
  const seen = new Set<number>()
  const equipesBase = (data ?? [])
    .map((item: any) => normalizeTeamRoster(Array.isArray(item.equipe) ? item.equipe[0] : item.equipe))
    .filter((equipe): equipe is EquipeRecord => equipe !== null)
    .filter((equipe) => {
      if (seen.has(equipe.id)) return false
      seen.add(equipe.id)
      return true
    })

  return { data: equipesBase }
}

function normalizeTeamRoster(equipe: EquipeRecord | null | undefined): EquipeRecord | null {
  if (!equipe) return null

  const jogadores = (Array.isArray(equipe.jogadores) ? equipe.jogadores : [])
    .map((jogador) => ({
      ...jogador,
      status: jogador.banido ? 'INATIVO' as const : 'ATIVO' as const,
    }))
    .sort((a, b) => {
      const numeroA = Number.isInteger(a.numero) ? Number(a.numero) : Number.MAX_SAFE_INTEGER
      const numeroB = Number.isInteger(b.numero) ? Number(b.numero) : Number.MAX_SAFE_INTEGER
      return numeroA - numeroB || a.nome.localeCompare(b.nome, 'pt-BR')
    })

  return {
    ...equipe,
    jogadores,
    quantidadeJogadores: jogadores.filter((jogador) => jogador.status === 'ATIVO').length,
    elencoAtualizadoEm: jogadores.reduce<string | null>((latest, jogador) => {
      if (!jogador.criadoEm) return latest
      return !latest || jogador.criadoEm > latest ? jogador.criadoEm : latest
    }, null),
  }
}

function normalizeGroupNames(value: unknown, quantidadeGrupos: number) {
  const names = Array.isArray(value) ? value.map((item) => String(item || '').trim()).filter(Boolean) : []
  return Array.from({ length: quantidadeGrupos }, (_, index) => names[index] || `Grupo ${String.fromCharCode(65 + index)}`)
}

function normalizeGroups(value: unknown, nomesGrupos: string[], equipes: EquipeRecord[]): Required<GrupoInput>[] | null {
  if (Array.isArray(value) && value.length > 0) {
    if (value.length !== nomesGrupos.length) return null
    return nomesGrupos.map((nome, index) => {
      const group = value[index] as GrupoInput | undefined
      return {
        nome,
        equipeIds: Array.isArray(group?.equipeIds) ? group.equipeIds.map(Number).filter(Number.isInteger) : [],
      }
    })
  }

  return nomesGrupos.map((nome, index) => ({
    nome,
    equipeIds: equipes.filter((_, equipeIndex) => equipeIndex % nomesGrupos.length === index).map((equipe) => equipe.id),
  }))
}

function validateGroups(groups: Required<GrupoInput>[], equipes: EquipeRecord[], classificadosPorGrupo: number, faseEliminatoria: string | null | undefined, formato: string | null | undefined) {
  const approvedIds = new Set(equipes.map((equipe) => equipe.id))
  const seen = new Map<number, string>()
  const groupNames = new Set<string>()

  for (const group of groups) {
    const normalizedName = group.nome.trim().toLowerCase()
    if (!normalizedName) return 'Todos os grupos precisam ter nome.'
    if (groupNames.has(normalizedName)) return 'Os grupos precisam ter nomes diferentes.'
    groupNames.add(normalizedName)
    if (group.equipeIds.length === 0) return 'Todos os grupos precisam ter pelo menos uma equipe.'
    for (const equipeId of group.equipeIds) {
      if (!approvedIds.has(equipeId)) return 'A distribuição possui equipe que não está aprovada neste campeonato.'
      if (seen.has(equipeId)) return 'A mesma equipe não pode aparecer em mais de um grupo.'
      seen.set(equipeId, group.nome)
    }
  }

  const missing = equipes.filter((equipe) => !seen.has(equipe.id))
  if (missing.length > 0) return 'Todas as equipes aprovadas precisam estar distribuídas em algum grupo.'

  const sizes = groups.map((group) => group.equipeIds.length)
  const min = Math.min(...sizes)
  const max = Math.max(...sizes)
  if (max - min > 1) return 'A quantidade de equipes por grupo precisa ficar equilibrada.'
  if (classificadosPorGrupo > min) return 'A quantidade de classificados por grupo não pode ser maior que o menor grupo.'

  const eliminatoryError = validateEliminatoryCapacity({
    formato,
    faseEliminatoria,
    quantidadeEquipes: equipes.length,
    classificadosPorGrupo,
    groupSizes: sizes,
  })
  if (eliminatoryError) return eliminatoryError

  return ''
}

async function listarCategorias(ligaId: number) {
  const { data, error: categoriasErr } = await supabase
    .from('CategoriaCampeonato')
    .select('id,nome,ordem')
    .eq('ligaId', ligaId)
    .is('removidaEm', null)
    .order('ordem', { ascending: true })
  if (categoriasErr) return error('Não foi possível consultar as categorias.', 503)
  return (data ?? []) as { id: string; nome: string; ordem: number }[]
}

async function lerRegrasDaCategoria(ligaId: number, categoriaId: string) {
  const { data } = await supabase
    .from('CategoriaConfiguracao')
    .select('quantidadeGrupos,classificadosPorGrupo,faseEliminatoria,formato')
    .eq('ligaId', ligaId)
    .eq('categoriaCampeonatoId', categoriaId)
    .maybeSingle()
  return data
}

function buildGroupMatches(
  ligaId: number,
  groups: Required<GrupoInput>[],
  createdByName: Map<string, any>,
  equipes: EquipeRecord[],
  turnoReturno: boolean,
  dataInicial: string,
  horarioPadrao: string,
  localPadrao: string,
  categoriaCampeonatoId: string,
) {
  const equipeById = new Map(equipes.map((equipe) => [equipe.id, equipe]))
  const rows: any[] = []
  let globalIndex = 0

  groups.forEach((grupo, groupIndex) => {
    const grupoRecord = createdByName.get(grupo.nome)
    const times = grupo.equipeIds
      .map((equipeId) => equipeById.get(equipeId))
      .filter((equipe): equipe is EquipeRecord => Boolean(equipe))
    const pairList = montarConfrontos(times, [], turnoReturno)

    pairList.forEach((pair) => {
      globalIndex += 1
      rows.push({
        ligaId,
        equipeAId: pair.a.id,
        equipeBId: pair.b.id,
        categoria: pair.a.categoria || pair.b.categoria || 'GERAL',
        serie: null,
        categoriaCampeonatoId,
        rodada: pair.rodada,
        status: 'AGENDADA',
        dataHora: buildDateTime(globalIndex - 1, dataInicial, horarioPadrao),
        localNome: localPadrao || 'A definir',
        sumulaToken: gerarSumulaToken(),
        grupoId: grupoRecord?.id ?? null,
        fase: 'GRUPOS',
      })
    })
  })

  return rows
}

function buildDateTime(index: number, dataInicial: string, horarioPadrao: string) {
  if (dataInicial) {
    const time = horarioPadrao && /^\d{2}:\d{2}$/.test(horarioPadrao) ? horarioPadrao : '17:00'
    return buildSaoPauloDateTime(addDays(dataInicial, index), time)
  }

  const date = new Date()
  const day = date.getDay()
  const delta = (6 - day + 7) % 7 || 7
  date.setDate(date.getDate() + delta + index)
  const data = date.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  return buildSaoPauloDateTime(data, '17:00')
}

function buildSaoPauloDateTime(data: string, horario: string) {
  const value = new Date(`${data}T${horario}:00-03:00`)
  return Number.isNaN(value.getTime()) ? null : value.toISOString()
}

function addDays(data: string, days: number) {
  const date = new Date(`${data}T12:00:00-03:00`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}
