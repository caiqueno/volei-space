import { SignJWT, jwtVerify } from 'jose'
import { TOKEN_AUD, TOKEN_TYP, type TokenKind } from '@/lib/token-claims'

function segredo() {
  const valor = process.env.JWT_SECRET
  if (!valor) throw new Error('JWT_SECRET not set')
  return new TextEncoder().encode(valor)
}

export async function assinarToken(payload: Record<string, unknown>, kind: TokenKind, expiraEm: string) {
  const aud = TOKEN_AUD[kind]
  const typ = TOKEN_TYP[kind]
  return new SignJWT({ ...payload, typ })
    .setProtectedHeader({ alg: 'HS256', typ })
    .setAudience(aud)
    .setIssuedAt()
    .setExpirationTime(expiraEm)
    .sign(segredo())
}

export async function lerToken<T extends Record<string, unknown>>(token: string, kind: TokenKind): Promise<T | null> {
  try {
    const aud = TOKEN_AUD[kind]
    const typ = TOKEN_TYP[kind]
    const { payload, protectedHeader } = await jwtVerify(token, segredo(), {
      audience: aud,
      algorithms: ['HS256'],
    })
    if (payload.typ !== typ || protectedHeader.typ !== typ) return null
    return payload as unknown as T
  } catch {
    return null
  }
}
