import { createHmac, timingSafeEqual } from 'crypto'

function segredo() {
  const valor = process.env.JWT_SECRET
  if (!valor) throw new Error('JWT_SECRET not set')
  return valor
}

export function fingerprintSenha(senhaHash: string) {
  return createHmac('sha256', segredo()).update(`volei-password-reset-v1\0${senhaHash}`).digest('hex')
}

export function fingerprintsConferem(esperado: string, recebido: string) {
  const esquerda = Buffer.from(esperado)
  const direita = Buffer.from(recebido)
  if (esquerda.length === 0 || esquerda.length !== direita.length) return false
  return timingSafeEqual(esquerda, direita)
}
