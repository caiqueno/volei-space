// Tipos de upload aceitos pelas rotas de URL assinada (docs/analise/21-uploads-assinados.md).
// Os limites aqui valem no servidor; os do bucket (file_size_limit e allowed_mime_types,
// migration 202610170004) repetem a mesma regra na hora do envio.

export type TipoUpload = 'atleta-documento' | 'atleta-foto-rosto' | 'equipe-emblema'

export const MIMES_IMAGEM = ['image/jpeg', 'image/png', 'image/webp'] as const
export const MIMES_DOCUMENTO = [...MIMES_IMAGEM, 'application/pdf'] as const

export const EXTENSAO_POR_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
}

export type ConfigUpload = {
  bucket: string
  /** Primeiro segmento do caminho; identifica o tipo ao ler o caminho de volta. */
  pasta: TipoUpload
  mimes: readonly string[]
  maxBytes: number
  /** Bucket privado: leitura só por URL assinada de curta duração. */
  privado: boolean
}

const MB = 1024 * 1024

export const TIPOS_UPLOAD: Record<TipoUpload, ConfigUpload> = {
  // Documento do atleta (RG, CPF, certidão): bucket privado, 8 MB, imagem ou PDF.
  'atleta-documento': { bucket: 'atleta-arquivos', pasta: 'atleta-documento', mimes: MIMES_DOCUMENTO, maxBytes: 8 * MB, privado: true },
  // Foto de rosto: bucket público separado (decisão D5), 4 MB, só imagem.
  'atleta-foto-rosto': { bucket: 'jogador-fotos-rosto', pasta: 'atleta-foto-rosto', mimes: MIMES_IMAGEM, maxBytes: 4 * MB, privado: false },
  // Emblema da equipe: bucket público, 4 MB, só imagem.
  'equipe-emblema': { bucket: 'equipe-emblemas', pasta: 'equipe-emblema', mimes: MIMES_IMAGEM, maxBytes: 4 * MB, privado: false },
}

/** Validade da URL assinada de leitura de documento, em segundos. */
export const VALIDADE_LEITURA_SEGUNDOS = 120

export function tipoDeUploadValido(valor: unknown): valor is TipoUpload {
  return typeof valor === 'string' && Object.prototype.hasOwnProperty.call(TIPOS_UPLOAD, valor)
}
