import { supabaseAdmin } from '@/lib/supabase-admin'
import { campeonatoDeTeste } from '@/lib/campeonato-teste'
import { normalizarPartidaPublica, PARTIDA_PUBLICA_COLUNAS, type PartidaPublica } from '@/lib/partida-publica'

const COLUNAS = `${PARTIDA_PUBLICA_COLUNAS},liga:Liga!Partida_ligaId_fkey(id,nome,simulacao)`

function normalizar(linhas: unknown[] | null) {
  return (linhas ?? [])
    .map(normalizarPartidaPublica)
    .filter((partida): partida is PartidaPublica => Boolean(partida))
    .filter((partida) => partida.liga?.simulacao !== true)
}

async function idsSemCampeonatoDeTeste(ligaIds: number[]) {
  const { data, error } = await supabaseAdmin.from('Liga').select('id,nome,slug,descricao,simulacao').in('id', ligaIds)
  if (error) return { ids: [] as number[], erro: true }
  return { ids: (data ?? []).filter((liga) => !campeonatoDeTeste(liga)).map((liga) => liga.id), erro: false }
}

const PAGINA_AGENDA = 8

export type FatiaAgenda = {
  partidas: PartidaPublica[]
  temMais: boolean
  erro: boolean
}

async function fatiaAgenda(ligaId: number, status: string[], ascending: boolean, offset: number, limite: number): Promise<FatiaAgenda> {
  const { data, error } = await supabaseAdmin
    .from('Partida')
    .select(COLUNAS)
    .eq('ligaId', ligaId)
    .in('status', status)
    .order('dataHora', { ascending })
    .range(offset, offset + limite)
  if (error) return { partidas: [], temMais: false, erro: true }
  const linhas = normalizar(data)
  return { partidas: linhas.slice(0, limite), temMais: linhas.length > limite, erro: false }
}

export async function buscarAgendaCampeonato(
  ligaId: number,
  opcoes?: { parte?: 'ao-vivo' | 'proximos' | 'encerradas'; offset?: number; limite?: number; campeonatoInformado?: boolean },
) {
  const vazio: FatiaAgenda = { partidas: [], temMais: false, erro: false }
  if (!opcoes?.campeonatoInformado) {
    const publico = await idsSemCampeonatoDeTeste([ligaId])
    if (publico.erro) return { aoVivo: { ...vazio, erro: true }, proximos: vazio, encerradas: vazio, erro: true }
    if (!publico.ids.includes(ligaId)) return { aoVivo: vazio, proximos: vazio, encerradas: vazio, erro: false }
  }

  const limite = Math.min(24, Math.max(1, opcoes?.limite ?? PAGINA_AGENDA))
  const offset = Math.max(0, opcoes?.offset ?? 0)
  const parte = opcoes?.parte
  const [aoVivo, proximos, encerradas] = await Promise.all([
    !parte || parte === 'ao-vivo' ? fatiaAgenda(ligaId, ['EM_ANDAMENTO'], true, parte ? offset : 0, limite) : Promise.resolve(vazio),
    !parte || parte === 'proximos' ? fatiaAgenda(ligaId, ['AGENDADA', 'PENDENTE'], true, parte ? offset : 0, limite) : Promise.resolve(vazio),
    !parte || parte === 'encerradas' ? fatiaAgenda(ligaId, ['ENCERRADA', 'WO'], false, parte ? offset : 0, limite) : Promise.resolve(vazio),
  ])
  return { aoVivo, proximos, encerradas, erro: aoVivo.erro || proximos.erro || encerradas.erro }
}

export async function buscarPartidasPublicas(ligaIds: number[], completo: boolean) {
  if (ligaIds.length === 0) return { partidas: [] as PartidaPublica[], erro: false }
  const publico = await idsSemCampeonatoDeTeste(ligaIds)
  if (publico.erro) return { partidas: [] as PartidaPublica[], erro: true }
  ligaIds = publico.ids
  if (ligaIds.length === 0) return { partidas: [] as PartidaPublica[], erro: false }
  if (completo) {
    const { data, error } = await supabaseAdmin
      .from('Partida')
      .select(COLUNAS)
      .in('ligaId', ligaIds)
      .order('dataHora', { ascending: true })
    if (error) return { partidas: [] as PartidaPublica[], erro: true }
    return { partidas: normalizar(data), erro: false }
  }

  const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const [aoVivo, proximos, recentes] = await Promise.all([
    supabaseAdmin.from('Partida').select(COLUNAS).in('ligaId', ligaIds).eq('status', 'EM_ANDAMENTO').order('dataHora', { ascending: true }),
    supabaseAdmin.from('Partida').select(COLUNAS).in('ligaId', ligaIds).in('status', ['AGENDADA', 'PENDENTE']).gte('dataHora', desde).order('dataHora', { ascending: true }).limit(40),
    supabaseAdmin.from('Partida').select(COLUNAS).in('ligaId', ligaIds).in('status', ['ENCERRADA', 'WO']).order('dataHora', { ascending: false }).limit(20),
  ])
  const falha = aoVivo.error || proximos.error || recentes.error
  if (falha) return { partidas: [] as PartidaPublica[], erro: true }
  return { partidas: normalizar([...(aoVivo.data ?? []), ...(proximos.data ?? []), ...(recentes.data ?? [])]), erro: false }
}
