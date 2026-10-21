// Flag da interface do elenco completo (foto, documento, CPF, contato, pedido de troca). Desligada = telas atuais idênticas.
export function elencoCompletoAtivo(valor: string | undefined = process.env.NEXT_PUBLIC_ELENCO_COMPLETO_ATIVO): boolean {
  return valor === '1'
}
