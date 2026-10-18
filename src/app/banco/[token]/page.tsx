import type { Metadata } from 'next'
import { BancoApp } from '@/components/banco/BancoApp'
import { EstadoTela } from '@/components/banco/EstadoTela'
import { bancoAppAtivo } from '@/lib/sumula-banco-ui'

// O link é a credencial: não indexar e não vazar o endereço por referrer.
export const metadata: Metadata = {
  title: 'Banco de reservas',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

export default function BancoPage({ params }: { params: { token: string } }) {
  // Flag desligada: nenhuma requisição ao servidor (o app nem monta).
  const ativo = bancoAppAtivo(process.env.NEXT_PUBLIC_BANCO_APP_ATIVO)
  return (
    // Cobre o cabeçalho e o rodapé do site: o banco é um app de uso rápido, em tela cheia.
    <main className="fixed inset-0 z-[200] overflow-y-auto bg-vs-bg">
      {ativo ? <BancoApp token={params.token} /> : <EstadoTela tela="desligado" />}
    </main>
  )
}
