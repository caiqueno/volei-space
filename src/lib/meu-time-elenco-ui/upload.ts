// Regras puras do envio de arquivos do Meu Time (foto de rosto, documento, escudo).
// O servidor confere tudo de novo; aqui só se dá retorno rápido e se monta o pedido.

export type TipoUploadElenco = 'ESCUDO' | 'FOTO_ROSTO' | 'DOCUMENTO'

export const LIMITE_IMAGEM_BYTES = 2 * 1024 * 1024
export const LIMITE_PDF_BYTES = 5 * 1024 * 1024
export const LIMITE_ORIGINAL_BYTES = 20 * 1024 * 1024

const IMAGENS = ['image/jpeg', 'image/png', 'image/webp']

export const TIPOS_ACEITOS: Record<TipoUploadElenco, string[]> = {
  ESCUDO: IMAGENS,
  FOTO_ROSTO: IMAGENS,
  DOCUMENTO: [...IMAGENS, 'application/pdf'],
}

export const ROTULO_UPLOAD: Record<TipoUploadElenco, string> = {
  ESCUDO: 'escudo',
  FOTO_ROSTO: 'foto de rosto',
  DOCUMENTO: 'documento',
}

export function ehPdf(arquivo: { type: string }): boolean {
  return arquivo.type === 'application/pdf'
}

/** Valor do atributo `accept` do campo de arquivo. */
export function aceitaDoCampo(tipo: TipoUploadElenco): string {
  return TIPOS_ACEITOS[tipo].join(',')
}

/** Limite final (depois da compressão) do arquivo enviado. */
export function limiteFinalBytes(tipo: TipoUploadElenco, arquivo: { type: string }): number {
  return tipo === 'DOCUMENTO' && ehPdf(arquivo) ? LIMITE_PDF_BYTES : LIMITE_IMAGEM_BYTES
}

export function formatarTamanho(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB'
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

/** Confere tipo e tamanho do arquivo escolhido (antes de comprimir). Devolve a mensagem de erro ou null. */
export function validarArquivoEscolhido(tipo: TipoUploadElenco, arquivo: { type: string; size: number }): string | null {
  if (!TIPOS_ACEITOS[tipo].includes(arquivo.type)) {
    return tipo === 'DOCUMENTO' ? 'Envie uma foto (JPG, PNG ou WebP) ou um PDF.' : 'Envie uma imagem JPG, PNG ou WebP.'
  }
  if (arquivo.size <= 0) return 'O arquivo está vazio. Escolha outro.'
  if (ehPdf(arquivo)) {
    return arquivo.size > LIMITE_PDF_BYTES ? `O PDF passa de ${formatarTamanho(LIMITE_PDF_BYTES)}. Escolha um arquivo menor.` : null
  }
  if (arquivo.size > LIMITE_ORIGINAL_BYTES) return `A imagem passa de ${formatarTamanho(LIMITE_ORIGINAL_BYTES)}. Escolha uma foto menor.`
  return null
}

/** Mesma checagem para o arquivo já pronto para enviar. */
export function validarArquivoFinal(tipo: TipoUploadElenco, arquivo: { type: string; size: number }): string | null {
  if (!TIPOS_ACEITOS[tipo].includes(arquivo.type)) return 'Tipo de arquivo não permitido.'
  if (arquivo.size > limiteFinalBytes(tipo, arquivo)) return `O arquivo passa de ${formatarTamanho(limiteFinalBytes(tipo, arquivo))}.`
  return null
}

/** Opções de compressão por tipo. PDF não é comprimido. */
export function opcoesCompressao(tipo: TipoUploadElenco): { maxDimension: number; maxOutputBytes: number } {
  if (tipo === 'DOCUMENTO') return { maxDimension: 1600, maxOutputBytes: LIMITE_IMAGEM_BYTES }
  if (tipo === 'ESCUDO') return { maxDimension: 512, maxOutputBytes: LIMITE_IMAGEM_BYTES }
  return { maxDimension: 800, maxOutputBytes: LIMITE_IMAGEM_BYTES }
}

export type EntradaEnvio = {
  equipeId: string
  atletaId?: string
  tipo: TipoUploadElenco
  arquivo: { name: string; type: string; size: number }
}

export type PedidoAssinatura = {
  equipeId: string
  atletaId?: string
  tipo: TipoUploadElenco
  nomeArquivo: string
  contentType: string
  tamanho: number
}

/** Corpo de POST /api/meu-time/uploads/assinar. Escudo é da equipe; foto e documento exigem o atleta. */
export function montarPedidoAssinatura(entrada: EntradaEnvio): PedidoAssinatura {
  if (entrada.tipo !== 'ESCUDO' && !entrada.atletaId) throw new Error('Salve o atleta antes de enviar a foto ou o documento.')
  const pedido: PedidoAssinatura = {
    equipeId: entrada.equipeId,
    tipo: entrada.tipo,
    nomeArquivo: nomeSeguro(entrada.arquivo.name),
    contentType: entrada.arquivo.type,
    tamanho: entrada.arquivo.size,
  }
  if (entrada.tipo !== 'ESCUDO' && entrada.atletaId) pedido.atletaId = entrada.atletaId
  return pedido
}

/** Corpo de POST /api/meu-time/uploads/confirmar. */
export function montarPedidoConfirmacao(entrada: Pick<EntradaEnvio, 'equipeId' | 'atletaId' | 'tipo'>, path: string) {
  const corpo: { equipeId: string; atletaId?: string; tipo: TipoUploadElenco; path: string } = { equipeId: entrada.equipeId, tipo: entrada.tipo, path }
  if (entrada.tipo !== 'ESCUDO' && entrada.atletaId) corpo.atletaId = entrada.atletaId
  return corpo
}

export function nomeSeguro(nome: string): string {
  const limpo = nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/\.{2,}/g, '.')
    .replace(/^[-.]+|[-.]+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 80)
  return limpo || 'arquivo'
}

// ---------------------------------------------------------------- estados

export type FaseUpload = 'ocioso' | 'preparando' | 'enviando' | 'enviado' | 'falhou'
export type EstadoUpload = { fase: FaseUpload; mensagem?: string }

export const UPLOAD_OCIOSO: EstadoUpload = { fase: 'ocioso' }

export type EventoUpload =
  | { tipo: 'escolheu' }
  | { tipo: 'preparado' }
  | { tipo: 'enviou' }
  | { tipo: 'falhou'; mensagem: string }
  | { tipo: 'removeu' }

export function proximoEstadoUpload(estado: EstadoUpload, evento: EventoUpload): EstadoUpload {
  switch (evento.tipo) {
    case 'escolheu': return { fase: 'preparando' }
    case 'preparado': return { fase: 'enviando' }
    case 'enviou': return { fase: 'enviado' }
    case 'falhou': return { fase: 'falhou', mensagem: evento.mensagem }
    case 'removeu': return UPLOAD_OCIOSO
    default: return estado
  }
}

export function textoEstadoUpload(estado: EstadoUpload, rotulo: string): string {
  switch (estado.fase) {
    case 'preparando': return `Preparando ${rotulo}…`
    case 'enviando': return `Enviando ${rotulo}…`
    case 'enviado': return `${rotulo[0].toUpperCase()}${rotulo.slice(1)} enviado.`
    case 'falhou': return estado.mensagem || `Não foi possível enviar ${rotulo}.`
    default: return ''
  }
}

/** Só pode tentar de novo depois de uma falha; durante o envio os botões ficam parados. */
export function podeTentarDeNovo(estado: EstadoUpload): boolean {
  return estado.fase === 'falhou'
}

export function ocupado(estado: EstadoUpload): boolean {
  return estado.fase === 'preparando' || estado.fase === 'enviando'
}

// ---------------------------------------------------------------- recorte quadrado

export type RetanguloRecorte = { x: number; y: number; lado: number }

/**
 * Recorte quadrado de uma imagem largura x altura. `posicao` (0 a 1) desliza o recorte no lado maior; 0,5 = centro.
 */
export function retanguloRecorteQuadrado(largura: number, altura: number, posicao = 0.5): RetanguloRecorte {
  const p = Math.min(1, Math.max(0, Number.isFinite(posicao) ? posicao : 0.5))
  const lado = Math.max(1, Math.min(largura, altura))
  if (largura >= altura) return { x: Math.round((largura - lado) * p), y: 0, lado }
  return { x: 0, y: Math.round((altura - lado) * p), lado }
}

export function precisaRecorte(largura: number, altura: number): boolean {
  return Math.abs(largura - altura) > 1
}
