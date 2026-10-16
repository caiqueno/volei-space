import { createHmac } from 'crypto'
import { SignJWT, jwtVerify } from 'jose'
import { TOKEN_AUD, TOKEN_TYP, type TokenKind } from '@/lib/token-claims'

export type SecretPurpose = 'session' | 'password-reset' | 'account-activation'

const PURPOSE_POR_KIND: Record<TokenKind, SecretPurpose> = {
  admin: 'session',
  public: 'session',
  reset: 'password-reset',
  activation: 'account-activation',
}

const TAMANHO_MINIMO_SEGREDO = 32
let avisouSegredoFraco = false

function segredoBase() {
  const valor = process.env.JWT_SECRET
  if (!valor) throw new Error('JWT_SECRET not set')
  if (valor.length < TAMANHO_MINIMO_SEGREDO && !avisouSegredoFraco) {
    avisouSegredoFraco = true
    console.warn(`[auth] JWT_SECRET com menos de ${TAMANHO_MINIMO_SEGREDO} caracteres. Use um segredo longo e aleatório.`)
  }
  return valor
}

/**
 * Chave de assinatura derivada por finalidade: HMAC-SHA256(JWT_SECRET, purpose).
 * Um token de sessão não valida como token de recuperação nem de ativação.
 */
export function getSecret(purpose: SecretPurpose): Uint8Array {
  const derivada = createHmac('sha256', segredoBase()).update(`volei-jwt-v1\0${purpose}`).digest()
  return new Uint8Array(derivada)
}

export async function assinarToken(payload: Record<string, unknown>, kind: TokenKind, expiraEm: string) {
  const aud = TOKEN_AUD[kind]
  const typ = TOKEN_TYP[kind]
  return new SignJWT({ ...payload, typ })
    .setProtectedHeader({ alg: 'HS256', typ })
    .setAudience(aud)
    .setIssuedAt()
    .setExpirationTime(expiraEm)
    .sign(getSecret(PURPOSE_POR_KIND[kind]))
}

export async function lerToken<T extends Record<string, unknown>>(token: string, kind: TokenKind): Promise<T | null> {
  try {
    const aud = TOKEN_AUD[kind]
    const typ = TOKEN_TYP[kind]
    const { payload, protectedHeader } = await jwtVerify(token, getSecret(PURPOSE_POR_KIND[kind]), {
      audience: aud,
      algorithms: ['HS256'],
    })
    if (payload.typ !== typ || protectedHeader.typ !== typ) return null
    return payload as unknown as T
  } catch {
    return null
  }
}
