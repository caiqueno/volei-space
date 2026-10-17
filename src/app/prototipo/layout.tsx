import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { ProtoProvider } from '@/components/prototipo/ProtoContext'
import { prototipoAtivo } from '@/lib/prototipo/roteiro'

export const metadata: Metadata = {
  title: 'Protótipo — volei.space',
  robots: { index: false, follow: false },
}

export default function PrototipoLayout({ children }: { children: ReactNode }) {
  if (!prototipoAtivo()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-vs-bg px-4 text-vs-text">
        <p role="status" className="text-lg">Protótipo indisponível</p>
      </div>
    )
  }
  return (
    <div className="min-h-screen bg-vs-bg text-vs-text">
      <ProtoProvider>{children}</ProtoProvider>
    </div>
  )
}
