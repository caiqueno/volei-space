import type { Metadata } from 'next'
import { PedidosTrocaTela } from '@/components/regras-elenco/PedidosTrocaTela'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Pedidos de troca' }

export default function PainelPedidosTrocaPage() {
  // Sem a flag, a própria tela mostra o aviso de indisponível e não faz requisição.
  return (
    <main className="luva-shell min-h-screen px-4 py-8 text-white">
      <div className="mx-auto max-w-4xl">
        <PedidosTrocaTela />
      </div>
    </main>
  )
}
