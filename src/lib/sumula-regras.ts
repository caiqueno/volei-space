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

export type ParSubstituicao = {
  saiu: string
  entrou: string
  fechado: boolean
}

export type ControleSubstituicao = {
  usadas: number
  pares: ParSubstituicao[]
}

export type FalhaSubstituicao = 'limite' | 'par' | 'par_fechado'

export type AvisoSubstituicao =
  | { tipo: 'limite' }
  | { tipo: 'par_fechado'; titular: string; reserva: string }
  | { tipo: 'so_parceiro'; sai: string; volta: string }
  | { tipo: 'ja_saiu'; saiu: string; parceiro: string }
  | { tipo: 'nenhum' }

export type ListaSubstituicao = {
  numeros: string[]
  aviso: AvisoSubstituicao | null
}

export function controleVazio(): ControleSubstituicao {
  return { usadas: 0, pares: [] }
}

export function numerosDaTroca(descricao: string) {
  const troca = descricao.match(/sai #([^\s,]+).+entra #([^\s,]+)/i)
  if (!troca) return null
  return [limparNumero(troca[1]), limparNumero(troca[2])] as const
}

/**
 * Oito substituições por equipe em cada set. A troca de líbero não entra na
 * conta nem cria par. O par (sai A, entra B) só aceita a volta B → A. Depois
 * que A volta, o par fecha e nenhum dos dois entra de novo naquele set.
 */
export function validarSubstituicoes(input: {
  ocorrencias?: OcorrenciaSubstituicao[] | null
  equipes: EquipeNome[]
  jogadorEquipe?: Map<number, number>
}): string | null {
  const controles = new Map<string, ControleSubstituicao>()

  for (const ocorrencia of input.ocorrencias ?? []) {
    const tipo = String(ocorrencia.tipo ?? '').trim().toLowerCase()
    if (tipo === 'troca_libero' || tipo === 'libero_exchange') continue
    if (tipo !== 'substitution' && tipo !== 'substituicao') continue

    const set = Number(ocorrencia.set ?? 1)
    const equipeId = equipeDaOcorrencia(ocorrencia, input.equipes, input.jogadorEquipe)
    if (equipeId == null) return 'A súmula tem uma substituição sem equipe identificável.'

    const chave = `${equipeId}:${set}`
    const atual = controles.get(chave) ?? controleVazio()
    const troca = numerosDaTroca(String(ocorrencia.descricao ?? ''))
    if (!troca) {
      if (atual.usadas >= LIMITE_SUBSTITUICOES_POR_SET) {
        return mensagemFalhaSubstituicao('limite', set)
      }
      controles.set(chave, { usadas: atual.usadas + 1, pares: atual.pares })
      continue
    }

    const resultado = aplicarSubstituicao(atual, troca[0], troca[1])
    if (resultado.falha) return mensagemFalhaSubstituicao(resultado.falha, set)
    controles.set(chave, resultado.controle)
  }

  return null
}

export function aplicarSubstituicao(
  controle: ControleSubstituicao,
  saiu: string,
  entrou: string,
): { controle: ControleSubstituicao; falha: FalhaSubstituicao | null } {
  if (controle.usadas >= LIMITE_SUBSTITUICOES_POR_SET) {
    return { controle, falha: 'limite' }
  }
  const pares = controle.pares.map((par) => ({ ...par }))
  const falha = vincularPar(pares, saiu, entrou)
  if (falha) return { controle, falha }
  return { controle: { usadas: controle.usadas + 1, pares }, falha: null }
}

export function reservasElegiveis(
  controle: ControleSubstituicao,
  saiu: string,
  reservas: string[],
): ListaSubstituicao {
  const bancada = reservas.filter((numero, index) => numero && numero !== saiu && reservas.indexOf(numero) === index)
  if (controle.usadas >= LIMITE_SUBSTITUICOES_POR_SET) {
    return { numeros: [], aviso: { tipo: 'limite' } }
  }

  const par = controle.pares.find((item) => item.saiu === saiu || item.entrou === saiu)
  if (par?.fechado) {
    return { numeros: [], aviso: { tipo: 'par_fechado', titular: par.saiu, reserva: par.entrou } }
  }
  if (par && par.entrou === saiu) {
    const aviso = { tipo: 'so_parceiro', sai: saiu, volta: par.saiu } as const
    return bancada.includes(par.saiu) ? { numeros: [par.saiu], aviso } : { numeros: [], aviso }
  }
  if (par && par.saiu === saiu) {
    return { numeros: [], aviso: { tipo: 'ja_saiu', saiu, parceiro: par.entrou } }
  }

  const bloqueados = new Set<string>()
  for (const item of controle.pares) {
    bloqueados.add(item.saiu)
    bloqueados.add(item.entrou)
  }
  const numeros = bancada.filter((numero) => !bloqueados.has(numero))
  return { numeros, aviso: numeros.length ? null : { tipo: 'nenhum' } }
}

export function mensagemFalhaSubstituicao(falha: FalhaSubstituicao, set: number) {
  if (falha === 'limite') {
    return `A equipe atingiu o limite de ${LIMITE_SUBSTITUICOES_POR_SET} substituições no set ${set}.`
  }
  if (falha === 'par_fechado') {
    return `No set ${set}, esse par já voltou e não pode ser substituído de novo.`
  }
  return `A substituição do set ${set} quebra o par já formado nesta equipe.`
}

export function textoAvisoSubstituicao(
  aviso: AvisoSubstituicao,
  numero: (valor: string) => string = (valor) => valor,
) {
  if (aviso.tipo === 'limite') {
    return `Limite de ${LIMITE_SUBSTITUICOES_POR_SET} substituições por set atingido para esta equipe.`
  }
  if (aviso.tipo === 'par_fechado') {
    return `Neste set, #${numero(aviso.titular)} já voltou no lugar de #${numero(aviso.reserva)}. Os dois não podem ser substituídos de novo.`
  }
  if (aviso.tipo === 'so_parceiro') {
    return `Neste set, #${numero(aviso.sai)} só pode sair para #${numero(aviso.volta)} voltar.`
  }
  if (aviso.tipo === 'ja_saiu') {
    return `Neste set, #${numero(aviso.saiu)} já saiu e só pode voltar no lugar de #${numero(aviso.parceiro)}.`
  }
  return 'Nenhum reserva elegível neste set.'
}

function vincularPar(pares: ParSubstituicao[], saiu: string, entrou: string): Exclude<FalhaSubstituicao, 'limite'> | null {
  if (!saiu || !entrou || saiu === entrou) return 'par'
  const parDeQuemSai = pares.find((par) => par.saiu === saiu || par.entrou === saiu)
  const parDeQuemEntra = pares.find((par) => par.saiu === entrou || par.entrou === entrou)
  if (parDeQuemSai?.fechado || parDeQuemEntra?.fechado) return 'par_fechado'

  if (parDeQuemSai && parDeQuemSai.entrou === saiu) {
    if (entrou !== parDeQuemSai.saiu) return 'par'
    parDeQuemSai.fechado = true
    return null
  }
  if (parDeQuemSai) return 'par'

  if (parDeQuemEntra) {
    if (parDeQuemEntra.saiu === entrou && parDeQuemEntra.entrou === saiu) {
      parDeQuemEntra.fechado = true
      return null
    }
    return 'par'
  }

  pares.push({ saiu, entrou, fechado: false })
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

function limparNumero(valor: string) {
  return valor.replace(/[.,;:]+$/g, '')
}

function normalizar(valor?: string | null) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}
