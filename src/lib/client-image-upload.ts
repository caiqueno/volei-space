export const imageUploadRules = {
  allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
  allowedLabel: 'JPG, JPEG, PNG ou WEBP',
  maxOriginalBytes: 20 * 1024 * 1024,
  maxOutputBytes: 2 * 1024 * 1024,
  maxDimension: 1200,
}

export type OptimizedImage = {
  file: File
  previewUrl: string
  originalBytes: number
  optimizedBytes: number
}

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB'
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

export function validateImageFile(file: File) {
  if (!imageUploadRules.allowedTypes.includes(file.type)) {
    return `Envie uma imagem ${imageUploadRules.allowedLabel}.`
  }

  if (file.size > imageUploadRules.maxOriginalBytes) {
    return `A imagem passa de ${formatBytes(imageUploadRules.maxOriginalBytes)}. Escolha uma foto menor.`
  }

  return ''
}

export async function optimizeImageFile(file: File, outputName = 'imagem', options?: { maxDimension?: number; maxOutputBytes?: number }) {
  const validationError = validateImageFile(file)
  if (validationError) throw new Error(validationError)

  const maxDimension = options?.maxDimension ?? imageUploadRules.maxDimension
  const maxOutputBytes = options?.maxOutputBytes ?? imageUploadRules.maxOutputBytes
  const image = await loadImage(file)
  let { width, height } = fitImageSize(image.naturalWidth || image.width, image.naturalHeight || image.height, maxDimension)
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Não foi possível processar a imagem no navegador.')

  drawImage(canvas, context, image, width, height)
  URL.revokeObjectURL(image.src)

  const type = 'image/webp'
  let finalBlob = await canvasToBlob(canvas, type, 0.82)
  const qualities = [0.72, 0.62, 0.52]

  for (const quality of qualities) {
    if (finalBlob.size <= maxOutputBytes) break
    finalBlob = await canvasToBlob(canvas, type, quality)
  }

  while (finalBlob.size > maxOutputBytes && width > 240 && height > 240) {
    width = Math.round(width * 0.85)
    height = Math.round(height * 0.85)
    drawImage(canvas, context, image, width, height)
    finalBlob = await canvasToBlob(canvas, type, 0.62)
  }

  if (finalBlob.size > maxOutputBytes) {
    throw new Error(`Não foi possível reduzir a imagem para ${formatBytes(maxOutputBytes)}. Tente outra foto.`)
  }

  const extension = type === 'image/webp' ? 'webp' : 'jpg'
  const optimizedFile = new File([finalBlob], `${safeFileName(outputName)}.${extension}`, { type: finalBlob.type || type })

  return {
    file: optimizedFile,
    previewUrl: URL.createObjectURL(optimizedFile),
    originalBytes: file.size,
    optimizedBytes: optimizedFile.size,
  } satisfies OptimizedImage
}

function drawImage(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D, image: HTMLImageElement, width: number, height: number) {
  canvas.width = width
  canvas.height = height
  context.clearRect(0, 0, width, height)
  context.drawImage(image, 0, 0, width, height)
}

function fitImageSize(width: number, height: number, max = imageUploadRules.maxDimension) {
  if (width <= max && height <= max) return { width, height }
  const ratio = Math.min(max / width, max / height)
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Não foi possível comprimir a imagem.'))
        return
      }
      resolve(blob)
    }, type, quality)
  })
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Não foi possível ler a imagem selecionada.'))
    }
    image.src = url
  })
}

function safeFileName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'imagem'
}
