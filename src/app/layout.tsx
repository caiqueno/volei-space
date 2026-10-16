import { Suspense } from 'react'
import type { Metadata } from 'next'
import localFont from 'next/font/local'
import './globals.css'
import './micro-interactions.css'
import '../styles/vs-motion.css'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { IndicadorDemora } from '@/components/ui/IndicadorDemora'
import { TransicaoDeTela } from '@/components/ui/TransicaoDeTela'
import { getSiteUrl, imagemOg, SITE_DESCRIPTION, SITE_NAME } from '@/lib/seo'

const sans = localFont({
  src: [
    { path: '../fonts/manrope-latin.woff2', weight: '400', style: 'normal' },
    { path: '../fonts/manrope-latin.woff2', weight: '500', style: 'normal' },
    { path: '../fonts/manrope-latin.woff2', weight: '600', style: 'normal' },
    { path: '../fonts/manrope-latin.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-sans',
  display: 'swap',
  declarations: [{ prop: 'unicode-range', value: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD' }],
})

const display = localFont({
  src: [
    { path: '../fonts/barlow-condensed-latin-600.woff2', weight: '600', style: 'normal' },
    { path: '../fonts/barlow-condensed-latin-700.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-display',
  display: 'swap',
  declarations: [{ prop: 'unicode-range', value: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD' }],
})

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  title: {
    default: 'volei.space | Crie e gerencie campeonatos de vôlei',
    template: '%s | volei.space',
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: SITE_NAME, url: '/' }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: 'sports',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: '/',
    siteName: SITE_NAME,
    title: 'volei.space | Gestão de campeonatos de vôlei',
    description: SITE_DESCRIPTION,
    images: [imagemOg()],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'volei.space | Gestão de campeonatos de vôlei',
    description: SITE_DESCRIPTION,
    images: [imagemOg().url],
  },
  manifest: '/manifest.webmanifest',
  verification: process.env.GOOGLE_SITE_VERIFICATION
    ? { google: process.env.GOOGLE_SITE_VERIFICATION }
    : undefined,
  icons: {
    icon: '/brand/volei-space_app-icon_1024x1024.png',
    shortcut: '/brand/volei-space_app-icon_1024x1024.png',
    apple: '/brand/volei-space_app-icon_1024x1024.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const siteUrl = getSiteUrl().toString().replace(/\/$/, '')
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${siteUrl}/#organization`,
        name: SITE_NAME,
        url: siteUrl,
        logo: `${siteUrl}/brand/volei-space_app-icon_1024x1024.png`,
        sameAs: ['https://www.instagram.com/volei.space/'],
      },
      {
        '@type': 'WebSite',
        '@id': `${siteUrl}/#website`,
        url: siteUrl,
        name: SITE_NAME,
        description: SITE_DESCRIPTION,
        inLanguage: 'pt-BR',
        publisher: { '@id': `${siteUrl}/#organization` },
      },
    ],
  }

  return (
    <html lang="pt-BR" className={`${sans.variable} ${display.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }}
        />
      </head>
      <body className={sans.className}>
        <script dangerouslySetInnerHTML={{ __html: "try{if(window.self!==window.top)document.documentElement.classList.add('painel-embed')}catch(e){}" }} />
        <IndicadorDemora />
        <Suspense fallback={null}>
          <Header />
        </Suspense>
        <div className="min-w-0">
          <TransicaoDeTela>{children}</TransicaoDeTela>
        </div>
        <Footer />
      </body>
    </html>
  )
}
