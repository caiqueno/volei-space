// Máscaras e validação de dígitos só para retorno rápido. O servidor valida tudo de novo.

export function soDigitos(valor: string): string {
  return valor.replace(/\D/g, '')
}

export function formatarCpf(valor: string): string {
  const d = soDigitos(valor).slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}


/** Telefone brasileiro com DDD: (11) 98765-4321 ou (11) 3456-7890. */
export function formatarTelefone(valor: string): string {
  const d = soDigitos(valor).slice(0, 11)
  if (d.length === 0) return ''
  if (d.length <= 2) return `(${d}`
  const ddd = d.slice(0, 2)
  const resto = d.slice(2)
  if (resto.length <= 4) return `(${ddd}) ${resto}`
  if (d.length <= 10) return `(${ddd}) ${resto.slice(0, 4)}-${resto.slice(4)}`
  return `(${ddd}) ${resto.slice(0, 5)}-${resto.slice(5)}`
}

export function telefoneValido(valor: string): boolean {
  const d = soDigitos(valor)
  if (d.length !== 10 && d.length !== 11) return false
  if (/^(\d)\1+$/.test(d)) return false
  if (Number(d.slice(0, 2)) < 11) return false
  return d.length === 10 || d[2] === '9'
}

function digitoCpf(base: string, pesoInicial: number): number {
  let soma = 0
  for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (pesoInicial - i)
  const resto = (soma * 10) % 11
  return resto === 10 ? 0 : resto
}

export function cpfValido(valor: string): boolean {
  const d = soDigitos(valor)
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false
  return digitoCpf(d.slice(0, 9), 10) === Number(d[9]) && digitoCpf(d.slice(0, 10), 11) === Number(d[10])
}



export function emailValido(valor: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(valor.trim()) && valor.trim().length <= 254
}

/** Uma máscara vinda do servidor (ex.: '***.***.***-12') nunca vai de volta como valor novo. */
export function pareceMascara(valor: string | null | undefined): boolean {
  return typeof valor === 'string' && valor.includes('*')
}

export const TIPOS_DOCUMENTO = [
  { valor: 'RG', rotulo: 'RG' },
  { valor: 'CNH', rotulo: 'CNH' },
  { valor: 'CERTIDAO', rotulo: 'Certidão de nascimento' },
  { valor: 'PASSAPORTE', rotulo: 'Passaporte' },
  { valor: 'OUTRO', rotulo: 'Outro' },
] as const
export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number]['valor']

export type EntradaContatoAtleta = {
  /** Só o que a pessoa digitou agora. Vazio = não alterar. */
  cpf: string
  documentoTipo: string
  documentoNumero: string
  telefone: string
  telefoneEmergencia: string
}

export type CampoContatoAtleta = keyof EntradaContatoAtleta
export type DadosContatoAtleta = {
  cpf?: string
  documentoTipo?: string
  documentoNumero?: string
  telefone?: string
  telefoneEmergencia?: string
}

/** Valida só o que foi digitado. Campo vazio fica fora do corpo (não apaga nem altera o que já está salvo). */
export function validarContatoAtleta(entrada: EntradaContatoAtleta): { valido: boolean; erros: Partial<Record<CampoContatoAtleta, string>>; dados: DadosContatoAtleta } {
  const erros: Partial<Record<CampoContatoAtleta, string>> = {}
  const dados: DadosContatoAtleta = {}
  const cpf = soDigitos(entrada.cpf)
  if (cpf) {
    if (!cpfValido(cpf)) erros.cpf = 'Esse CPF não parece certo. Confira os 11 números.'
    else dados.cpf = cpf
  }
  const numero = entrada.documentoNumero.replace(/\s+/g, ' ').trim()
  if (numero) {
    if (numero.length < 3 || numero.length > 30) erros.documentoNumero = 'Confira o número do documento.'
    else dados.documentoNumero = numero
  }
  if (entrada.documentoTipo) {
    if (!TIPOS_DOCUMENTO.some((t) => t.valor === entrada.documentoTipo)) erros.documentoTipo = 'Escolha o tipo do documento na lista.'
    else dados.documentoTipo = entrada.documentoTipo
  }
  if (numero && !entrada.documentoTipo) erros.documentoTipo = 'Diga que tipo de documento é esse.'
  for (const campo of ['telefone', 'telefoneEmergencia'] as const) {
    const t = soDigitos(entrada[campo])
    if (!t) continue
    if (!telefoneValido(t)) erros[campo] = 'Confira o telefone com DDD. Exemplo: (11) 91234-5678.'
    else dados[campo] = t
  }
  return { valido: Object.keys(erros).length === 0, erros, dados }
}
