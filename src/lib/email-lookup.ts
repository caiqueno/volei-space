// ILIKE trata % e _ como curinga. E-mail com underscore não pode casar outra conta.
export function padraoIlikeLiteral(valor: string) {
  return valor.replace(/[\\%_]/g, (caractere) => `\\${caractere}`)
}

export function emailsConferem(esperado: string, recebido: unknown) {
  if (typeof recebido !== 'string') return false
  return recebido.trim().toLowerCase() === esperado.trim().toLowerCase()
}
