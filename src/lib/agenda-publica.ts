import { supabaseAdmin } from '@/lib/supabase-admin'
import { campeonatoDeTeste } from '@/lib/campeonato-teste'
import { idsCompeticoesPrivadas } from '@/lib/visibilidade-competicao'
import { consultarComVaga } from '@/lib/consulta-vaga'
import { normalizarPartidaPublica, PARTIDA_PUBLICA_COLUNAS, type PartidaPublica } from '@/lib/partida-publica'

const COLUNAS = `${PARTIDA_PUBLICA_COLUNAS},liga:Liga!Partida_ligaId_fkey(id,nome,simulacao,logoUrl)`

function normalizar(linhas: unknown[] | null) {
  return (linhas ?? [])
    .map(normalizarPartidaPublica)
    .filter((partida): partida is PartidaPublica => Boolean(partida))
    .filter((partida) => partida.liga?.simulacao !== true)
}

// `excluirPrivadas` vale para listas que misturam campeonatos (agenda global). Quem abre um
// campeonato específico, pelo link ou slug, passa sem ele: privada continua acessível ao convidado.
async function idsSemCampeonatoDeTeste(ligaIds: number[], opcoes: { excluirPrivadas?: boolean } = {}) {
  const { data, error } = await supabaseAdmin.from('Liga').select('id,nome,slug,descricao,simulacao').in('id', ligaIds)
  if (error) return { ids: [] as number[], erro: true }
  const privadas = opcoes.excluirPrivadas ? await idsCompeticoesPrivadas() : new Set<number>()
  return { ids: (data ?? []).filter((liga) => !campeonatoDeTeste(liga) && !privadas.has(Number(liga.id))).map((liga) => liga.id), erro: false }
}

const PAGINA_AGENDA = 8

export type FatiaAgenda = {
  partidas: PartidaPublica[]
  temMais: boolean
  erro: boolean
}

async function fatiaAgenda(ligaId: number, status: string[], offset: number, limite: number, categoriaCampeonatoId?: string | null): Promise<FatiaAgenda> {
  const { data, error } = await consultarComVaga(COLUNAS, (colunas) => {
    let consulta = supabaseAdmin
      .from('Partida')
      .select(colunas)
      .eq('ligaId', ligaId)
      .in('status', status)
    if (categoriaCampeonatoId) consulta = consulta.eq('categoriaCampeonatoId', categoriaCampeonatoId)
    return consulta
      .order('dataHora', { ascending: true, nullsFirst: false })
      .order('rodada', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + limite)
  })
  if (error) return { partidas: [], temMais: false, erro: true }
  const linhas = normalizar(data)
  return { partidas: linhas.slice(0, limite), temMais: linhas.length > limite, erro: false }
}

export async function buscarAgendaCampeonato(
  ligaId: number,
  opcoes?: { parte?: 'ao-vivo' | 'proximos' | 'encerradas'; offset?: number; limite?: number; campeonatoInformado?: boolean; categoriaCampeonatoId?: string | null },
) {
  const vazio: FatiaAgenda = { partidas: [], temMais: false, erro: false }
  if (!opcoes?.campeonatoInformado) {
    const publico = await idsSemCampeonatoDeTeste([ligaId])
    if (publico.erro) return { aoVivo: { ...vazio, erro: true }, proximos: vazio, encerradas: vazio, erro: true }
    if (!publico.ids.includes(ligaId)) return { aoVivo: vazio, proximos: vazio, encerradas: vazio, erro: false }
  }

  // A página segue em 8. Quem abriu "Ver mais" pede a janela inteira na releitura;
  // um teto curto devolvia só o começo e a agenda recolhia sozinha.
  const limite = Math.min(200, Math.max(1, opcoes?.limite ?? PAGINA_AGENDA))
  const offset = Math.max(0, opcoes?.offset ?? 0)
  const parte = opcoes?.parte
  const [aoVivo, proximos, encerradas] = await Promise.all([
    !parte || parte === 'ao-vivo' ? fatiaAgenda(ligaId, ['EM_ANDAMENTO'], parte ? offset : 0, limite, opcoes?.categoriaCampeonatoId) : Promise.resolve(vazio),
    !parte || parte === 'proximos' ? fatiaAgenda(ligaId, ['AGENDADA', 'PENDENTE'], parte ? offset : 0, limite, opcoes?.categoriaCampeonatoId) : Promise.resolve(vazio),
    !parte || parte === 'encerradas' ? fatiaAgenda(ligaId, ['ENCERRADA', 'WO'], parte ? offset : 0, limite, opcoes?.categoriaCampeonatoId) : Promise.resolve(vazio),
  ])
  return { aoVivo, proximos, encerradas, erro: aoVivo.erro || proximos.erro || encerradas.erro }
}

export async function buscarPartidasPublicas(ligaIds: number[], completo: boolean) {
  if (ligaIds.length === 0) return { partidas: [] as PartidaPublica[], erro: false }
  // Lista de vários campeonatos: privada nunca entra.
  const publico = await idsSemCampeonatoDeTeste(ligaIds, { excluirPrivadas: true })
  if (publico.erro) return { partidas: [] as PartidaPublica[], erro: true }
  ligaIds = publico.ids
  if (ligaIds.length === 0) return { partidas: [] as PartidaPublica[], erro: false }
  if (completo) {
    const { data, error } = await consultarComVaga(COLUNAS, (colunas) => (
      supabaseAdmin
        .from('Partida')
        .select(colunas)
        .in('ligaId', ligaIds)
        .order('dataHora', { ascending: true, nullsFirst: false })
        .order('rodada', { ascending: true })
        .order('id', { ascending: true })
    ))
    if (error) return { partidas: [] as PartidaPublica[], erro: true }
    return { partidas: normalizar(data), erro: false }
  }

  const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const [aoVivo, proximos, recentes] = await Promise.all([
    consultarComVaga(COLUNAS, (colunas) => supabaseAdmin.from('Partida').select(colunas).in('ligaId', ligaIds).eq('status', 'EM_ANDAMENTO').order('dataHora', { ascending: true, nullsFirst: false }).order('rodada', { ascending: true }).order('id', { ascending: true })),
    consultarComVaga(COLUNAS, (colunas) => supabaseAdmin.from('Partida').select(colunas).in('ligaId', ligaIds).in('status', ['AGENDADA', 'PENDENTE']).gte('dataHora', desde).order('dataHora', { ascending: true, nullsFirst: false }).order('rodada', { ascending: true }).order('id', { ascending: true }).limit(40)),
    consultarComVaga(COLUNAS, (colunas) => supabaseAdmin.from('Partida').select(colunas).in('ligaId', ligaIds).in('status', ['ENCERRADA', 'WO']).order('dataHora', { ascending: true, nullsFirst: false }).order('rodada', { ascending: true }).order('id', { ascending: true }).limit(20)),
  ])
  const falha = aoVivo.error || proximos.error || recentes.error
  if (falha) return { partidas: [] as PartidaPublica[], erro: true }
  return { partidas: normalizar([...(aoVivo.data ?? []), ...(proximos.data ?? []), ...(recentes.data ?? [])]), erro: false }
}
