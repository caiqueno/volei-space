import { getRequiredEliminatoryTeams } from '@/lib/eliminatorias'

export type GrupoClassificacao = { id: number; classificados: number }
export type VinculoGrupo = { grupoId: number; equipeId: number }

/**
 * Quem avança ao mata-mata.
 * Com grupos: os N primeiros de cada grupo, na ordem da tabela, e depois os
 * melhores classificados gerais que ainda não entraram.
 * Sem grupos, no mata-mata puro: todas as equipes da tabela.
 * Sem grupos e com fórmula zerada: os primeiros exigidos pela fase, para a
 * chave não nascer vazia quando `classificadosPorGrupo` ficou em 0.
 */
export function selecionarClassificados(input: {
  formato?: string | null
  faseEliminatoria?: string | null
  quantidadeGrupos?: number | null
  classificadosPorGrupo?: number | null
  melhoresClassificadosGerais?: number | null
  ordenados: number[]
  grupos?: GrupoClassificacao[]
  vinculos?: VinculoGrupo[]
  manuais?: number[]
}) {
  const classificados = new Set<number>()
  const grupos = input.grupos ?? []
  const vinculos = input.vinculos ?? []
  const ordenados = input.ordenados.map((id) => Number(id))

  if (grupos.length > 0 && vinculos.length > 0) {
    const grupoDe = new Map<number, number>()
    vinculos.forEach((vinculo) => grupoDe.set(Number(vinculo.equipeId), Number(vinculo.grupoId)))
    const limitePorGrupo = new Map<number, number>()
    grupos.forEach((grupo) => limitePorGrupo.set(Number(grupo.id), Math.max(0, Number(grupo.classificados ?? 0))))
    const contagem = new Map<number, number>()
    for (const equipeId of ordenados) {
      const grupoId = grupoDe.get(equipeId)
      if (grupoId == null) continue
      const limite = limitePorGrupo.get(grupoId) ?? 0
      const jaForam = contagem.get(grupoId) ?? 0
      if (jaForam >= limite) continue
      classificados.add(equipeId)
      contagem.set(grupoId, jaForam + 1)
    }

    const extras = Math.max(0, Number(input.melhoresClassificadosGerais ?? 0))
    let incluidos = 0
    for (const equipeId of ordenados) {
      if (incluidos >= extras) break
      if (!grupoDe.has(equipeId) || classificados.has(equipeId)) continue
      classificados.add(equipeId)
      incluidos += 1
    }
  } else {
    const formato = input.formato === 'COPA_CURTA' ? 'MATA_MATA' : input.formato
    if (formato === 'MATA_MATA') {
      ordenados.forEach((equipeId) => classificados.add(equipeId))
    } else {
      const formula = Number(input.quantidadeGrupos ?? 1) * Number(input.classificadosPorGrupo ?? 0)
        + Number(input.melhoresClassificadosGerais ?? 0)
      const exigidos = getRequiredEliminatoryTeams(input.faseEliminatoria)
      const limite = formula > 0 ? formula : exigidos
      ordenados.slice(0, Math.max(0, limite)).forEach((equipeId) => classificados.add(equipeId))
    }
  }

  for (const equipeId of input.manuais ?? []) classificados.add(Number(equipeId))
  return classificados
}
