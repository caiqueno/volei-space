/**
 * App de banco e papeleta (R9): flag, respostas e utilitários comuns.
 * Rotas NOVAS, desligadas por padrão: sem `BANCO_APP_ATIVO=1` respondem 404.
 * Sem as tabelas BancoAcesso/Papeleta/PedidoBanco (migrations pendentes) respondem 503.
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'

export const MENSAGEM_BANCO_INDISPONIVEL = 'Banco ainda não habilitado neste ambiente.'

export function bancoAppAtivo(env: Record<string, string | undefined> = process.env): boolean {
  return env.BANCO_APP_ATIVO === '1'
}

export type ErroBanco = { code?: string; message?: string; details?: string | null } | null | undefined

/** Tabela do app de banco ainda não existe (migration pendente). */
export function tabelaBancoAusente(erro: ErroBanco): boolean {
  if (!erro) return false
  const texto = `${erro.message ?? ''} ${erro.details ?? ''}`
  return (
    erro.code === '42P01' ||
    erro.code === 'PGRST205' ||
    (/BancoAcesso|Papeleta|PedidoBanco/.test(texto) && /does not exist|schema cache|Could not find the table/i.test(texto))
  )
}

export function violacaoDeUnicidade(erro: ErroBanco): boolean {
  return erro?.code === '23505'
}

export function respostaErro(mensagem: string, status: number, codigo?: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error: mensagem, ...(codigo ? { codigo } : {}), ...extra }, { status })
}

export const naoEncontradoBanco = () => respostaErro('Recurso não encontrado.', 404)
export const indisponivelBanco = () => respostaErro(MENSAGEM_BANCO_INDISPONIVEL, 503, 'BANCO_INDISPONIVEL')
export const falhaBanco = (mensagem = 'Não foi possível concluir a operação.') => respostaErro(mensagem, 500)

/** Token opaco de 32 bytes (base64url). Só aparece uma vez; no banco fica o hash. */
export function gerarTokenBanco(): string {
  return randomBytes(32).toString('base64url')
}

export function tokenBancoValido(token: string): boolean {
  return /^[A-Za-z0-9_-]{32,64}$/.test(token)
}

export function hashTokenBanco(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

/** Comparação em tempo constante de dois hashes hexadecimais. */
export function hashesIguais(a: unknown, b: unknown): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  const x = Buffer.from(a, 'utf8')
  const y = Buffer.from(b, 'utf8')
  if (x.length !== y.length) return false
  return timingSafeEqual(x, y)
}

export function inteiroPositivo(valor: unknown): number | null {
  const n = typeof valor === 'string' && /^\d+$/.test(valor) ? Number(valor) : valor
  return typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : null
}

/** Hash estável do conteúdo da papeleta (chaves em ordem fixa). */
export function hashConteudo(conteudo: unknown): string {
  return createHash('sha256').update(JSON.stringify(conteudo), 'utf8').digest('hex')
}
