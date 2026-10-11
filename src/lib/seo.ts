import type { Metadata } from 'next'

export const SITE_NAME = 'volei.space'
export const SITE_DESCRIPTION = 'Plataforma para criar, organizar e acompanhar campeonatos de vôlei, com inscrições, calendário, classificação, rankings e súmula digital.'
export const OG_IMAGE_PATH = '/brand/og-image.png'
export const OG_IMAGE_WIDTH = 1200
export const OG_IMAGE_HEIGHT = 630
export const OG_IMAGE_ALT = 'volei.space'

export function imagemOg() {
  return {
    url: new URL(OG_IMAGE_PATH, getSiteUrl()).href,
    width: OG_IMAGE_WIDTH,
    height: OG_IMAGE_HEIGHT,
    alt: OG_IMAGE_ALT,
    type: 'image/png' as const,
  }
}

export function getSiteUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()
  const fallbackUrl = 'https://volei.space'

  try {
    const url = new URL(configuredUrl || fallbackUrl)
    if (process.env.NODE_ENV === 'production' && ['localhost', '127.0.0.1'].includes(url.hostname)) {
      return new URL(fallbackUrl)
    }
    return url
  } catch {
    return new URL(fallbackUrl)
  }
}

type PageMetadata = {
  title: string
  description: string
  path: string
}

export function createPageMetadata({ title, description, path }: PageMetadata): Metadata {
  const imagem = imagemOg()
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      locale: 'pt_BR',
      siteName: SITE_NAME,
      title,
      description,
      url: path,
      images: [imagem],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imagem.url],
    },
  }
}
