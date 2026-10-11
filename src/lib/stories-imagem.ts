export const STORIES_LARGURA = 1080
export const STORIES_ALTURA = 1920
export const STORIES_MARGEM = 72
export const STORIES_ZONA_TOPO = 250
export const STORIES_CABECALHO_FIM = 450
export const STORIES_RODAPE_INICIO = 1520
export const STORIES_RODAPE_FIM = 1640

const OPCOES = {
  pixelRatio: 1,
  cacheBust: true,
  width: STORIES_LARGURA,
  height: STORIES_ALTURA,
  canvasWidth: STORIES_LARGURA,
  canvasHeight: STORIES_ALTURA,
  skipAutoScale: true,
}

export function deveAquecerSafari(agente = typeof navigator === 'undefined' ? '' : navigator.userAgent) {
  return /Safari/i.test(agente) && !/Chrome|Chromium|CriOS|FxiOS|Edg\//i.test(agente)
}

export async function capturarCartaz(no: HTMLElement) {
  if (typeof document !== 'undefined' && document.fonts?.ready) await document.fonts.ready
  const { toBlob, getFontEmbedCSS } = await import('html-to-image')
  const fontEmbedCSS = await getFontEmbedCSS(no)
  const opcoes = { ...OPCOES, fontEmbedCSS }
  if (deveAquecerSafari()) await toBlob(no, opcoes)
  const blob = await toBlob(no, opcoes)
  if (!blob) throw new Error('imagem')
  return new File([blob], 'volei-space-story.png', { type: 'image/png' })
}
