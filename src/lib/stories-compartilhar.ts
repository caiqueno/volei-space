export const AVISO_STORIES_FALLBACK = 'Imagem salva e link copiado: abra o Instagram e poste nos stories'

export type ResultadoShare = 'nativo' | 'fallback' | 'cancelado'

export type AmbienteShare = {
  canShare: (dados: ShareData) => boolean
  share: (dados: ShareData) => Promise<void>
  baixar: (arquivo: File) => void
  copiar: (texto: string) => Promise<void>
}

/**
 * O esquema instagram-stories://share só entrega a imagem pelo pasteboard
 * do aplicativo, ou por uma URL já publicada. No navegador isso publicaria
 * o arquivo. O caminho seguro é o navigator.share com o arquivo local.
 */
export function deepLinkStories(): null {
  return null
}

export function ambienteDoNavegador(): AmbienteShare {
  return {
    canShare: (dados) => typeof navigator.canShare === 'function' && navigator.canShare(dados),
    share: (dados) => navigator.share(dados),
    baixar: baixarArquivo,
    copiar: copiarTexto,
  }
}

export async function compartilharStories(arquivo: File, url: string, titulo: string, ambiente: AmbienteShare = ambienteDoNavegador()): Promise<ResultadoShare> {
  const dados: ShareData = { files: [arquivo], url, title: titulo }
  if (ambiente.canShare(dados)) {
    try {
      await ambiente.share(dados)
      return 'nativo'
    } catch (erro) {
      if (erro instanceof Error && erro.name === 'AbortError') return 'cancelado'
      throw erro
    }
  }
  ambiente.baixar(arquivo)
  await ambiente.copiar(url)
  return 'fallback'
}

function baixarArquivo(arquivo: File) {
  const url = URL.createObjectURL(arquivo)
  const ancora = document.createElement('a')
  ancora.href = url
  ancora.download = arquivo.name || 'volei-space-story.png'
  ancora.rel = 'noopener'
  document.body.appendChild(ancora)
  ancora.click()
  ancora.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function copiarTexto(texto: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(texto)
    return
  }
  const campo = document.createElement('textarea')
  campo.value = texto
  campo.setAttribute('readonly', '')
  campo.style.position = 'fixed'
  campo.style.left = '-9999px'
  document.body.appendChild(campo)
  campo.select()
  const ok = document.execCommand('copy')
  campo.remove()
  if (!ok) throw new Error('copia')
}
