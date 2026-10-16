import { EXTENSAO_POR_MIME, TIPOS_UPLOAD, type ConfigUpload, type TipoUpload } from '@/lib/uploads/config'

export type ResultadoValidacaoUpload =
  | { ok: true; config: ConfigUpload; extensao: string }
  | { ok: false; status: 413 | 415 | 422; erro: string }

/**
 * Valida tipo MIME e tamanho declarados. O servidor é quem decide: o limite e a lista
 * de tipos vêm de TIPOS_UPLOAD, nunca do cliente. O tipo vem sempre do MIME, nunca do
 * nome do arquivo (o nome original nem é usado no caminho).
 */
export function validarSolicitacaoUpload(entrada: { tipo: TipoUpload; mime: unknown; tamanho: unknown }): ResultadoValidacaoUpload {
  const config = TIPOS_UPLOAD[entrada.tipo]
  const mime = typeof entrada.mime === 'string' ? entrada.mime.trim().toLowerCase() : ''
  if (!mime || !config.mimes.includes(mime) || !EXTENSAO_POR_MIME[mime]) {
    return { ok: false, status: 415, erro: 'Tipo de arquivo não permitido para este envio.' }
  }
  const tamanho = Number(entrada.tamanho)
  if (!Number.isFinite(tamanho) || !Number.isInteger(tamanho) || tamanho <= 0) {
    return { ok: false, status: 422, erro: 'Informe o tamanho do arquivo em bytes.' }
  }
  if (tamanho > config.maxBytes) {
    return { ok: false, status: 413, erro: `Arquivo acima de ${Math.floor(config.maxBytes / (1024 * 1024))} MB.` }
  }
  return { ok: true, config, extensao: EXTENSAO_POR_MIME[mime] }
}
