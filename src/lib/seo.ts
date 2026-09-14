import type { Metadata } from 'next'

export const SITE_NAME = 'volei.space'
export const SITE_DESCRIPTION = 'Plataforma para criar, organizar e acompanhar campeonatos de vôlei, com inscrições, calendário, classificação, rankings e súmula digital.'

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
  image?: string
}

export function createPageMetadata({ title, description, path, image = '/brand/banner-oficial.png' }: PageMetadata): Metadata {
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
      images: [{ url: image, alt: `${SITE_NAME} — campeonatos de vôlei` }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  }
}
