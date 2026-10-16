import { caminhoDoValorArmazenado, lerCaminhoUpload } from '@/lib/uploads/caminho'
import { TIPOS_UPLOAD } from '@/lib/uploads/config'

// Jogador.fotoRostoUrl. O bucket de foto de rosto é público, e o que o cliente recebe do envio é a
// URL pública. O servidor só grava URL do PRÓPRIO Storage do projeto, nesse bucket, e só quando o
// objeto pertence à equipe do capitão. Qualquer outra URL (host estranho, javascript:, data:) é recusada.

const BUCKET = TIPOS_UPLOAD['atleta-foto-rosto'].bucket

export type EquipeDaFoto = { id: number; ligaId: number }

function hostDoProjeto(urlBase: string | undefined): string | null {
  if (!urlBase) return null
  try {
    return new URL(urlBase).host
  } catch {
    return null
  }
}

/**
 * Valor recebido -> URL pública a gravar, ou null se não for aceito. Vazio/ausente é tratado fora.
 *  - caminho do bucket no formato novo, da equipe e da liga do capitão: vira URL pública;
 *  - URL pública do bucket no host do projeto, com o mesmo caminho: aceita;
 *  - valor idêntico ao que já está gravado no mesmo atleta (foto antiga): preservado.
 */
export function normalizarFotoRostoEntrada(
  valor: unknown,
  equipe: EquipeDaFoto,
  jaGravada: string | null | undefined,
  urlBase: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL,
): string | null {
  if (typeof valor !== 'string') return null
  const texto = valor.trim()
  if (!texto) return null
  if (jaGravada && texto === jaGravada.trim()) return texto

  const host = hostDoProjeto(urlBase)
  if (!host) return null
  if (/^[a-z][a-z0-9+.-]*:/i.test(texto)) {
    let url: URL
    try {
      url = new URL(texto)
    } catch {
      return null
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    if (url.host !== host || url.username || url.password) return null
  }
  const caminho = caminhoDoValorArmazenado(texto, BUCKET)
  if (!caminho) return null
  const lido = lerCaminhoUpload(caminho)
  if (!lido || lido.tipo !== 'atleta-foto-rosto') return null
  if (lido.equipeId !== equipe.id || lido.ligaId !== equipe.ligaId) return null
  return `${new URL(urlBase as string).origin}/storage/v1/object/public/${BUCKET}/${caminho}`
}
