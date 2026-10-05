import { getChampionshipPodium, type PodiumTeam } from '@/lib/championship-podium'
import { getCreatorLeagueScope } from '@/lib/league-scope'
import { buscarAgendaCampeonato } from '@/lib/agenda-publica'
import { agruparPartidasPublicas, type GruposPartidaPublica } from '@/lib/partida-publica'
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
      temMais: { aoVivo: false, proximos: false, encerradas: false },
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
  if (agendaGlobal) return { ...vazioPortal(scope), agendaGlobal: true }

  const liga = scope.selectedLiga
  const ligaId = liga?.id as number
  const agenda = await buscarAgendaCampeonato(ligaId)
  if (agenda.erro) console.error('[portal] erro ao buscar partidas')
  const grupos = {
    aoVivo: agenda.aoVivo.partidas,
    proximos: agenda.proximos.partidas,
    encerradas: agenda.encerradas.partidas,
    analise: [],
    outras: [],
  }
  const temMais = { aoVivo: agenda.aoVivo.temMais, proximos: agenda.proximos.temMais, encerradas: agenda.encerradas.temMais }
  const partidas = [...grupos.aoVivo, ...grupos.proximos, ...grupos.encerradas]
  const partidaDestaque = grupos.aoVivo[0] ?? grupos.proximos[0] ?? grupos.encerradas[0] ?? null
  const emAndamento = grupos.aoVivo.length > 0
  const partidasFalha = agenda.erro
  const enxuto = !params.organizador
  if (!enxuto) {
    try {
      await reconcileAcceptedInvitations([ligaId])
    } catch (err) {
      console.error('[portal] erro ao reconciliar equipes do campeonato', err)
    }
  }

  const equipesQuery = enxuto
    ? Promise.resolve({ data: [] })
    : supabaseAdmin
      .from('InscricaoCampeonato')
      .select('equipe:Equipe(*, jogadores:Jogador(id,banido))')
      .eq('ligaId', ligaId)
      .eq('status', 'APROVADA')
      .order('criadaEm', { ascending: true })

  const mensagensQuery = enxuto
    ? Promise.resolve({ data: [] })
    : supabase.from('Mensagem').select('*').eq('ligaId', ligaId).eq('aprovada', true).order('criadoEm', { ascending: false }).limit(5)

  const premiacoesQuery = enxuto
    ? Promise.resolve({ data: [] })
    : supabase.from('Premiacao').select('*').eq('ligaId', ligaId).order('colocacao', { ascending: true })

  const podiumQuery = enxuto ? Promise.resolve([] as PodiumTeam[]) : getChampionshipPodium(ligaId)

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

  return { scope, liga, equipes: equipesBase, partidas, grupos, partidasFalha, temMais, agendaGlobal, partidaDestaque, emAndamento, podium, mensagens: mensagens ?? [], premiacoes: premiacoes ?? [] }
}

export async function getPainelInicio(organizadorId: string) {
  const scope = isSupabaseConfigured
    ? await getCreatorLeagueScope({ organizador: organizadorId })
    : { organizadorId, ligas: [] as any[], selectedLiga: null }
  if (!scope.ligas.length) return []

  return scope.ligas.map((liga: { id: number; nome: string; slug: string; capaUrl?: string | null; subtitulo?: string | null }) => ({
    id: liga.id,
    nome: liga.nome,
    slug: liga.slug,
    capaUrl: liga.capaUrl ?? null,
    subtitulo: liga.subtitulo ?? null,
  }))
}

function vazioPortal(scope: { organizadorId: string | null; ligas: any[]; selectedLiga: any | null }) {
  const grupos: GruposPartidaPublica = { aoVivo: [], proximos: [], encerradas: [], analise: [], outras: [] }
  return { scope, liga: null, equipes: [], partidas: [], grupos, partidasFalha: false, temMais: { aoVivo: false, proximos: false, encerradas: false }, agendaGlobal: false, partidaDestaque: null, emAndamento: false, podium: [] as PodiumTeam[], mensagens: [], premiacoes: [] }
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


