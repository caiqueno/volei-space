import { getChampionshipPodium, type PodiumTeam } from '@/lib/championship-podium'
import { getCreatorLeagueScope } from '@/lib/league-scope'
import { buscarPartidasPublicas } from '@/lib/agenda-publica'
import { agruparPartidasPublicas, type GruposPartidaPublica, type PartidaPublica } from '@/lib/partida-publica'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ensureEquipeForCandidatura } from '@/lib/team-activation'
import { reconcileAcceptedInvitations } from '@/lib/championship-registration-sync'

const demoEquipes = [
  { id: 1, nome: 'Kimura Vôlei', corHex: '#0F2C52', logoUrl: null, jogadores: Array.from({ length: 12 }, (_, id) => ({ id })) },
  { id: 2, nome: 'Ultra Volleyball', corHex: '#EF9F27', logoUrl: null, jogadores: Array.from({ length: 10 }, (_, id) => ({ id })) },
  { id: 3, nome: 'Atlética Norte', corHex: '#185FA5', logoUrl: null, jogadores: Array.from({ length: 11 }, (_, id) => ({ id })) },
  { id: 4, nome: 'Arena Sul', corHex: '#1D9E75', logoUrl: null, jogadores: Array.from({ length: 9 }, (_, id) => ({ id })) },
]

const demoPartidas = [
  { id: 1, rodada: 1, status: 'AGENDADA', dataHora: new Date(Date.now() + 86400000).toISOString(), localNome: 'Arena volei.space', equipeA: demoEquipes[0], equipeB: demoEquipes[1], setsPorA: null, setsPorB: null, sets: [] },
  { id: 2, rodada: 1, status: 'ENCERRADA', dataHora: new Date(Date.now() - 86400000).toISOString(), localNome: 'Ginásio Central', equipeA: demoEquipes[2], equipeB: demoEquipes[3], setsPorA: 2, setsPorB: 1, sets: [{ numero: 1, pontosA: 25, pontosB: 21 }, { numero: 2, pontosA: 22, pontosB: 25 }, { numero: 3, pontosA: 15, pontosB: 12 }] },
]

export async function getPortalHome(params: { organizador?: string; ligaId?: string; candidaturaId?: string }) {
  let scope = isSupabaseConfigured ? await getCreatorLeagueScope(params) : { organizadorId: null, ligas: [], selectedLiga: null }

  if (!isSupabaseConfigured) {
    return {
      scope,
      liga: {
        nome: 'volei.space',
        subtitulo: 'Temporada oficial',
        descricao: 'A liga amadora de vôlei com calendário, resultados, classificação, atletas e súmula digital em um só lugar.',
      },
      equipes: demoEquipes,
      partidas: demoPartidas,
      grupos: agruparPartidasPublicas(demoPartidas as any),
      partidasFalha: false,
      agendaGlobal: false,
      partidaDestaque: demoPartidas[0] ?? null,
      emAndamento: false,
      podium: [] as PodiumTeam[],
      mensagens: [],
      premiacoes: [
        { id: 1, colocacao: 1, descricao: 'Troféu campeão + medalhas' },
        { id: 2, colocacao: 2, descricao: 'Medalhas de vice-campeão' },
        { id: 3, colocacao: 3, descricao: 'Destaque da temporada' },
      ],
    }
  }

  if (isSupabaseConfigured && params.candidaturaId) {
    const equipe = await ensureEquipeForCandidatura(params.candidaturaId)
    if (!equipe) return vazioPortal({ organizadorId: null, ligas: [], selectedLiga: null })

    const { data: inscricoes } = await supabaseAdmin
      .from('InscricaoCampeonato')
      .select('*, liga:Liga(*)')
      .eq('equipeId', equipe.id)
      .in('status', ['SOLICITADA', 'APROVADA'])
      .order('criadaEm', { ascending: false })

    const ligasInscritas = (inscricoes ?? [])
      .map((item: any) => Array.isArray(item.liga) ? item.liga[0] : item.liga)
      .filter(Boolean)

    if (ligasInscritas.length === 0 && equipe.ligaId) {
      const { data: ligaAtual } = await supabaseAdmin.from('Liga').select('*').eq('id', equipe.ligaId).maybeSingle()
      if (ligaAtual) ligasInscritas.push(ligaAtual)
    }

    const requestedId = Number(params.ligaId)
    const selectedLiga = ligasInscritas.find((liga: any) => liga.id === requestedId) ?? ligasInscritas[0] ?? null
    scope = { organizadorId: null, ligas: ligasInscritas, selectedLiga }
  }

  if (scope.organizadorId && !scope.selectedLiga) {
    return vazioPortal(scope)
  }

  const agendaGlobal = !scope.selectedLiga
  const ligasResultado = agendaGlobal
    ? await supabaseAdmin.from('Liga').select('*').eq('simulacao', false).order('criadoEm', { ascending: false })
    : { data: scope.selectedLiga ? [scope.selectedLiga] : [], error: null }
  if (ligasResultado.error) {
    console.error('[portal] erro ao buscar campeonatos', ligasResultado.error)
    return { ...vazioPortal(scope), partidasFalha: true, agendaGlobal }
  }
  const ligasPublicas = ligasResultado.data

  const idsPublicos = (ligasPublicas ?? []).map((item: { id: number }) => item.id)
  const partidasBusca = await buscarPartidasPublicas(idsPublicos, !agendaGlobal)
  const partidasFalha = partidasBusca.erro
  if (partidasFalha) console.error('[portal] erro ao buscar partidas')
  const partidasNormais = partidasBusca.partidas
  const grupos = agruparPartidasPublicas(partidasNormais)
  const partidas = [...grupos.aoVivo, ...grupos.proximos, ...grupos.encerradas, ...grupos.analise]
  const partidaDestaque = grupos.aoVivo[0] ?? grupos.proximos[0] ?? grupos.encerradas[0] ?? null
  const emAndamento = grupos.aoVivo.length > 0
  let liga = scope.selectedLiga ?? ligasPublicas?.[0] ?? null
  if (agendaGlobal && partidas.length > 0) {
    const ligaDestaque = (ligasPublicas ?? []).find((item: { id: number }) => item.id === partidaDestaque?.ligaId)
    if (ligaDestaque) liga = ligaDestaque
  }
  const ligaId = liga?.id
  if (ligaId) {
    try {
      await reconcileAcceptedInvitations([ligaId])
    } catch (err) {
      console.error('[portal] erro ao reconciliar equipes do campeonato', err)
    }
  }

  const equipesQuery = ligaId
    ? supabaseAdmin
      .from('InscricaoCampeonato')
      .select('equipe:Equipe(*, jogadores:Jogador(id,banido))')
      .eq('ligaId', ligaId)
      .eq('status', 'APROVADA')
      .order('criadaEm', { ascending: true })
    : Promise.resolve({ data: [] })

  const mensagensQuery = ligaId
    ? supabase.from('Mensagem').select('*').eq('ligaId', ligaId).eq('aprovada', true).order('criadoEm', { ascending: false }).limit(5)
    : supabase.from('Mensagem').select('*').eq('aprovada', true).order('criadoEm', { ascending: false }).limit(5)

  const premiacoesQuery = ligaId
    ? supabase.from('Premiacao').select('*').eq('ligaId', ligaId).order('colocacao', { ascending: true })
    : Promise.resolve({ data: [] })

  const podiumQuery = ligaId ? getChampionshipPodium(ligaId) : Promise.resolve([] as PodiumTeam[])

  const [{ data: inscricoesAprovadas }, { data: mensagens }, { data: premiacoes }, podium] = await Promise.all([
    equipesQuery,
    mensagensQuery,
    premiacoesQuery,
    podiumQuery,
  ])

  const equipesBase = (inscricoesAprovadas ?? [])
    .map((item: any) => Array.isArray(item.equipe) ? item.equipe[0] : item.equipe)
    .filter(Boolean)
    .map(normalizePortalTeam)
    .sort((a: any, b: any) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'))

  return { scope, liga, equipes: equipesBase, partidas, grupos, partidasFalha, agendaGlobal, partidaDestaque, emAndamento, podium, mensagens: mensagens ?? [], premiacoes: premiacoes ?? [] }
}

export async function getPainelInicio(organizadorId: string) {
  const scope = isSupabaseConfigured
    ? await getCreatorLeagueScope({ organizador: organizadorId })
    : { organizadorId, ligas: [] as any[], selectedLiga: null }
  if (!scope.ligas.length) return []

  const ids = scope.ligas.map((liga: { id: number }) => liga.id)
  try {
    await reconcileAcceptedInvitations(ids)
  } catch (err) {
    console.error('[portal] erro ao reconciliar equipes do campeonato', err)
  }

  const [partidasBusca, inscricoesResultado, mensagensResultado, premiacoesResultado, podios] = await Promise.all([
    buscarPartidasPublicas(ids, false),
    supabaseAdmin
      .from('InscricaoCampeonato')
      .select('ligaId, equipe:Equipe(id,nome,corHex,logoUrl,jogadores:Jogador(id,banido))')
      .in('ligaId', ids)
      .eq('status', 'APROVADA'),
    supabase.from('Mensagem').select('*').in('ligaId', ids).eq('aprovada', true).order('criadoEm', { ascending: false }),
    supabase.from('Premiacao').select('*').in('ligaId', ids).order('colocacao', { ascending: true }),
    Promise.all(ids.map((id: number) => getChampionshipPodium(id).catch(() => [] as PodiumTeam[]))),
  ])

  const partidasFalha = partidasBusca.erro
  if (partidasFalha) console.error('[portal] erro ao buscar partidas')
  const partidasPorLiga = new Map<number, PartidaPublica[]>()
  if (!partidasFalha) {
    for (const partida of partidasBusca.partidas) {
      const lista = partidasPorLiga.get(partida.ligaId) ?? []
      lista.push(partida)
      partidasPorLiga.set(partida.ligaId, lista)
    }
  }

  const equipesPorLiga = new Map<number, any[]>()
  for (const inscricao of inscricoesResultado.data ?? []) {
    const equipe = Array.isArray(inscricao.equipe) ? inscricao.equipe[0] : inscricao.equipe
    if (!equipe) continue
    const lista = equipesPorLiga.get(inscricao.ligaId) ?? []
    lista.push(normalizePortalTeam(equipe))
    equipesPorLiga.set(inscricao.ligaId, lista)
  }

  return scope.ligas.map((liga: any, indice: number) => {
    const partidasDaLiga = partidasPorLiga.get(liga.id) ?? []
    const grupos = agruparPartidasPublicas(partidasDaLiga)
    const partidas = [...grupos.aoVivo, ...grupos.proximos, ...grupos.encerradas, ...grupos.analise]
    const equipes = (equipesPorLiga.get(liga.id) ?? []).sort((a: any, b: any) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'))
    return {
      scope: { organizadorId: scope.organizadorId, ligas: scope.ligas, selectedLiga: liga },
      liga,
      equipes,
      partidas,
      grupos,
      partidasFalha,
      agendaGlobal: false,
      partidaDestaque: grupos.aoVivo[0] ?? grupos.proximos[0] ?? grupos.encerradas[0] ?? null,
      emAndamento: grupos.aoVivo.length > 0,
      podium: podios[indice] ?? [],
      mensagens: (mensagensResultado.data ?? []).filter((mensagem: { ligaId?: number }) => mensagem.ligaId === liga.id).slice(0, 5),
      premiacoes: (premiacoesResultado.data ?? []).filter((premio: { ligaId?: number }) => premio.ligaId === liga.id),
    }
  })
}

function vazioPortal(scope: { organizadorId: string | null; ligas: any[]; selectedLiga: any | null }) {
  const grupos: GruposPartidaPublica = { aoVivo: [], proximos: [], encerradas: [], analise: [], outras: [] }
  return { scope, liga: null, equipes: [], partidas: [], grupos, partidasFalha: false, agendaGlobal: false, partidaDestaque: null, emAndamento: false, podium: [] as PodiumTeam[], mensagens: [], premiacoes: [] }
}

function normalizePortalTeam(equipe: any) {
  const jogadores = Array.isArray(equipe?.jogadores) ? equipe.jogadores : []
  const atletasAtivos = jogadores.filter((jogador: any) => !jogador.banido)
  return {
    ...equipe,
    jogadores: atletasAtivos,
    quantidadeJogadores: atletasAtivos.length,
  }
}


