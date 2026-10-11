import type { CartazStories, LinhaCartaz } from '@/lib/stories-cartaz'
import type { PaletaStories } from '@/lib/stories-paleta'

export const STORIES_LARGURA = 1080
export const STORIES_ALTURA = 1920

export function desenharCartaz(canvas: HTMLCanvasElement, cartaz: CartazStories, paleta: PaletaStories) {
  canvas.width = STORIES_LARGURA
  canvas.height = STORIES_ALTURA
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const display = familia('--font-display', '"Arial Narrow", Impact, sans-serif')
  const texto = familia('--font-sans', 'Manrope, "Segoe UI", sans-serif')
  const gradiente = ctx.createLinearGradient(0, 0, STORIES_LARGURA, STORIES_ALTURA)
  gradiente.addColorStop(0, paleta.fundoA)
  gradiente.addColorStop(1, paleta.fundoB)
  ctx.fillStyle = gradiente
  ctx.fillRect(0, 0, STORIES_LARGURA, STORIES_ALTURA)

  ctx.fillStyle = paleta.primaria
  ctx.globalAlpha = 0.22
  ctx.beginPath()
  ctx.arc(920, 180, 280, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1

  ctx.fillStyle = paleta.destaque
  ctx.fillRect(0, 0, STORIES_LARGURA, 18)

  const margem = 80
  let y = 120
  ctx.fillStyle = paleta.destaque
  ctx.font = `700 34px ${display}`
  ctx.fillText('volei.space', margem, y)
  y += 70
  ctx.fillStyle = paleta.textoSuave
  ctx.font = `700 32px ${display}`
  ctx.fillText(cartaz.kicker.toUpperCase(), margem, y)
  y += 84
  ctx.fillStyle = paleta.texto
  ctx.font = `700 78px ${display}`
  const titulos = quebrar(ctx, cartaz.titulo, STORIES_LARGURA - margem * 2).slice(0, 3)
  for (const linha of titulos) {
    ctx.fillText(linha, margem, y)
    y += 84
  }
  y += 16

  const rodape = 210
  const disponivel = STORIES_ALTURA - y - rodape
  const linhas = cartaz.linhas.slice(0, Math.max(1, Math.floor(disponivel / 72)))
  const altura = Math.max(72, Math.min(120, Math.floor(disponivel / Math.max(linhas.length, 1))))
  for (const linha of linhas) {
    desenharLinha(ctx, linha, margem, y, altura, paleta, display, texto)
    y += altura
  }

  const linkY = STORIES_ALTURA - 120
  ctx.fillStyle = paleta.destaque
  roundRect(ctx, margem, linkY - 46, STORIES_LARGURA - margem * 2, 92, 28)
  ctx.fill()
  ctx.fillStyle = paleta.sobreDestaque
  ctx.font = `700 30px ${texto}`
  const link = quebrar(ctx, cartaz.link, STORIES_LARGURA - margem * 2 - 48).slice(0, 2)
  link.forEach((linha, indice) => {
    ctx.fillText(linha, margem + 28, linkY + indice * 34 - (link.length === 1 ? 0 : 8))
  })
}

export function arquivoDoCanvas(canvas: HTMLCanvasElement) {
  return new Promise<File>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('imagem'))
        return
      }
      resolve(new File([blob], 'volei-space-story.png', { type: 'image/png' }))
    }, 'image/png')
  })
}

function desenharLinha(
  ctx: CanvasRenderingContext2D,
  linha: LinhaCartaz,
  x: number,
  y: number,
  altura: number,
  paleta: PaletaStories,
  display: string,
  texto: string,
) {
  const centro = linha.detalhe ? y + altura * 0.4 : y + altura * 0.62
  if (linha.tipo === 'secao') {
    ctx.fillStyle = paleta.destaque
    ctx.font = `700 30px ${display}`
    ctx.fillText(linha.texto.toUpperCase(), x, centro)
    return
  }
  if (linha.destaque) {
    ctx.fillStyle = paleta.primaria
    ctx.globalAlpha = 0.35
    roundRect(ctx, x - 20, y + 8, STORIES_LARGURA - x * 2 + 40, altura - 16, 18)
    ctx.fill()
    ctx.globalAlpha = 1
  }
  ctx.fillStyle = paleta.texto
  ctx.font = `700 ${linha.tipo === 'placar' ? 40 : 36}px ${texto}`
  const valor = linha.valor ?? ''
  const larguraValor = valor ? ctx.measureText(valor).width : 0
  const limite = STORIES_LARGURA - x * 2 - larguraValor - 24
  const principal = encurtar(ctx, linha.texto, limite)
  ctx.fillText(principal, x, centro)
  if (valor) {
    ctx.fillStyle = paleta.destaque
    ctx.font = `700 40px ${display}`
    ctx.fillText(valor, STORIES_LARGURA - x - ctx.measureText(valor).width, centro)
  }
  if (linha.detalhe) {
    ctx.fillStyle = paleta.textoSuave
    ctx.font = `600 24px ${texto}`
    ctx.fillText(encurtar(ctx, linha.detalhe, STORIES_LARGURA - x * 2), x, y + altura * 0.78)
  }
}

function familia(variavel: string, reserva: string) {
  if (typeof document === 'undefined') return reserva
  const valor = getComputedStyle(document.documentElement).getPropertyValue(variavel).trim()
  return valor || reserva
}

function quebrar(ctx: CanvasRenderingContext2D, texto: string, largura: number) {
  const palavras = texto.split(/\s+/).filter(Boolean)
  const linhas: string[] = []
  let atual = ''
  for (const palavra of palavras) {
    const tentativa = atual ? `${atual} ${palavra}` : palavra
    if (ctx.measureText(tentativa).width <= largura) atual = tentativa
    else {
      if (atual) linhas.push(atual)
      atual = palavra
    }
  }
  if (atual) linhas.push(atual)
  return linhas.length ? linhas : ['']
}

function encurtar(ctx: CanvasRenderingContext2D, texto: string, largura: number) {
  if (ctx.measureText(texto).width <= largura) return texto
  let curto = texto
  while (curto.length > 1 && ctx.measureText(`${curto}…`).width > largura) curto = curto.slice(0, -1)
  return `${curto}…`
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, largura: number, altura: number, raio: number) {
  ctx.beginPath()
  ctx.moveTo(x + raio, y)
  ctx.arcTo(x + largura, y, x + largura, y + altura, raio)
  ctx.arcTo(x + largura, y + altura, x, y + altura, raio)
  ctx.arcTo(x, y + altura, x, y, raio)
  ctx.arcTo(x, y, x + largura, y, raio)
  ctx.closePath()
}
