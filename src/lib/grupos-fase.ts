export const MENSAGEM_CONFRONTO_FORA_DO_GRUPO =
  'Na fase de grupos, o jogo só pode ser entre equipes do mesmo grupo.'

const FASES_MATA_MATA = new Set([
  'FINAL',
  'SEMIFINAL',
  'QUARTAS',
  'OITAVAS',
  'DEZESSEIS_AVOS',
  'TERCEIRO_LUGAR',
])

export type VinculoDeGrupo = {
  equipeId: number
  grupoId: number
}

export function faseEhMataMata(fase?: string | null) {
  return FASES_MATA_MATA.has(String(fase ?? '').trim().toUpperCase())
}

export function faseEhDeGrupos(fase?: string | null) {
  const valor = String(fase ?? 'GERAL').trim().toUpperCase()
  return valor === '' || valor === 'GERAL' || valor === 'GRUPOS'
}

export function mensagemConfrontoForaDoGrupo(input: {
  fase?: string | null
  grupoId?: number | null
  equipeAId: number
  equipeBId: number
  vinculos: VinculoDeGrupo[]
}) {
  const faseMata = faseEhMataMata(input.fase)
  const faseGrupos = faseEhDeGrupos(input.fase) || input.grupoId != null
  if (faseMata && input.grupoId == null) return null
  if (!faseGrupos && !faseMata) return null

  const grupoDe = new Map<number, number>()
  for (const vinculo of input.vinculos) {
    grupoDe.set(Number(vinculo.equipeId), Number(vinculo.grupoId))
  }
  if (grupoDe.size === 0 && input.grupoId == null) return null

  const grupoA = grupoDe.get(Number(input.equipeAId))
  const grupoB = grupoDe.get(Number(input.equipeBId))
  if (grupoA == null || grupoB == null || grupoA !== grupoB) return MENSAGEM_CONFRONTO_FORA_DO_GRUPO
  if (input.grupoId != null && Number(input.grupoId) !== grupoA) return MENSAGEM_CONFRONTO_FORA_DO_GRUPO
  return null
}

export function mensagemParesForaDoGrupo(
  grupos: Array<{ equipeIds: number[] }>,
  pares: Array<{ equipeAId: number; equipeBId: number }>,
) {
  const grupoDe = new Map<number, number>()
  grupos.forEach((grupo, indice) => {
    for (const equipeId of grupo.equipeIds) grupoDe.set(Number(equipeId), indice)
  })
  for (const par of pares) {
    const grupoA = grupoDe.get(Number(par.equipeAId))
    const grupoB = grupoDe.get(Number(par.equipeBId))
    if (grupoA == null || grupoB == null || grupoA !== grupoB) return MENSAGEM_CONFRONTO_FORA_DO_GRUPO
  }
  return null
}

export function quantidadeInicialDeGrupos(input: {
  quantidadeSalva?: number | null
  formato?: string | null
  equipes: number
  gruposExistentes: number
}) {
  const salva = Number(input.quantidadeSalva)
  if (Number.isInteger(salva) && salva >= 1) return Math.min(32, salva)
  if (input.formato === 'GRUPOS_MATA_MATA' && input.equipes >= 4 && input.gruposExistentes === 0) return 2
  if (input.gruposExistentes >= 1) return Math.min(32, input.gruposExistentes)
  return 1
}

export function nomePadraoDoGrupo(indice: number) {
  return `Grupo ${String.fromCharCode(65 + indice)}`
}

export function distribuirEquipes(equipeIds: number[], quantidade: number) {
  const total = Math.max(1, Math.min(32, quantidade))
  return Array.from({ length: total }, (_, indice) => ({
    nome: nomePadraoDoGrupo(indice),
    equipeIds: equipeIds.filter((_, equipeIndice) => equipeIndice % total === indice),
  }))
}

export function alinharGrupos(input: {
  quantidade: number
  salvos: Array<{ nome?: string; equipeIds: number[] }>
  equipeIds: number[]
}) {
  const quantidade = Math.max(1, Math.min(32, Math.trunc(input.quantidade) || 1))
  const permitidos = new Set(input.equipeIds.map(Number))
  const salvos = input.salvos.map((grupo) => ({
    nome: String(grupo.nome ?? '').trim(),
    equipeIds: grupo.equipeIds.map(Number).filter((id) => permitidos.has(id)),
  }))
  const nomes = Array.from({ length: quantidade }, (_, indice) => salvos[indice]?.nome || nomePadraoDoGrupo(indice))
  if (salvos.length === quantidade) {
    const ids = salvos.flatMap((grupo) => grupo.equipeIds)
    const unicos = new Set(ids)
    const completo = ids.length === unicos.size
      && unicos.size === permitidos.size
      && input.equipeIds.every((id) => unicos.has(id))
      && salvos.every((grupo) => grupo.equipeIds.length > 0)
    if (completo) {
      return nomes.map((nome, indice) => ({ nome, equipeIds: salvos[indice].equipeIds }))
    }
  }
  return nomes.map((nome, indice) => ({
    nome,
    equipeIds: input.equipeIds.filter((_, equipeIndice) => equipeIndice % quantidade === indice),
  }))
}

export function cruzarSemifinais(grupos: Array<{ nome: string; classificados: number[] }>) {
  if (grupos.length !== 2) return null
  const [primeiro, segundo] = grupos
  if (primeiro.classificados.length < 2 || segundo.classificados.length < 2) return null
  return [
    {
      fase: 'SEMIFINAL' as const,
      rodada: 1,
      equipeAId: primeiro.classificados[0],
      equipeBId: segundo.classificados[1],
    },
    {
      fase: 'SEMIFINAL' as const,
      rodada: 2,
      equipeAId: segundo.classificados[0],
      equipeBId: primeiro.classificados[1],
    },
  ]
}

export type LinhaElenco = {
  equipeId: number
  equipe: string
  logoUrl?: string | null
  corHex?: string | null
  grupo: string | null
  jogadorId: number
  jogador: string
  numero: number | null
}

export function filtrarElenco(linhas: LinhaElenco[], termo: string) {
  const consulta = termo.trim().toLocaleLowerCase('pt-BR')
  if (!consulta) return linhas
  return linhas.filter((linha) => (
    linha.jogador.toLocaleLowerCase('pt-BR').includes(consulta)
    || linha.equipe.toLocaleLowerCase('pt-BR').includes(consulta)
    || String(linha.numero ?? '').includes(consulta)
  ))
}
