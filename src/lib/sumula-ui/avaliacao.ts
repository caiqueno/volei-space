/**
 * Adaptadores entre a súmula e o motor: validam substituição, substituição excepcional, troca e
 * redesignação de líbero e devolvem uma Avaliacao pronta para a tela. Módulo PURO.
 *
 * Decisão de produto: RG-SUB-007 (um pedido por interrupção) não bloqueia na tela, porque o motor
 * ainda não aceita vários atletas por pedido (divergência 9 do doc 23); vira aviso.
 */
import {
  validarRedesignacaoLibero,
  validarSubstituicaoExcepcional,
  validarSubstituicaoRegular,
  validarTrocaLibero,
  type EstadoEquipe,
  type MotivoExcepcional,
  type PerfilRegras,
  type ResultadoRegra,
} from '@/lib/regras-volei'
import { caixaDeAviso, caixaDeBloqueio, type Avaliacao, type CaixaRegra } from './explicacao'

export type Troca = { sai: number; entra: number }
export type ModoTroca = 'regular' | 'excepcional' | 'libero'

function converter(resultado: ResultadoRegra, extras: CaixaRegra[] = []): Avaliacao {
  if (!resultado.ok) return { ok: false, caixa: caixaDeBloqueio(resultado.codigo, resultado.mensagem) }
  return { ok: true, avisos: [...extras, ...resultado.avisos.map(caixaDeAviso)] }
}

export function avaliarSubstituicao(estado: EstadoEquipe, troca: Troca, perfil: PerfilRegras): Avaliacao {
  const jaPediu = estado.pedidoNaInterrupcao
  const resultado = validarSubstituicaoRegular({ ...estado, pedidoNaInterrupcao: false }, troca, perfil)
  const extras = jaPediu && resultado.ok
    ? [caixaDeAviso({ codigo: 'RG-SUB-007', mensagem: 'Já houve um pedido de substituição nesta interrupção, sem rally concluído. Vale se for o mesmo pedido (vários atletas); caso contrário, confirme com o árbitro.' })]
    : []
  return converter(resultado, extras)
}

export function avaliarExcepcional(estado: EstadoEquipe, troca: Troca, motivo: MotivoExcepcional, perfil: PerfilRegras): Avaliacao {
  return converter(validarSubstituicaoExcepcional({ ...estado, pedidoNaInterrupcao: false }, { ...troca, motivo }, perfil))
}

export function avaliarTrocaLibero(estado: EstadoEquipe, troca: Troca): Avaliacao {
  return converter(validarTrocaLibero(estado, { sai: troca.sai, entra: troca.entra }, { momento: 'BOLA_FORA' }))
}

export function avaliarRedesignacao(estado: EstadoEquipe, liberoIncapaz: number, novoLibero: number): Avaliacao {
  return converter(validarRedesignacaoLibero(estado, { liberoIncapaz, novoLibero, motivo: 'INCAPAZ' }))
}

/** Texto do contador de cada modo (o de substituição regular é "Troca X de N"). */
export function contadorDoModo(modo: ModoTroca, estado: EstadoEquipe, perfil: PerfilRegras): string {
  if (modo === 'regular') {
    const total = perfil.limiteSubstituicoesPorSet
    const feitas = estado.regulares
    return feitas >= total ? `${feitas} de ${total} trocas usadas neste set.` : `Troca ${feitas + 1} de ${total}`
  }
  if (modo === 'excepcional') {
    return `Troca excepcional ${estado.excepcionais + 1} do set (contador próprio, fora do limite de ${perfil.limiteSubstituicoesPorSet}).`
  }
  return 'Troca de líbero: não conta nas substituições.'
}

/** Quem pode aparecer na lista de cada modo (a avaliação explica quem está bloqueado). */
export function candidatosDoModo(modo: ModoTroca, estado: EstadoEquipe, sai: number): number[] {
  const foraDeQuadra = estado.elenco.filter((j) => !estado.emQuadra.includes(j))
  if (modo === 'libero') {
    const saiEhLibero = estado.liberos.includes(sai)
    return foraDeQuadra.filter((j) => (saiEhLibero ? j === estado.substituidoPorLibero || estado.liberos.includes(j) : estado.liberos.includes(j)))
  }
  const semLiberos = foraDeQuadra.filter((j) => !estado.liberos.includes(j) && !estado.liberosIncapazes.includes(j))
  return semLiberos
}

/** Resumo: líbero não conta como substituição; excepcional aparece à parte. */
export function resumoDeTrocas(tipos: ReadonlyArray<string>) {
  return {
    substituicoes: tipos.filter((t) => t === 'substitution').length,
    excepcionais: tipos.filter((t) => t === 'injury_substitution').length,
    trocasDeLibero: tipos.filter((t) => t === 'libero_exchange').length,
  }
}
