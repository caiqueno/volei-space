import { supabaseAdmin } from '@/lib/supabase-admin'
import { faseContaNaClassificacao, type PartidaClassificacao } from '@/lib/classificacao'
import { ranquearGrupo } from '@/lib/chave-grupos'
import { gruposEncerradosNaCategoria } from '@/lib/operacao-categoria'
import { colunasDeVagaAtivas } from '@/lib/consulta-vaga'
import { aplicarVagas, type JogoVaga } from '@/lib/vaga-a-definir'

function numeroOuNulo(valor: unknown) {
  const id = Number(valor)
  return Number.isInteger(id) && id > 0 ? id : null
}

export async function sincronizarVagas(ligaId: number, categoriaCampeonatoId: string | null) {
  if (!Number.isInteger(ligaId) || ligaId <= 0) return { atualizados: 0 }
  if (!(await colunasDeVagaAtivas())) return { atualizados: 0 }
  const categorias = categoriaCampeonatoId ? [categoriaCampeonatoId] : await categoriasComVaga(ligaId)
  let atualizados = 0
  for (const categoria of categorias) {
    atualizados += (await sincronizarCategoria(ligaId, categoria)).atualizados
  }
  return { atualizados }
}

export async function sincronizarVagasDaPartida(partida: { id?: number | null; ligaId?: number | null; categoriaCampeonatoId?: string | null }) {
  let ligaId = Number(partida.ligaId)
  let categoria = partida.categoriaCampeonatoId ?? null
  if (partida.id && (!Number.isInteger(ligaId) || ligaId <= 0 || !categoria)) {
    const { data } = await supabaseAdmin.from('Partida').select('ligaId,categoriaCampeonatoId').eq('id', partida.id).maybeSingle()
    ligaId = Number(data?.ligaId)
    categoria = (data?.categoriaCampeonatoId as string | null) ?? categoria
  }
  return sincronizarVagas(ligaId, categoria)
}

async function categoriasComVaga(ligaId: number) {
  const { data, error } = await supabaseAdmin
    .from('Partida')
    .select('categoriaCampeonatoId,origemVagaA,origemVagaB')
    .eq('ligaId', ligaId)
    .in('fase', ['SEMIFINAL', 'FINAL', 'TERCEIRO_LUGAR', 'QUARTAS', 'OITAVAS', 'DEZESSEIS_AVOS'])
  if (error || !data) return []
  return Array.from(new Set(
    data
      .filter((partida) => partida.origemVagaA || partida.origemVagaB)
      .map((partida) => partida.categoriaCampeonatoId)
      .filter((id): id is string => Boolean(id)),
  ))
}

async function sincronizarCategoria(ligaId: number, categoriaCampeonatoId: string) {

  const { data: partidas, error } = await supabaseAdmin
    .from('Partida')
    .select('id,fase,rodada,status,equipeAId,equipeBId,origemVagaA,origemVagaB,setsPorA,setsPorB,vencedorId,sumulaAprovadaEm,sumulaSubmetidaEm,categoriaCampeonatoId')
    .eq('ligaId', ligaId)
    .eq('categoriaCampeonatoId', categoriaCampeonatoId)
  if (error || !partidas?.length) return { atualizados: 0 }
  if (!partidas.some((partida) => partida.origemVagaA || partida.origemVagaB)) return { atualizados: 0 }

  const [{ data: grupos }, { data: vinculos }, { data: config }] = await Promise.all([
    supabaseAdmin.from('GrupoCampeonato').select('id,nome,ordem,classificados').eq('ligaId', ligaId).eq('categoriaCampeonatoId', categoriaCampeonatoId),
    supabaseAdmin.from('GrupoEquipeCampeonato').select('grupoId,equipeId').eq('ligaId', ligaId).eq('categoriaCampeonatoId', categoriaCampeonatoId),
    supabaseAdmin.from('CategoriaConfiguracao').select('formato,classificadosPorGrupo').eq('ligaId', ligaId).eq('categoriaCampeonatoId', categoriaCampeonatoId).maybeSingle(),
  ])

  const porGrupo = new Map<number, number[]>()
  for (const vinculo of vinculos ?? []) {
    const lista = porGrupo.get(Number(vinculo.grupoId)) ?? []
    lista.push(Number(vinculo.equipeId))
    porGrupo.set(Number(vinculo.grupoId), lista)
  }
  const partidasGrupo = partidas.filter((partida) => faseContaNaClassificacao(partida.fase)) as PartidaClassificacao[]
  const limitePadrao = Number(config?.classificadosPorGrupo ?? 0)
  const ranque = [...(grupos ?? [])]
    .sort((a, b) => Number(a.ordem ?? 0) - Number(b.ordem ?? 0) || Number(a.id) - Number(b.id))
    .map((grupo) => {
      const equipeIds = porGrupo.get(Number(grupo.id)) ?? []
      const limiteGrupo = Number(grupo.classificados ?? 0) > 0 ? Number(grupo.classificados) : limitePadrao
      const limite = limiteGrupo > 0 ? limiteGrupo : Math.min(2, equipeIds.length)
      return { nome: String(grupo.nome ?? ''), classificados: ranquearGrupo(equipeIds, partidasGrupo, limite) }
    })

  const jogos: JogoVaga[] = partidas.map((partida) => ({
    id: Number(partida.id),
    fase: String(partida.fase ?? ''),
    rodada: Number(partida.rodada),
    status: partida.status,
    equipeAId: numeroOuNulo(partida.equipeAId),
    equipeBId: numeroOuNulo(partida.equipeBId),
    origemVagaA: partida.origemVagaA ?? null,
    origemVagaB: partida.origemVagaB ?? null,
    setsPorA: partida.setsPorA,
    setsPorB: partida.setsPorB,
    vencedorId: partida.vencedorId,
  }))
  const patches = aplicarVagas({
    jogos,
    gruposEncerrados: gruposEncerradosNaCategoria(partidas, categoriaCampeonatoId, config?.formato),
    grupos: ranque,
  })

  let atualizados = 0
  for (const patch of patches) {
    const campos: Record<string, unknown> = { atualizadoEm: new Date().toISOString() }
    if (patch.equipeAId != null) campos.equipeAId = patch.equipeAId
    if (patch.equipeBId != null) campos.equipeBId = patch.equipeBId
    const { error: updateErr } = await supabaseAdmin.from('Partida').update(campos).eq('id', patch.id)
    if (!updateErr) atualizados += 1
    else console.error('[vaga] não preencheu o jogo', patch.id, updateErr.message)
  }
  return { atualizados }
}
