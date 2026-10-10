/**
 * Tempo médico e substituição por lesão. Só existem quando a opção está true.
 * Sem ela, a súmula não ganha botão e a lesão não fura o limite de substituições.
 */
export function textoTempoMedico(equipe: string) {
  return `Tempo médico solicitado por ${equipe}.`
}

export function textoSubstituicaoLesao(equipe: string, saiu: string, nomeSaiu: string, entrou: string, nomeEntrou: string) {
  return `Substituição por lesão ${equipe}: sai #${saiu} ${nomeSaiu}, entra #${entrou} ${nomeEntrou}.`
}

export function colunaDeLesaoAusente(erro: { message?: string; code?: string; details?: string } | null | undefined) {
  const texto = `${erro?.code ?? ''} ${erro?.message ?? ''} ${erro?.details ?? ''}`
  return /tempoMedico|substituicaoPorLesao/i.test(texto)
}

export function semLesao<T extends Record<string, unknown>>(patch: T): T {
  const saida = { ...patch }
  delete saida.tempoMedico
  delete saida.substituicaoPorLesao
  return saida
}

export function soLesao(patch: Record<string, unknown>) {
  const saida: Record<string, unknown> = {}
  if (Object.prototype.hasOwnProperty.call(patch, 'tempoMedico')) saida.tempoMedico = patch.tempoMedico === true
  if (Object.prototype.hasOwnProperty.call(patch, 'substituicaoPorLesao')) saida.substituicaoPorLesao = patch.substituicaoPorLesao === true
  return saida
}
