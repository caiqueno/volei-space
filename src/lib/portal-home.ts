import { getChampionshipPodium, type PodiumTeam } from '@/lib/championship-podium'
import { getCreatorLeagueScope } from '@/lib/league-scope'
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
    if (!equipe) return { scope: { organizadorId: null, ligas: [], selectedLiga: null }, liga: null, equipes: [], partidas: [], partidaDestaque: null, emAndamento: false, podium: [] as PodiumTeam[], mensagens: [], premiacoes: [] }

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
    return { scope, liga: null, equipes: [], partidas: [], partidaDestaque: null, emAndamento: false, podium: [] as PodiumTeam[], mensagens: [], premiacoes: [] }
  }

  const ligaQuery = scope.selectedLiga
    ? Promise.resolve({ data: scope.selectedLiga })
    : supabase.from('Liga').select('*').in('status', ['ATIVA', 'EM_BREVE']).order('criadoEm', { ascending: false }).limit(1).maybeSingle()

  const { data: liga } = await ligaQuery
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

  const partidaColunas = 'id,rodada,status,dataHora,localNome,setsPorA,setsPorB,equipeA:Equipe!equipeAId(id,nome,corHex),equipeB:Equipe!equipeBId(id,nome,corHex),sets:SetPartida(numero,pontosA,pontosB)'

  const partidasQuery = ligaId
    ? supabase
      .from('Partida')
      .select(partidaColunas)
      .eq('ligaId', ligaId)
      .order('dataHora', { ascending: true })
      .limit(4)
    : Promise.resolve({ data: [] })

  const partidaAoVivoQuery = ligaId
    ? supabase.from('Partida').select(partidaColunas).eq('ligaId', ligaId).eq('status', 'EM_ANDAMENTO').order('dataHora', { ascending: true }).limit(1).maybeSingle()
    : Promise.resolve({ data: null })

  const proximaAgendadaQuery = ligaId
    ? supabase.from('Partida').select(partidaColunas).eq('ligaId', ligaId).eq('status', 'AGENDADA').order('dataHora', { ascending: true }).limit(1).maybeSingle()
    : Promise.resolve({ data: null })

  const mensagensQuery = ligaId
    ? supabase.from('Mensagem').select('*').eq('ligaId', ligaId).eq('aprovada', true).order('criadoEm', { ascending: false }).limit(5)
    : supabase.from('Mensagem').select('*').eq('aprovada', true).order('criadoEm', { ascending: false }).limit(5)

  const premiacoesQuery = ligaId
    ? supabase.from('Premiacao').select('*').eq('ligaId', ligaId).order('colocacao', { ascending: true })
    : Promise.resolve({ data: [] })

  const podiumQuery = ligaId ? getChampionshipPodium(ligaId) : Promise.resolve([] as PodiumTeam[])

  const [{ data: inscricoesAprovadas }, { data: partidas }, { data: partidaAoVivo }, { data: proximaAgendada }, { data: mensagens }, { data: premiacoes }, podium] = await Promise.all([
    equipesQuery,
    partidasQuery,
    partidaAoVivoQuery,
    proximaAgendadaQuery,
    mensagensQuery,
    premiacoesQuery,
    podiumQuery,
  ])

  const partidaDestaque = partidaAoVivo ?? proximaAgendada ?? (partidas ?? [])[0] ?? null
  const emAndamento = Boolean(partidaAoVivo)

  const equipesBase = (inscricoesAprovadas ?? [])
    .map((item: any) => Array.isArray(item.equipe) ? item.equipe[0] : item.equipe)
    .filter(Boolean)
    .map(normalizePortalTeam)
    .sort((a: any, b: any) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'))

  return { scope, liga, equipes: equipesBase, partidas: partidas ?? [], partidaDestaque, emAndamento, podium, mensagens: mensagens ?? [], premiacoes: premiacoes ?? [] }
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


