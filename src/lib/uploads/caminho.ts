import { randomUUID } from 'node:crypto'
import { TIPOS_UPLOAD, tipoDeUploadValido, type TipoUpload } from '@/lib/uploads/config'

// Caminho do objeto no bucket: <tipo>/liga-<ligaId>/equipe-<equipeId>/<uuid>.<ext>
// O dono (campeonato e equipe) está no próprio caminho, então a leitura autoriza pelo
// caminho sem confiar em nada que o cliente mande além do próprio caminho.

export type CaminhoUpload = {
  tipo: TipoUpload
  ligaId: number
  equipeId: number
  arquivo: string
}

const PADRAO = /^([a-z-]+)\/liga-(\d{1,9})\/equipe-(\d{1,9})\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpg|png|webp|pdf))$/

export function montarCaminhoUpload(entrada: { tipo: TipoUpload; ligaId: number; equipeId: number; extensao: string; id?: string }) {
  const id = entrada.id ?? randomUUID()
  return `${TIPOS_UPLOAD[entrada.tipo].pasta}/liga-${entrada.ligaId}/equipe-${entrada.equipeId}/${id}.${entrada.extensao}`
}

/** Lê um caminho no formato novo. Devolve null para qualquer outra coisa (inclui `..`, barras extras e legado). */
export function lerCaminhoUpload(caminho: unknown): CaminhoUpload | null {
  if (typeof caminho !== 'string' || caminho.length > 200) return null
  const achado = PADRAO.exec(caminho)
  if (!achado) return null
  const [, tipo, ligaId, equipeId, arquivo] = achado
  if (!tipoDeUploadValido(tipo)) return null
  return { tipo, ligaId: Number(ligaId), equipeId: Number(equipeId), arquivo }
}

/**
 * Valor gravado em Jogador.documentosUrls (URL pública antiga ou caminho relativo) -> caminho no bucket.
 * Só aceita o bucket pedido e rejeita qualquer segmento `..`.
 */
export function caminhoDoValorArmazenado(valor: unknown, bucket: string): string | null {
  if (typeof valor !== 'string' || !valor.trim()) return null
  let caminho = valor.trim()
  const marcadores = [`/storage/v1/object/public/${bucket}/`, `/storage/v1/object/sign/${bucket}/`]
  const marcador = marcadores.find((item) => caminho.includes(item))
  if (marcador) {
    caminho = caminho.slice(caminho.indexOf(marcador) + marcador.length).split('?')[0]
  } else if (/^[a-z][a-z0-9+.-]*:/i.test(caminho)) {
    return null
  }
  try {
    caminho = decodeURIComponent(caminho)
  } catch {
    return null
  }
  if (!caminho || caminho.startsWith('/') || caminho.split('/').some((parte) => parte === '..' || parte === '')) return null
  return caminho
}
