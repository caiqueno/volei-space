// Tipos de upload aceitos pelas rotas de URL assinada (docs/analise/21-uploads-assinados.md).
// Os limites aqui valem no servidor; os do bucket (file_size_limit e allowed_mime_types,
// migration 202610170004) repetem a mesma regra na hora do envio.

export type TipoUpload =
  | 'atleta-documento'
  | 'atleta-foto-rosto'
  | 'equipe-emblema'
  | 'candidatura-emblema'
  | 'quadra-foto'
  | 'galeria-campeonato'
  | 'organizador-logo'

/**
 * A quem o arquivo pertence, o que define o caminho e quem pode assinar:
 * - equipe: organizador dono do campeonato ou capitão (equipe existente);
 * - candidatura: cadastro anônimo (limite por IP) ou usuário com sessão; caminho temporário;
 * - liga: só o organizador dono do campeonato;
 * - organizador: só o próprio organizador.
 */
export type EscopoUpload = 'equipe' | 'candidatura' | 'liga' | 'organizador'

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
  pasta: string
  escopo: EscopoUpload
  mimes: readonly string[]
  maxBytes: number
  /** Bucket privado: leitura só por URL assinada de curta duração. */
  privado: boolean
}

const MB = 1024 * 1024

export const TIPOS_UPLOAD: Record<TipoUpload, ConfigUpload> = {
  // Documento do atleta (RG, CPF, certidão): bucket privado, 8 MB, imagem ou PDF.
  'atleta-documento': { bucket: 'atleta-arquivos', pasta: 'atleta-documento', escopo: 'equipe', mimes: MIMES_DOCUMENTO, maxBytes: 8 * MB, privado: true },
  // Foto de rosto: bucket público separado (decisão D5), 4 MB, só imagem.
  'atleta-foto-rosto': { bucket: 'jogador-fotos-rosto', pasta: 'atleta-foto-rosto', escopo: 'equipe', mimes: MIMES_IMAGEM, maxBytes: 4 * MB, privado: false },
  // Emblema da equipe: bucket público, 4 MB, só imagem.
  'equipe-emblema': { bucket: 'equipe-emblemas', pasta: 'equipe-emblema', escopo: 'equipe', mimes: MIMES_IMAGEM, maxBytes: 4 * MB, privado: false },
  // Emblema enviado no cadastro de candidatura, antes de a equipe existir: 4 MB, só imagem.
  'candidatura-emblema': { bucket: 'equipe-emblemas', pasta: 'candidatura-emblema', escopo: 'candidatura', mimes: MIMES_IMAGEM, maxBytes: 4 * MB, privado: false },
  // Foto de quadra de candidatura (cadastro e edição): bucket público, 5 MB, só imagem.
  'quadra-foto': { bucket: 'quadra-fotos', pasta: 'quadra-foto', escopo: 'candidatura', mimes: MIMES_IMAGEM, maxBytes: 5 * MB, privado: false },
  // Galeria e identidade do campeonato. A pasta `ligas` é a que as rotas de galeria já reconhecem.
  'galeria-campeonato': { bucket: 'galeria-campeonato', pasta: 'ligas', escopo: 'liga', mimes: MIMES_IMAGEM, maxBytes: 4 * MB, privado: false },
  // Logo da organização: bucket público, 4 MB, só imagem.
  'organizador-logo': { bucket: 'organizador-logos', pasta: 'organizador-logo', escopo: 'organizador', mimes: MIMES_IMAGEM, maxBytes: 4 * MB, privado: false },
}

/** Validade da URL assinada de leitura de documento, em segundos. */
export const VALIDADE_LEITURA_SEGUNDOS = 120

export function tipoDeUploadValido(valor: unknown): valor is TipoUpload {
  return typeof valor === 'string' && Object.prototype.hasOwnProperty.call(TIPOS_UPLOAD, valor)
}

/** Tipos cujo arquivo pertence a uma equipe existente (caminho com liga e equipe). */
export function tipoDeEquipe(valor: unknown): valor is TipoUpload {
  return tipoDeUploadValido(valor) && TIPOS_UPLOAD[valor].escopo === 'equipe'
}
