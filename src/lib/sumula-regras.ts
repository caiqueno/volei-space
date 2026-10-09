export const JANELA_CORRECAO_SUMULA_MS = 30 * 60 * 1000
export const LIMITE_SUBSTITUICOES_POR_SET = 8

export function correcaoPeloLinkPermitida(sumulaAprovadaEm: string | Date | null | undefined, agora: Date) {
  if (!sumulaAprovadaEm) return true
  const inicio = new Date(sumulaAprovadaEm).getTime()
  if (!Number.isFinite(inicio)) return false
  return agora.getTime() - inicio <= JANELA_CORRECAO_SUMULA_MS
}

type OcorrenciaSubstituicao = {
  tipo?: string | null
  descricao?: string | null
  set?: number | null
  jogadorId?: number | null
}

type EquipeNome = { id: number; nome?: string | null }

/**
 * Oito substituições por equipe em cada set. A troca de líbero não entra na
 * conta nem cria par. O par registrado (sai X, entra Y) só aceita a reversão
 * entre esses dois atletas no mesmo set.
 */
export function validarSubstituicoes(input: {
  ocorrencias?: OcorrenciaSubstituicao[] | null
  equipes: EquipeNome[]
  jogadorEquipe?: Map<number, number>
}): string | null {
  const contagem = new Map<string, number>()
  const pares = new Map<string, Map<string, string>>()

  for (const ocorrencia of input.ocorrencias ?? []) {
    const tipo = String(ocorrencia.tipo ?? '').trim().toLowerCase()
    if (tipo === 'troca_libero' || tipo === 'libero_exchange') continue
    if (tipo !== 'substitution' && tipo !== 'substituicao') continue

    const set = Number(ocorrencia.set ?? 1)
    const equipeId = equipeDaOcorrencia(ocorrencia, input.equipes, input.jogadorEquipe)
    if (equipeId == null) return 'A súmula tem uma substituição sem equipe identificável.'

    const chave = `${equipeId}:${set}`
    const total = (contagem.get(chave) ?? 0) + 1
    if (total > LIMITE_SUBSTITUICOES_POR_SET) {
      return `A equipe atingiu o limite de ${LIMITE_SUBSTITUICOES_POR_SET} substituições no set ${set}.`
    }
    contagem.set(chave, total)

    const troca = String(ocorrencia.descricao ?? '').match(/sai #([^\s,]+).+entra #([^\s,]+)/i)
    if (!troca) continue
    const saiu = troca[1]
    const entrou = troca[2]
    const mapa = pares.get(chave) ?? new Map<string, string>()
    const parceiroDeQuemSai = mapa.get(saiu)
    const parceiroDeQuemEntra = mapa.get(entrou)
    if ((parceiroDeQuemSai && parceiroDeQuemSai !== entrou) || (parceiroDeQuemEntra && parceiroDeQuemEntra !== saiu)) {
      return `A substituição do set ${set} quebra o par já formado nesta equipe.`
    }
    mapa.set(saiu, entrou)
    mapa.set(entrou, saiu)
    pares.set(chave, mapa)
  }

  return null
}

function equipeDaOcorrencia(
  ocorrencia: OcorrenciaSubstituicao,
  equipes: EquipeNome[],
  jogadorEquipe?: Map<number, number>,
) {
  if (ocorrencia.jogadorId != null && jogadorEquipe?.has(Number(ocorrencia.jogadorId))) {
    return jogadorEquipe.get(Number(ocorrencia.jogadorId)) ?? null
  }
  const texto = normalizar(ocorrencia.descricao)
  const encontradas = equipes.filter((equipe) => equipe.nome && texto.includes(normalizar(equipe.nome)))
  if (encontradas.length === 1) return encontradas[0].id
  if (encontradas.length > 1) {
    encontradas.sort((a, b) => normalizar(b.nome).length - normalizar(a.nome).length)
    return encontradas[0].id
  }
  return null
}

function normalizar(valor?: string | null) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}
