import { Suspense } from 'react'
import type { Metadata } from 'next'
import { Barlow_Condensed, Manrope } from 'next/font/google'
import './globals.css'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { IndicadorDemora } from '@/components/ui/IndicadorDemora'
import { getSiteUrl, SITE_DESCRIPTION, SITE_NAME } from '@/lib/seo'

const sans = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
})

const display = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-display',
  display: 'swap',
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
    images: [{ url: '/brand/banner-oficial.png', alt: 'volei.space — gestão de campeonatos de vôlei' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'volei.space | Gestão de campeonatos de vôlei',
    description: SITE_DESCRIPTION,
    images: ['/brand/banner-oficial.png'],
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
        <div className="min-w-0">{children}</div>
        <Footer />
      </body>
    </html>
  )
}
