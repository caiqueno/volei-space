import type { Metadata } from 'next'
import { Manrope } from 'next/font/google'
import './globals.css'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'

const manrope = Manrope({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'volei.space',
  description: 'Sistema de gestão de campeonatos de vôlei',
  icons: {
    icon: '/brand/volei-space_app-icon_1024x1024.png',
    shortcut: '/brand/volei-space_app-icon_1024x1024.png',
    apple: '/brand/volei-space_app-icon_1024x1024.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={manrope.className}>
        <Header />
        <main className="min-h-screen">{children}</main>
        <Footer />
      </body>
    </html>
  )
}
