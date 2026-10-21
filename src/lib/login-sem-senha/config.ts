import { createHash, randomBytes, randomInt, scryptSync, timingSafeEqual } from 'crypto'

export const CODIGO_VALIDADE_MS = 10 * 60 * 1000
export const CODIGO_MAX_TENTATIVAS = 5
export const JANELA_LIMITE_MS = 15 * 60 * 1000

export const MENSAGEM_RECURSO_NAO_HABILITADO = 'Recurso ainda não habilitado neste ambiente.'

export function loginSemSenhaAtivo(env: Record<string, string | undefined> = process.env) {
  return env.LOGIN_SEM_SENHA_ATIVO === '1'
}

export function normalizarEmail(email: string) {
  return String(email ?? '').trim().toLowerCase()
}

export function emailValido(email: string) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

/** Dígitos do telefone sem DDI 55; usado para conferir com o cadastro. */
export function normalizarTelefone(valor: unknown) {
  const digitos = String(valor ?? '').replace(/\D/g, '')
  if (digitos.length > 11 && digitos.startsWith('55')) return digitos.slice(2)
  return digitos
}

export function telefoneValido(valor: string) {
  const d = normalizarTelefone(valor)
  return d.length === 10 || d.length === 11
}

/** Resumo irreversível para chaves de limite e colunas de auditoria (não guarda dado pessoal em claro). */
export function resumo(valor: string) {
  return createHash('sha256').update(`volei-codigo-v1\0${valor}`).digest('hex').slice(0, 32)
}

export function gerarCodigo() {
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}

const SCRYPT = { N: 16384, r: 8, p: 1 }

/** Formato "sal:hash" (hex). O código em claro nunca é guardado. */
export function hashDoCodigo(codigo: string, emailNormalizado: string, sal = randomBytes(16).toString('hex')) {
  const derivado = scryptSync(`${emailNormalizado}\0${codigo}`, sal, 32, SCRYPT).toString('hex')
  return `${sal}:${derivado}`
}

export function conferirCodigo(codigo: string, emailNormalizado: string, guardado: string) {
  const [sal, esperado] = String(guardado ?? '').split(':')
  if (!sal || !esperado || !/^[0-9a-f]+$/.test(esperado)) return false
  const calculado = scryptSync(`${emailNormalizado}\0${codigo}`, sal, 32, SCRYPT)
  const alvo = Buffer.from(esperado, 'hex')
  return alvo.length === calculado.length && timingSafeEqual(calculado, alvo)
}

/** Faz o mesmo trabalho de uma conferência quando não há código para comparar. */
export function conferenciaFalsa(codigo: string, emailNormalizado: string) {
  conferirCodigo(codigo, emailNormalizado, 'a'.repeat(32) + ':' + 'b'.repeat(64))
}

export function tabelaAusente(erro: unknown) {
  const e = erro as { code?: string; message?: string } | null
  if (!e) return false
  if (e.code === '42P01' || e.code === 'PGRST205') return true
  return /does not exist|schema cache|could not find the table/i.test(String(e.message ?? ''))
}

export class RecursoNaoHabilitadoError extends Error {
  constructor() {
    super(MENSAGEM_RECURSO_NAO_HABILITADO)
    this.name = 'RecursoNaoHabilitadoError'
  }
}

/** Lança RecursoNaoHabilitadoError se a tabela não existe; outros erros sobem como estão. */
export function verificarErroDeBanco(erro: unknown) {
  if (!erro) return
  if (tabelaAusente(erro)) throw new RecursoNaoHabilitadoError()
  const mensagem = (erro as { message?: string }).message ?? 'erro de banco'
  throw new Error(mensagem)
}

export async function esperarAteMinimo(inicio: number, minimoMs: number, jitterMs = 150) {
  if (minimoMs <= 0) return
  const alvo = minimoMs + (jitterMs > 0 ? randomInt(0, jitterMs) : 0)
  const falta = alvo - (Date.now() - inicio)
  if (falta > 0) await new Promise((r) => setTimeout(r, falta))
}
