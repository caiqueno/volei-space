'use client'

import Image from 'next/image'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { InstagramIcon } from '@/components/landing/InstagramIcon'

export function Footer() {
  const pathname = usePathname()
  if (pathname.startsWith('/admin') || pathname.startsWith('/cadastro') || pathname.startsWith('/inscricao') || pathname.startsWith('/sumula') || pathname.startsWith('/arbitro') || pathname.startsWith('/banco') || pathname.startsWith('/prototipo') || pathname.startsWith('/scout') || pathname.startsWith('/ao-vivo/')) return null

  if (pathname === '/') {
    return (
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-footer-brand">
            <span className="relative h-12 w-12 overflow-hidden rounded-xl">
              <Image src="/brand/volei-space_simbolo-orbital_transparente.png" alt="volei.space" aria-hidden="true" fill sizes="48px" className="object-contain" />
            </span>
            <div>
              <strong>volei.space</strong>
            </div>
          </div>

          <nav>
            <a href="#temporada">Campeonato</a>
            <a href="#funcionalidades">Funcionalidades</a>
            <Link href="/portal">Portal</Link>
            <Link href="/termos-de-uso">Termos</Link>
            <Link href="/politica-de-privacidade">Privacidade</Link>
            <Link href="/politica-de-cookies">Cookies</Link>
          </nav>

          <a className="landing-footer-social" href="https://www.instagram.com/volei.space/" target="_blank" rel="noreferrer">
            <InstagramIcon size={18} />
            Instagram volei.space
          </a>
        </div>
      </footer>
    )
  }

  return (
    <footer className="border-t border-white/10 bg-[#061426]/92 pb-24 text-white backdrop-blur-2xl lg:pb-0">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-9 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <span className="relative h-12 w-12 overflow-hidden rounded-xl">
            <Image src="/brand/volei-space_simbolo-orbital_transparente.png" alt="volei.space" aria-hidden="true" fill sizes="48px" className="object-contain" />
          </span>
          <div>
            <p className="system-footer-brand-title font-display text-lg font-black">volei.space</p>
          </div>
        </div>
        <div className="flex max-w-xl flex-col gap-3 md:items-end">
          <p className="system-footer-copy text-sm font-semibold leading-6 text-slate-200">
            Calendário, classificação, rankings e cobertura de torneios em uma experiência digital rápida e responsiva.
          </p>
          <nav className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-black text-slate-300" aria-label="Documentos legais">
            <Link className="transition hover:text-white" href="/termos-de-uso">Termos de Uso</Link>
            <Link className="transition hover:text-white" href="/politica-de-privacidade">Privacidade</Link>
            <Link className="transition hover:text-white" href="/politica-de-cookies">Cookies</Link>
          </nav>
        </div>
      </div>
    </footer>
  )
}
