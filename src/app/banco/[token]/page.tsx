import type { Metadata } from 'next'
import { BancoApp } from '@/components/banco/BancoApp'

// O link é a credencial: não indexar e não vazar o endereço por referrer.
export const metadata: Metadata = {
  title: 'Banco de reservas',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

export default function BancoPage({ params }: { params: { token: string } }) {
  return (
    // Cobre o cabeçalho e o rodapé do site: o banco é um app de uso rápido, em tela cheia.
    <main className="fixed inset-0 z-[200] overflow-y-auto bg-vs-bg">
      <BancoApp token={params.token} />
    </main>
  )
}
