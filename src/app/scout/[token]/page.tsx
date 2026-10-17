import type { Metadata } from 'next'
import { ScoutApp } from '@/components/scout/ScoutApp'
import { EstadoScout } from '@/components/scout/EstadoScout'
import { scoutAtivo } from '@/lib/scout-ui/flag'

// O link é a credencial: não indexar e não vazar o endereço por referrer.
export const metadata: Metadata = {
  title: 'Scout',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

export default function ScoutPage({ params }: { params: { token: string } }) {
  const ativo = scoutAtivo(process.env.NEXT_PUBLIC_SCOUT_ATIVO)
  return (
    // Cobre o cabeçalho e o rodapé do site: o scout é um app de uso rápido, em tela cheia.
    <main className="fixed inset-0 z-[200] overflow-y-auto bg-vs-bg">
      {ativo ? <ScoutApp token={params.token} /> : <EstadoScout tela="desligado" />}
    </main>
  )
}
