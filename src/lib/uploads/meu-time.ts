// Uploads do Meu Time (R17): escudo do time, foto de rosto e documento do atleta, sempre por URL assinada do Storage.
// O servidor decide tudo: tipo MIME, tamanho, extensão, dono do arquivo e o CAMINHO (uuid gerado aqui, o nome
// enviado pelo cliente só serve para conferir a extensão e nunca entra no caminho). O caminho só é gravado na
// coluna depois que o objeto existe no Storage com tamanho e MIME reais dentro do limite (rota "confirmar").
import { randomUUID } from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { EXTENSAO_POR_MIME, MIMES_DOCUMENTO, MIMES_IMAGEM } from '@/lib/uploads/config'

const MB = 1024 * 1024

export const TIPOS_UPLOAD_MEU_TIME = ['ESCUDO', 'FOTO_ROSTO', 'DOCUMENTO'] as const
export type TipoUploadMeuTime = (typeof TIPOS_UPLOAD_MEU_TIME)[number]

export type ConfigUploadMeuTime = {
  bucket: string
  mimes: readonly string[]
  maxBytes: number
  /** Dono do arquivo: a equipe (escudo) ou o atleta (foto e documento). */
  alvo: 'time' | 'atleta'
  publico: boolean
}

export const CONFIG_MEU_TIME: Record<TipoUploadMeuTime, ConfigUploadMeuTime> = {
  ESCUDO: { bucket: 'time-escudo', mimes: MIMES_IMAGEM, maxBytes: 2 * MB, alvo: 'time', publico: true },
  FOTO_ROSTO: { bucket: 'atleta-foto-rosto', mimes: MIMES_IMAGEM, maxBytes: 2 * MB, alvo: 'atleta', publico: true },
  DOCUMENTO: { bucket: 'atleta-documento', mimes: MIMES_DOCUMENTO, maxBytes: 5 * MB, alvo: 'atleta', publico: false },
}

/** Validade da URL assinada de LEITURA do documento do atleta, em segundos. */
export const VALIDADE_LEITURA_DOCUMENTO_SEGUNDOS = 60
/** A URL assinada de envio do Storage vale 2 horas. */
export const VALIDADE_ENVIO_SEGUNDOS = 2 * 60 * 60

const EXTENSOES_POR_MIME: Record<string, string[]> = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
  'application/pdf': ['pdf'],
}

export type ResultadoValidacaoMeuTime =
  | { ok: true; config: ConfigUploadMeuTime; extensao: string }
  | { ok: false; status: 413 | 415 | 422; erro: string }

/**
 * Valida MIME, tamanho e extensão declarados. O nome do arquivo só é usado para conferir que a extensão
 * combina com o MIME (não aceita .exe com image/png); o caminho nunca usa o nome.
 */
export function validarEnvioMeuTime(entrada: { tipo: TipoUploadMeuTime; nomeArquivo: unknown; contentType: unknown; tamanho: unknown }): ResultadoValidacaoMeuTime {
  const config = CONFIG_MEU_TIME[entrada.tipo]
  const mime = typeof entrada.contentType === 'string' ? entrada.contentType.trim().toLowerCase() : ''
  if (!mime || !config.mimes.includes(mime) || !EXTENSAO_POR_MIME[mime]) {
    return { ok: false, status: 415, erro: 'Tipo de arquivo não permitido para este envio.' }
  }
  const tamanho = Number(entrada.tamanho)
  if (!Number.isInteger(tamanho) || tamanho <= 0) {
    return { ok: false, status: 422, erro: 'Informe o tamanho do arquivo em bytes.' }
  }
  if (tamanho > config.maxBytes) {
    return { ok: false, status: 413, erro: `Arquivo acima de ${Math.floor(config.maxBytes / MB)} MB.` }
  }
  const nome = typeof entrada.nomeArquivo === 'string' ? entrada.nomeArquivo.trim() : ''
  // eslint-disable-next-line no-control-regex
  if (!nome || nome.length > 200 || /[\u0000-\u001f\\/]/.test(nome)) {
    return { ok: false, status: 422, erro: 'Nome de arquivo inválido.' }
  }
  const partes = nome.split('.')
  const extensaoDoNome = partes.length > 1 ? partes[partes.length - 1].toLowerCase() : ''
  if (!extensaoDoNome || !EXTENSOES_POR_MIME[mime].includes(extensaoDoNome)) {
    return { ok: false, status: 415, erro: 'A extensão do arquivo não confere com o tipo informado.' }
  }
  return { ok: true, config, extensao: EXTENSAO_POR_MIME[mime] }
}

/** Caminho gerado no servidor: <donoId>/<uuid>.<ext>. Dentro do bucket do tipo; o dono vem do banco, nunca do cliente. */
export function montarCaminhoMeuTime(donoId: string, extensao: string, id: string = randomUUID()) {
  return `${donoId}/${id}.${extensao}`
}

const UUID_MINUSCULO = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'

/** O caminho recebido do cliente na confirmação precisa ser EXATAMENTE <donoId>/<uuid>.<ext> do dono resolvido no servidor. */
export function caminhoPertenceAoDono(caminho: unknown, donoId: string): caminho is string {
  if (typeof caminho !== 'string' || caminho.length > 200) return false
  if (!/^[0-9a-f-]{36}$/i.test(donoId)) return false
  return new RegExp(`^${donoId.toLowerCase()}/${UUID_MINUSCULO}\\.(?:jpg|png|webp|pdf)$`).test(caminho)
}

/** Extensão do caminho coerente com o tipo (documento aceita pdf; imagem não). */
export function extensaoDoCaminhoPermitida(tipo: TipoUploadMeuTime, caminho: string) {
  const extensao = caminho.slice(caminho.lastIndexOf('.') + 1)
  return CONFIG_MEU_TIME[tipo].mimes.some((mime) => EXTENSAO_POR_MIME[mime] === extensao)
}

export function urlPublicaMeuTime(tipo: TipoUploadMeuTime, caminho: string, urlBase: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL) {
  const config = CONFIG_MEU_TIME[tipo]
  if (!config.publico || !urlBase) return null
  try {
    return `${new URL(urlBase).origin}/storage/v1/object/public/${config.bucket}/${caminho}`
  } catch {
    return null
  }
}

export type EnvioAssinadoMeuTime = { uploadUrl: string; path: string; expiraEm: string }

export class ErroStorageMeuTime extends Error {
  constructor(readonly bucketAusente: boolean) {
    super(bucketAusente ? 'bucket ausente' : 'falha no storage')
    Object.setPrototypeOf(this, ErroStorageMeuTime.prototype)
  }
}

function bucketNaoExiste(erro: { message?: string } | null | undefined) {
  return /bucket not found/i.test(String(erro?.message ?? ''))
}

export async function assinarEnvioMeuTime(tipo: TipoUploadMeuTime, caminho: string): Promise<EnvioAssinadoMeuTime> {
  const { data, error } = await supabaseAdmin.storage.from(CONFIG_MEU_TIME[tipo].bucket).createSignedUploadUrl(caminho)
  if (error || !data?.signedUrl) throw new ErroStorageMeuTime(bucketNaoExiste(error))
  return { uploadUrl: data.signedUrl, path: caminho, expiraEm: new Date(Date.now() + VALIDADE_ENVIO_SEGUNDOS * 1000).toISOString() }
}

export type ObjetoReal = { tamanho: number; mime: string }

/** Tamanho e MIME REAIS do objeto no Storage, ou null se ele não existe. */
export async function lerObjetoReal(tipo: TipoUploadMeuTime, caminho: string): Promise<ObjetoReal | null> {
  const { data, error } = await supabaseAdmin.storage.from(CONFIG_MEU_TIME[tipo].bucket).info(caminho)
  if (error || !data) {
    if (error && /bucket not found/i.test(String(error.message ?? ''))) throw new ErroStorageMeuTime(true)
    if (error && !/not found|does not exist|404/i.test(String(error.message ?? ''))) throw new ErroStorageMeuTime(false)
    return null
  }
  const bruto = data as unknown as { size?: number; contentType?: string; metadata?: { size?: number; mimetype?: string } }
  const tamanho = Number(bruto.size ?? bruto.metadata?.size ?? 0)
  const mime = String(bruto.contentType ?? bruto.metadata?.mimetype ?? '').toLowerCase()
  return { tamanho, mime }
}

export type ConferenciaObjeto = { ok: true } | { ok: false; status: 413 | 415 | 422; erro: string }

/** O objeto real precisa respeitar o limite e a lista de MIME do tipo, e a extensão do caminho tem de bater com o MIME real. */
export function conferirObjetoReal(tipo: TipoUploadMeuTime, caminho: string, real: ObjetoReal): ConferenciaObjeto {
  const config = CONFIG_MEU_TIME[tipo]
  if (!config.mimes.includes(real.mime)) return { ok: false, status: 415, erro: 'O arquivo enviado não é de um tipo permitido.' }
  if (real.tamanho <= 0) return { ok: false, status: 422, erro: 'O arquivo enviado está vazio.' }
  if (real.tamanho > config.maxBytes) return { ok: false, status: 413, erro: `O arquivo enviado passa de ${Math.floor(config.maxBytes / MB)} MB.` }
  if (EXTENSAO_POR_MIME[real.mime] !== caminho.slice(caminho.lastIndexOf('.') + 1)) {
    return { ok: false, status: 415, erro: 'O arquivo enviado não confere com o tipo declarado.' }
  }
  return { ok: true }
}

export async function removerObjeto(tipo: TipoUploadMeuTime, caminho: string) {
  try {
    await supabaseAdmin.storage.from(CONFIG_MEU_TIME[tipo].bucket).remove([caminho])
  } catch {
    console.error('[uploads] não foi possível remover objeto do storage', tipo)
  }
}

export async function assinarLeituraDocumento(caminho: string) {
  const { data, error } = await supabaseAdmin.storage
    .from(CONFIG_MEU_TIME.DOCUMENTO.bucket)
    .createSignedUrl(caminho, VALIDADE_LEITURA_DOCUMENTO_SEGUNDOS)
  if (error || !data?.signedUrl) {
    if (bucketNaoExiste(error)) throw new ErroStorageMeuTime(true)
    return null
  }
  return { url: data.signedUrl, expiraEm: new Date(Date.now() + VALIDADE_LEITURA_DOCUMENTO_SEGUNDOS * 1000).toISOString() }
}
