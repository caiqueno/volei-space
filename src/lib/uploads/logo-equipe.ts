import { caminhoDoValorArmazenado, lerCaminhoUpload } from '@/lib/uploads/caminho'
import { TIPOS_UPLOAD } from '@/lib/uploads/config'

// Equipe.logoUrl / emblemaUrl. O bucket de emblemas é público e o cliente recebe do envio a URL
// pública. O servidor só grava URL do PRÓPRIO Storage do projeto, no bucket de emblemas, e só quando
// o objeto pertence à equipe e à liga do capitão (mesmo padrão de foto-rosto.ts). Qualquer outra
// URL (host estranho, javascript:, data:, tracker externo) é recusada.

const BUCKET = TIPOS_UPLOAD['equipe-emblema'].bucket

export type EquipeDoLogo = { id: number; ligaId: number }

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
 *  - valor idêntico ao que já está gravado na equipe (logo antiga ou do cadastro): preservado.
 */
export function normalizarLogoEquipeEntrada(
  valor: unknown,
  equipe: EquipeDoLogo,
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
  if (!lido || lido.tipo !== 'equipe-emblema') return null
  if (lido.equipeId !== equipe.id || lido.ligaId !== equipe.ligaId) return null
  return `${new URL(urlBase as string).origin}/storage/v1/object/public/${BUCKET}/${caminho}`
}
