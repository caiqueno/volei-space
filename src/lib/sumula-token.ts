import { randomBytes } from 'node:crypto'

export function gerarSumulaToken() {
  return randomBytes(32).toString('base64url')
}

export function sumulaTokenLegadoPrevisivel(token: string) {
  return /^luv-\d+-(?:g\d+-r\d+|[a-z0-9]+-\d+|\d+)-\d+-\d+$/i.test(token)
}
