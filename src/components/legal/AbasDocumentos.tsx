'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const DOCUMENTOS = [
  { href: '/termos-de-uso', label: 'Termos' },
  { href: '/politica-de-privacidade', label: 'Privacidade' },
  { href: '/politica-de-cookies', label: 'Cookies' },
]

export function AbasDocumentos() {
  const pathname = usePathname()

  return (
    <div className="vs-tablist" role="tablist" aria-label="Documentos legais">
      {DOCUMENTOS.map((documento) => {
        const selecionada = pathname === documento.href
        return (
          <Link
            key={documento.href}
            href={documento.href}
            role="tab"
            aria-selected={selecionada}
            aria-controls="documento-legal"
            className="vs-tab rounded-xl px-3 py-2 text-sm font-black text-slate-700"
          >
            {documento.label}
          </Link>
        )
      })}
    </div>
  )
}
