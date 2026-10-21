// Validação, normalização, máscara e hash de CPF, CNPJ, telefone e número de documento (R17).
// Funções puras (sem banco). O valor em claro só existe aqui dentro do processamento da requisição:
// o banco recebe o valor CIFRADO (cifrarContato) e um hash HMAC com sal do servidor (para achar duplicidade).
// As leituras devolvem SÓ a máscara; nenhuma rota devolve CPF, documento ou telefone em claro.
import { createHmac } from 'node:crypto'
import { ErroMeuTime } from '@/lib/meu-time/acesso'
import { decifrarContato } from '@/lib/lgpd/cifra'

export const DOCUMENTO_TIPOS = ['RG', 'CNH', 'PASSAPORTE', 'CERTIDAO_NASCIMENTO', 'OUTRO'] as const
export type DocumentoTipo = (typeof DOCUMENTO_TIPOS)[number]

export function soDigitos(valor: string) {
  return valor.replace(/\D/g, '')
}

function digitoVerificador(digitos: number[], pesos: number[]) {
  const soma = digitos.reduce((acc, digito, indice) => acc + digito * pesos[indice], 0)
  const resto = soma % 11
  return resto < 2 ? 0 : 11 - resto
}

/** CPF com dígitos verificadores. Aceita pontuação; recusa sequências repetidas (111.111.111-11). */
export function cpfValido(valor: string) {
  const digitos = soDigitos(valor)
  if (digitos.length !== 11 || /^(\d)\1{10}$/.test(digitos)) return false
  const numeros = digitos.split('').map(Number)
  const d1 = digitoVerificador(numeros.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2])
  const d2 = digitoVerificador(numeros.slice(0, 10), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2])
  return numeros[9] === d1 && numeros[10] === d2
}

/** CNPJ numérico com dígitos verificadores. */
export function cnpjValido(valor: string) {
  const digitos = soDigitos(valor)
  if (digitos.length !== 14 || /^(\d)\1{13}$/.test(digitos)) return false
  const numeros = digitos.split('').map(Number)
  const d1 = digitoVerificador(numeros.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  const d2 = digitoVerificador(numeros.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  return numeros[12] === d1 && numeros[13] === d2
}

/** Máscara de CPF: nunca mostra mais que os 2 últimos dígitos. */
export function mascararCpf(valor: string | null | undefined) {
  const digitos = soDigitos(String(valor ?? ''))
  if (digitos.length !== 11) return null
  return `***.***.***-${digitos.slice(9)}`
}

/**
 * Telefone brasileiro: aceita +55, DDD e 8 ou 9 dígitos. Devolve só dígitos com DDD (10 ou 11), ou null se inválido.
 * Celular (11 dígitos) precisa começar com 9 depois do DDD.
 */
export function normalizarTelefone(valor: string): string | null {
  let digitos = soDigitos(valor)
  if (digitos.length > 11 && digitos.startsWith('55')) digitos = digitos.slice(2)
  if (digitos.length !== 10 && digitos.length !== 11) return null
  const ddd = Number(digitos.slice(0, 2))
  if (ddd < 11 || ddd > 99 || digitos[0] === '0') return null
  if (digitos.length === 11 && digitos[2] !== '9') return null
  return digitos
}

/** '(11) *****-5678'. Mostra só o DDD e os 4 últimos dígitos. */
export function mascararTelefone(valor: string | null | undefined) {
  const digitos = soDigitos(String(valor ?? ''))
  if (digitos.length !== 10 && digitos.length !== 11) return null
  const meio = '*'.repeat(digitos.length - 6)
  return `(${digitos.slice(0, 2)}) ${meio}-${digitos.slice(-4)}`
}

/** Número de documento (RG, CNH...): letras e dígitos, 3 a 30 caracteres, em maiúsculas e sem pontuação. */
export function normalizarDocumentoNumero(valor: string): string | null {
  const limpo = valor.replace(/[\s.\-\/]/g, '').toUpperCase()
  return /^[A-Z0-9]{3,30}$/.test(limpo) ? limpo : null
}

/** '******1234': só os 2 últimos caracteres do documento. */
export function mascararDocumentoNumero(valor: string | null | undefined) {
  const limpo = String(valor ?? '')
  if (limpo.length < 3) return null
  return `${'*'.repeat(Math.max(limpo.length - 2, 4))}${limpo.slice(-2)}`
}

export function formatarCnpj(digitos: string) {
  return digitos.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}

/**
 * Sal (pepper) do hash. LGPD_PEPPER_HASH, ou derivado de LGPD_CHAVE_CIFRA quando a primeira não existe.
 * Fail-closed: sem nenhuma das duas a rota recusa gravar (nunca se grava hash sem sal).
 */
function pepper(): Buffer {
  const dedicado = process.env.LGPD_PEPPER_HASH ?? ''
  if (dedicado.length >= 16) return Buffer.from(dedicado, 'utf8')
  const chave = Buffer.from(process.env.LGPD_CHAVE_CIFRA ?? '', 'base64')
  if (chave.length === 32) return createHmac('sha256', chave).update('volei.space/hash-identidade/v1').digest()
  console.error('[lgpd] sal do hash ausente (LGPD_PEPPER_HASH ou LGPD_CHAVE_CIFRA)')
  throw new ErroMeuTime('O registro de dados pessoais não está disponível neste ambiente.', 503, 'LGPD_CIFRA_INDISPONIVEL')
}

/** HMAC-SHA256 em hex do CPF (só dígitos). Serve para detectar duplicidade; não é reversível sem o sal. */
export function hashCpf(cpf: string) {
  return createHmac('sha256', pepper()).update(`cpf:${soDigitos(cpf)}`).digest('hex')
}

/** HMAC do par (tipo, número) do documento, para a unicidade de (documentoTipo, documentoHash). */
export function hashDocumento(tipo: string, numeroNormalizado: string) {
  return createHmac('sha256', pepper()).update(`doc:${tipo}:${numeroNormalizado}`).digest('hex')
}

/**
 * Máscara a partir do valor CIFRADO gravado (bytea em hex). Qualquer falha (chave ausente, formato) devolve null:
 * ler a ficha nunca derruba a tela por causa da chave.
 */
export function mascararCifrado(cifrado: unknown, mascarar: (claro: string) => string | null): string | null {
  if (typeof cifrado !== 'string' || !cifrado) return null
  try {
    return mascarar(decifrarContato(cifrado))
  } catch {
    return null
  }
}
