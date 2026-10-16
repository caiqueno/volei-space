/**
 * Relação nominal (elenco), camisas, líberos e capitão em jogo.
 * RG-ELE-001/004/005, RG-LIB-001. Módulo PURO.
 */
import type { PerfilRegras } from './config'
import { validarRegistroDeLiberos } from './libero'
import { bloqueio, ok, type ResultadoRegra } from './tipos'

export const MAX_JOGADORES_PADRAO = 12 // RG-ELE-001 (4.1.1)
export const MAX_JOGADORES_FIVB = 14
export const CAMISA_MAXIMA_PADRAO = 20 // RG-ELE-004 (4.3.3); a FIVB amplia em elencos maiores

export interface JogadorElenco {
  id: number
  /** Número da camisa. */
  camisa: number
}

export interface ComissaoTecnica {
  tecnicos: number
  assistentes: number
  /** Fisioterapeuta + médico. */
  areaMedica: number
}

export interface OpcoesElenco {
  /** 12 (padrão) ou 14 (FIVB/World/Oficiais Adulto). */
  maxJogadores?: number
  camisaMaxima?: number
  /** RG-LIB-001: 2 líberos obrigatórios com mais de 12 jogadores. */
  exigeDoisLiberosAcimaDe12?: boolean
  comissao?: ComissaoTecnica
}

/** Opções de elenco derivadas do perfil (campos opcionais do perfil; ausente = padrão de 12). */
export function opcoesElencoDoPerfil(perfil: PerfilRegras): OpcoesElenco {
  return {
    ...(perfil.maxJogadoresElenco !== undefined ? { maxJogadores: perfil.maxJogadoresElenco } : {}),
    exigeDoisLiberosAcimaDe12: perfil.exigeDoisLiberosAcimaDe12 === true,
  }
}

/**
 * RG-ELE-001 (tamanho e comissão), RG-ELE-004 (camisas únicas de 1 a N) e RG-LIB-001 (até 2 líberos,
 * da relação nominal; 2 obrigatórios com mais de 12 em competição FIVB, se o perfil pedir).
 */
export function validarElenco(jogadores: readonly JogadorElenco[], liberos: readonly number[], opcoes: OpcoesElenco = {}): ResultadoRegra {
  const maximo = opcoes.maxJogadores ?? MAX_JOGADORES_PADRAO
  if (jogadores.length > maximo) {
    return bloqueio('RG-ELE-001', `A relação nominal tem ${jogadores.length} jogadores; o máximo é ${maximo}.`)
  }
  const ids = new Set<number>()
  for (const j of jogadores) {
    if (ids.has(j.id)) return bloqueio('RG-ELE-001', `O jogador ${j.id} aparece duas vezes na relação nominal.`)
    ids.add(j.id)
  }
  const c = opcoes.comissao
  if (c) {
    if (c.tecnicos > 1) return bloqueio('RG-ELE-001', 'Cada equipe pode ter no máximo 1 técnico.')
    if (c.assistentes > 2) return bloqueio('RG-ELE-001', 'Cada equipe pode ter no máximo 2 assistentes.')
    if (c.areaMedica > 2) return bloqueio('RG-ELE-001', 'Cada equipe pode ter no máximo 2 da área médica (fisioterapeuta e médico).')
  }
  const camisaMaxima = opcoes.camisaMaxima ?? CAMISA_MAXIMA_PADRAO
  const camisas = new Map<number, number>()
  for (const j of jogadores) {
    if (!Number.isInteger(j.camisa) || j.camisa < 1 || j.camisa > camisaMaxima) {
      return bloqueio('RG-ELE-004', `A camisa do jogador ${j.id} (${j.camisa}) precisa ser um número de 1 a ${camisaMaxima}.`)
    }
    const dono = camisas.get(j.camisa)
    if (dono !== undefined) {
      return bloqueio('RG-ELE-004', `A camisa ${j.camisa} está repetida (jogadores ${dono} e ${j.id}); o número é único na equipe.`)
    }
    camisas.set(j.camisa, j.id)
  }
  return validarRegistroDeLiberos([...liberos], jogadores.map((j) => j.id), {
    exigeDoisAcimaDe12: opcoes.exigeDoisLiberosAcimaDe12 === true,
  })
}

/**
 * RG-ELE-005: o capitão em jogo é o capitão da equipe se estiver em quadra; senão, o jogador em quadra
 * designado pelo técnico/capitão, até ele ser substituído, o capitão voltar ou o set acabar.
 * Devolve quem é o capitão em jogo agora (null = falta designar).
 */
export function capitaoEmJogo(params: {
  capitao: number | null | undefined
  designado: number | null | undefined
  emQuadra: readonly number[]
}): number | null {
  if (params.capitao != null && params.emQuadra.includes(params.capitao)) return params.capitao
  if (params.designado != null && params.emQuadra.includes(params.designado)) return params.designado
  return null
}

/** RG-ELE-005: valida a designação de um capitão em jogo. */
export function validarDesignacaoDeCapitao(params: {
  capitao: number | null | undefined
  designado: number
  emQuadra: readonly number[]
  elenco?: readonly number[]
  impedidos?: readonly number[]
}): ResultadoRegra {
  if (params.capitao != null && params.emQuadra.includes(params.capitao)) {
    return bloqueio('RG-ELE-005', `O capitão (${params.capitao}) está em quadra: é ele o capitão em jogo, não há o que designar.`)
  }
  if (params.elenco && !params.elenco.includes(params.designado)) {
    return bloqueio('RG-FOR-009', `O jogador ${params.designado} não consta na relação nominal.`)
  }
  if (!params.emQuadra.includes(params.designado)) {
    return bloqueio('RG-ELE-005', `O capitão em jogo precisa estar em quadra; o jogador ${params.designado} não está.`)
  }
  if (params.impedidos?.includes(params.designado)) {
    return bloqueio('RG-ELE-005', `O jogador ${params.designado} está impedido de atuar e não pode ser capitão em jogo.`)
  }
  return ok()
}
