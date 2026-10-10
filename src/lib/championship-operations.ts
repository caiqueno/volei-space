import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { partidaEncerrada } from '@/lib/classificacao'
import { resolveLeagueLifecycleStatus } from '@/lib/championship-lifecycle'
import { gruposDeConfronto } from '@/lib/isolamento-categoria'
import { gerarSumulaToken } from '@/lib/sumula-token'

type LigaRecord = {
  id: number
  quantidadeEquipes?: number | null
  formato?: string | null
  quantidadeGrupos?: number | null
}

type EquipeRecord = {
  id: number
  categoria?: string | null
  serie?: string | null
  categoriaCampeonatoId?: string | null
  nome?: string | null
}

type InscricaoWithRelations = {
  id: string
  ligaId: number
  equipeId: number
  liga?: LigaRecord | LigaRecord[] | null
  equipe?: EquipeRecord | EquipeRecord[] | null
}

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

export async function countApprovedRegistrations(ligaId: number) {
  const { count, error } = await supabase
    .from('InscricaoCampeonato')
    .select('id', { count: 'exact', head: true })
    .eq('ligaId', ligaId)
    .eq('status', 'APROVADA')

  if (error) throw error
  return count ?? 0
}

export async function ensureClassificationAndCalendar(inscricao: InscricaoWithRelations) {
  const liga = firstRelation(inscricao.liga)
  const equipe = firstRelation(inscricao.equipe)
  if (!liga || !equipe) return

  await supabase
    .from('Equipe')
    .update({ ligaId: liga.id, statusEquipe: 'ATIVA' })
    .eq('id', equipe.id)

  const approved = await getApprovedTeams(liga.id)
  await ensureClassificationEntries(liga.id, approved)
  if (!liga.quantidadeGrupos || Number(liga.quantidadeGrupos) <= 1) {
    for (const grupo of gruposDeConfronto(approved)) {
      await ensureSchedule(liga, grupo)
    }
  }
}

export async function recalculateLeagueClassification(ligaId: number) {
  // A RPC recalcular_classificacao_liga que fica ativa depois da migration
  // atomica ainda pontua 4/3/1/0 e soma jogo de mata-mata na tabela.
  // O cálculo vigente é o de classificacao.ts, gravado aqui. A trava
  // pg_advisory_xact_lock precisa voltar no banco em volta desta mesma regra.
  const { gravarClassificacao } = await import('@/lib/massa-qa')
  await gravarClassificacao(ligaId)
}

export function isFinishedMatch(partida: any) {
  return partidaEncerrada(partida)
}

export async function syncLeagueLifecycle(ligaId: number) {
  const { data: ligaAtual, error: ligaAtualError } = await supabase
    .from('Liga')
    .select('status')
    .eq('id', ligaId)
    .maybeSingle()
  if (ligaAtualError) throw ligaAtualError
  if (String(ligaAtual?.status ?? '').toUpperCase() === 'FINALIZADO') return 'FINALIZADO'

  const { data: partidas, error: partidasError } = await supabase
    .from('Partida')
    .select('status')
    .eq('ligaId', ligaId)

  if (partidasError) throw partidasError
  if (!partidas?.length) return 'EM_BREVE'

  const statuses = partidas.map((partida: any) => String(partida.status))
  const status = resolveLeagueLifecycleStatus(statuses)

  const { error: updateError } = await supabase.from('Liga').update({ status }).eq('id', ligaId)
  if (updateError) throw updateError
  return status
}

export async function getApprovedTeams(ligaId: number) {
  const { data, error } = await supabase
    .from('InscricaoCampeonato')
    .select('equipe:Equipe(*)')
    .eq('ligaId', ligaId)
    .eq('status', 'APROVADA')
    .order('criadaEm', { ascending: true })

  if (error) throw error
  const equipes = (data ?? [])
    .map((item: any) => firstRelation<EquipeRecord>(item.equipe))
    .filter(Boolean) as EquipeRecord[]

  if (equipes.length > 0) return equipes

  // Ligas anteriores ao fluxo de InscricaoCampeonato nunca tiveram inscrição
  // registrada — seus times só existem ligados direto por Equipe.ligaId.
  const { data: legacyEquipes, error: legacyErr } = await supabase
    .from('Equipe')
    .select('id,nome,categoria,serie,categoriaCampeonatoId')
    .eq('ligaId', ligaId)

  if (legacyErr) throw legacyErr
  return (legacyEquipes ?? []) as EquipeRecord[]
}

async function ensureClassificationEntries(ligaId: number, equipes: EquipeRecord[]) {
  const rows = equipes.map((equipe, index) => ({
    equipeId: equipe.id,
    ligaId,
    categoria: equipe.categoria || 'GERAL',
    serie: null,
    categoriaCampeonatoId: equipe.categoriaCampeonatoId,
    posicao: index + 1,
    pontos: 0,
    jogos: 0,
    vitorias: 0,
    derrotas: 0,
    setsPro: 0,
    setsContra: 0,
    pontosPro: 0,
    pontosContra: 0,
    punicoes: 0,
  }))

  if (rows.length === 0) return

  // Só cria a linha que ainda não existe. Atualizar aqui zeraria pontos,
  // jogos e saldo de equipes que já têm partida encerrada.
  const { error } = await supabase
    .from('ClassificacaoEntrada')
    .upsert(rows, { onConflict: 'ligaId,equipeId', ignoreDuplicates: true })

  if (error) throw error
}

async function ensureSchedule(liga: LigaRecord, equipes: EquipeRecord[]) {
  if (equipes.length < 2) return

  const { data: existing, error: existingErr } = await supabase
    .from('Partida')
    .select('equipeAId,equipeBId')
    .eq('ligaId', liga.id)

  if (existingErr) throw existingErr
  const existingPairs = new Set(
    (existing ?? []).map((partida: any) => pairKey(partida.equipeAId, partida.equipeBId)),
  )

  const pairings = buildPairings(equipes, liga.formato)
    .filter((pair) => !existingPairs.has(pairKey(pair.a.id, pair.b.id)))
  if (pairings.length === 0) return

  const start = nextSaturdayAtFive()
  const rows = pairings.map((pair, index) => {
    const dataHora = new Date(start)
    dataHora.setDate(start.getDate() + index)
    return {
      ligaId: liga.id,
      equipeAId: pair.a.id,
      equipeBId: pair.b.id,
      categoria: pair.a.categoria || pair.b.categoria || 'GERAL',
      serie: null,
      categoriaCampeonatoId: pair.a.categoriaCampeonatoId || pair.b.categoriaCampeonatoId || null,
      rodada: pair.rodada,
      status: 'AGENDADA',
      dataHora: dataHora.toISOString(),
      localNome: 'A definir',
      sumulaToken: gerarSumulaToken(),
    }
  })

  const { error } = await supabase.from('Partida').insert(rows)
  if (error) throw error
}

function pairKey(a: number, b: number) {
  return [a, b].sort((left, right) => left - right).join(':')
}

function buildPairings(equipes: EquipeRecord[], formato?: string | null) {
  if (formato === 'MATA_MATA' || formato === 'COPA_CURTA') {
    const rows: Array<{ a: EquipeRecord; b: EquipeRecord; rodada: number }> = []
    for (let index = 0; index + 1 < equipes.length; index += 2) {
      rows.push({ a: equipes[index], b: equipes[index + 1], rodada: 1 })
    }
    return rows
  }

  const rows: Array<{ a: EquipeRecord; b: EquipeRecord; rodada: number }> = []
  let rodada = 1
  for (let i = 0; i < equipes.length; i += 1) {
    for (let j = i + 1; j < equipes.length; j += 1) {
      rows.push({ a: equipes[i], b: equipes[j], rodada })
      rodada += 1
    }
  }
  return rows
}

function nextSaturdayAtFive() {
  const date = new Date()
  const day = date.getDay()
  const delta = (6 - day + 7) % 7 || 7
  date.setDate(date.getDate() + delta)
  date.setHours(17, 0, 0, 0)
  return date
}
