// Cifra do contato do responsável legal (AES-256-GCM). A chave fica FORA do banco, na variável de ambiente
// LGPD_CHAVE_CIFRA (32 bytes em base64). Sem chave válida a rota recusa gravar (fail-closed): nunca se grava
// contato em texto claro. Formato do valor: 0x01 | iv(12) | tag(16) | texto cifrado, enviado ao bytea em hex.
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { ErroMeuTime } from '@/lib/meu-time/acesso'

const VERSAO_FORMATO = 1
export const VERSAO_CHAVE = 1

function chave(): Buffer {
  const bruta = process.env.LGPD_CHAVE_CIFRA ?? ''
  const buffer = Buffer.from(bruta, 'base64')
  if (buffer.length !== 32) {
    console.error('[lgpd] LGPD_CHAVE_CIFRA ausente ou inválida')
    throw new ErroMeuTime('O registro de autorização do responsável não está disponível neste ambiente.', 503, 'LGPD_CIFRA_INDISPONIVEL')
  }
  return buffer
}

/** Devolve a literal `\x...` aceita pelo PostgREST para colunas bytea. */
export function cifrarContato(texto: string): string {
  const iv = randomBytes(12)
  const cifra = createCipheriv('aes-256-gcm', chave(), iv)
  const dados = Buffer.concat([cifra.update(texto, 'utf8'), cifra.final()])
  return `\\x${Buffer.concat([Buffer.from([VERSAO_FORMATO]), iv, cifra.getAuthTag(), dados]).toString('hex')}`
}

/** Uso restrito (ex.: atendimento ao titular, fora desta API). Nenhuma rota devolve o resultado. */
export function decifrarContato(valor: string): string {
  const buffer = Buffer.from(valor.replace(/^\\x/, ''), 'hex')
  if (buffer[0] !== VERSAO_FORMATO || buffer.length < 30) throw new Error('formato de cifra desconhecido')
  const decifra = createDecipheriv('aes-256-gcm', chave(), buffer.subarray(1, 13))
  decifra.setAuthTag(buffer.subarray(13, 29))
  return Buffer.concat([decifra.update(buffer.subarray(29)), decifra.final()]).toString('utf8')
}
