import { caminhoDoValorArmazenado, lerCaminhoUpload } from '@/lib/uploads/caminho'
import { TIPOS_UPLOAD } from '@/lib/uploads/config'

// Valores de Jogador.documentosUrls. O bucket é privado: o que o servidor devolve e grava
// é o CAMINHO no bucket (a leitura passa por /api/uploads/documento), nunca uma URL pública.

const BUCKET = TIPOS_UPLOAD['atleta-documento'].bucket

export type EquipeDoDocumento = { id: number; ligaId: number }

/**
 * Valor recebido do cliente -> caminho a gravar, ou null se não for aceito.
 * Aceita caminho puro do formato novo (da própria equipe), URL do bucket privado (formato antigo
 * ou referência sem token) e caminho legado que já estava gravado neste mesmo atleta.
 */
export function normalizarDocumentoEntrada(valor: unknown, equipe: EquipeDoDocumento, jaGravados: string[] = []): string | null {
  const caminho = caminhoDoValorArmazenado(valor, BUCKET)
  if (!caminho) return null
  const lido = lerCaminhoUpload(caminho)
  if (lido) {
    if (lido.tipo !== 'atleta-documento') return null
    return lido.equipeId === equipe.id && lido.ligaId === equipe.ligaId ? caminho : null
  }
  // Formato legado (objeto antigo do bucket): só se for URL do bucket ou já estiver gravado neste atleta.
  const veioComoUrl = typeof valor === 'string' && /^https?:\/\//i.test(valor.trim())
  return veioComoUrl || jaGravados.includes(caminho) ? caminho : null
}

/** Valor gravado -> caminho para devolver na API. Valores que não são do bucket privado (ex.: URL externa) saem da resposta. */
export function documentoParaLeitura(valor: unknown): string | null {
  return caminhoDoValorArmazenado(valor, BUCKET)
}
