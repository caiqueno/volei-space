// Preparo de imagem no navegador (compressão e recorte quadrado). Reaproveita a compressão do projeto.
import { optimizeImageFile } from '@/lib/client-image-upload'
import { ehPdf, opcoesCompressao, retanguloRecorteQuadrado, validarArquivoEscolhido, validarArquivoFinal, type TipoUploadElenco } from '@/lib/meu-time-elenco-ui/upload'

export type ArquivoPronto = { arquivo: File; previaUrl: string | null }

function carregarImagem(arquivo: Blob): Promise<{ imagem: HTMLImageElement; liberar: () => void }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(arquivo)
    const imagem = new Image()
    imagem.onload = () => resolve({ imagem, liberar: () => URL.revokeObjectURL(url) })
    imagem.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Não foi possível ler a imagem escolhida.'))
    }
    imagem.src = url
  })
}

export async function lerDimensoes(arquivo: Blob): Promise<{ largura: number; altura: number }> {
  const { imagem, liberar } = await carregarImagem(arquivo)
  const dimensoes = { largura: imagem.naturalWidth || imagem.width, altura: imagem.naturalHeight || imagem.height }
  liberar()
  return dimensoes
}

/** Recorta um quadrado da imagem (posição 0 a 1 no lado maior) e devolve PNG. */
export async function recortarQuadrado(arquivo: File, posicao = 0.5, ladoMaximo = 1024): Promise<File> {
  const { imagem, liberar } = await carregarImagem(arquivo)
  try {
    const largura = imagem.naturalWidth || imagem.width
    const altura = imagem.naturalHeight || imagem.height
    const corte = retanguloRecorteQuadrado(largura, altura, posicao)
    const lado = Math.min(corte.lado, ladoMaximo)
    const canvas = document.createElement('canvas')
    canvas.width = lado
    canvas.height = lado
    const contexto = canvas.getContext('2d')
    if (!contexto) throw new Error('Não foi possível processar a imagem no navegador.')
    contexto.drawImage(imagem, corte.x, corte.y, corte.lado, corte.lado, 0, 0, lado, lado)
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Não foi possível recortar a imagem.'))), 'image/png'))
    return new File([blob], 'escudo.png', { type: 'image/png' })
  } finally {
    liberar()
  }
}

/** Confere, comprime (imagem) e devolve o arquivo pronto para enviar. PDF segue como está. */
export async function prepararArquivo(tipo: TipoUploadElenco, arquivo: File, nomeBase: string): Promise<ArquivoPronto> {
  const erro = validarArquivoEscolhido(tipo, arquivo)
  if (erro) throw new Error(erro)
  if (ehPdf(arquivo)) return { arquivo, previaUrl: null }
  const otimizada = await optimizeImageFile(arquivo, nomeBase, opcoesCompressao(tipo))
  const erroFinal = validarArquivoFinal(tipo, otimizada.file)
  if (erroFinal) throw new Error(erroFinal)
  return { arquivo: otimizada.file, previaUrl: otimizada.previewUrl }
}
