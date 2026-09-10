import QRCode from 'qrcode'
import { randomUUID } from 'crypto'

export function generateQRToken(): string {
  return randomUUID().replace(/-/g, '')
}

export async function generateQRCodeDataUrl(token: string): Promise<string> {
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/api/jogadores/qr/${token}`
  return QRCode.toDataURL(url, {
    width: 300,
    margin: 2,
    color: { dark: '#0F2C52', light: '#FFFFFF' },
  })
}

export async function generateQRCodeBuffer(token: string): Promise<Buffer> {
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/api/jogadores/qr/${token}`
  return QRCode.toBuffer(url, {
    width: 300,
    margin: 2,
    color: { dark: '#0F2C52', light: '#FFFFFF' },
  })
}
