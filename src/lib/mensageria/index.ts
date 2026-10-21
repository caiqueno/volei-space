/**
 * Envio de código de acesso. A interface é única; cada canal tem um adaptador.
 * Nunca registre o código nem o destino completo em log.
 */
export type CanalCodigo = 'EMAIL' | 'WHATSAPP'

export type EnvioCodigo = { canal: CanalCodigo; destino: string; codigo: string }

export type EnviarCodigo = (envio: EnvioCodigo) => Promise<void>

export const MENSAGEM_RECURSO_DESLIGADO = 'Recurso ainda não habilitado neste ambiente.'

export class CanalIndisponivelError extends Error {
  constructor(canal: CanalCodigo) {
    super(`Canal ${canal} não configurado.`)
    this.name = 'CanalIndisponivelError'
  }
}

/** Mascara o destino para log: a***@dominio.com ou ****1234. */
export function mascararDestino(destino: string) {
  const texto = String(destino ?? '')
  const arroba = texto.indexOf('@')
  if (arroba > 0) return `${texto[0]}***${texto.slice(arroba)}`
  const digitos = texto.replace(/\D/g, '')
  return digitos.length > 4 ? `****${digitos.slice(-4)}` : '****'
}

export function textoDoCodigo(codigo: string) {
  return `Seu código de acesso ao volei.space é ${codigo}. Vale por 10 minutos e só pode ser usado uma vez. Não compartilhe.`
}

function consoleDeDesenvolvimento() {
  return process.env.NODE_ENV !== 'production' && process.env.LOGIN_CODIGO_DEV_CONSOLE === '1'
}

export function emailConfigurado() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
}

export function whatsappConfigurado() {
  return Boolean(process.env.WHATSAPP_WEBHOOK_URL)
}

export async function enviarPorEmail({ destino, codigo }: EnvioCodigo) {
  const { sendEmail } = await import('@/lib/email')
  await sendEmail({
    to: destino,
    subject: 'Seu código de acesso - volei.space',
    html: `<p>${textoDoCodigo(codigo)}</p>`,
  })
}

export async function enviarPorWhatsapp({ destino, codigo }: EnvioCodigo, buscar: typeof fetch = fetch) {
  const url = process.env.WHATSAPP_WEBHOOK_URL
  if (!url) throw new CanalIndisponivelError('WHATSAPP')
  const token = process.env.WHATSAPP_WEBHOOK_TOKEN
  const resposta = await buscar(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ to: destino, text: textoDoCodigo(codigo) }),
    cache: 'no-store',
  })
  if (!resposta.ok) throw new Error(`Webhook de WhatsApp respondeu ${resposta.status}.`)
}

/** Envio padrão: console só em desenvolvimento com a flag; senão o adaptador do canal. */
export const enviarCodigo: EnviarCodigo = async (envio) => {
  if (consoleDeDesenvolvimento()) {
    console.info(`[codigo-dev] ${envio.canal} ${mascararDestino(envio.destino)} codigo=${envio.codigo}`)
    return
  }
  if (envio.canal === 'EMAIL') {
    if (!emailConfigurado()) throw new CanalIndisponivelError('EMAIL')
    return enviarPorEmail(envio)
  }
  return enviarPorWhatsapp(envio)
}
