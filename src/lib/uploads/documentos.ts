import { caminhoDoValorArmazenado, lerCaminhoUpload } from '@/lib/uploads/caminho'
import { TIPOS_UPLOAD } from '@/lib/uploads/config'

// Valores de Jogador.documentosUrls. O bucket é privado: o que o servidor devolve e grava
// é o CAMINHO no bucket (a leitura passa por /api/uploads/documento), nunca uma URL pública.

const BUCKET = TIPOS_UPLOAD['atleta-documento'].bucket

export type EquipeDoDocumento = { id: number; ligaId: number }

/**
 * Leitura: o documento gravado num atleta só é assinado se, no formato novo, o dono do caminho
 * for a equipe do atleta (e a liga dela). Formato legado não carrega dono no nome e segue legível.
 */
export function documentoPertenceAEquipe(caminho: string, equipe: EquipeDoDocumento): boolean {
  const lido = lerCaminhoUpload(caminho)
  if (!lido) return true
  return lido.tipo === 'atleta-documento' && lido.equipeId === equipe.id && lido.ligaId === equipe.ligaId
}

/**
 * Valor recebido do cliente -> caminho a gravar, ou null se não for aceito.
 * Regra única, vale também quando o valor chega como URL do bucket:
 *  - formato novo: só se pertencer à equipe e à liga do capitão;
 *  - formato legado (sem dono no nome): só se JÁ estiver gravado neste mesmo atleta (`jaGravados`).
 * Legado novo, de outro dono, `..` e URL de outro host nunca passam.
 */
export function normalizarDocumentoEntrada(valor: unknown, equipe: EquipeDoDocumento, jaGravados: string[] = []): string | null {
  const caminho = caminhoDoValorArmazenado(valor, BUCKET)
  if (!caminho) return null
  const lido = lerCaminhoUpload(caminho)
  if (lido) {
    if (lido.tipo !== 'atleta-documento') return null
    return lido.equipeId === equipe.id && lido.ligaId === equipe.ligaId ? caminho : null
  }
  return jaGravados.includes(caminho) ? caminho : null
}

/** Valor gravado -> caminho para devolver na API. Valores que não são do bucket privado (ex.: URL externa) saem da resposta. */
export function documentoParaLeitura(valor: unknown): string | null {
  return caminhoDoValorArmazenado(valor, BUCKET)
}
