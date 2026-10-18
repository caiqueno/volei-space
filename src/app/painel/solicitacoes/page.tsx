import type { Metadata } from 'next'
import { SolicitacoesTela } from '@/components/organizador-solicitacoes/SolicitacoesTela'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Solicitações de inscrição' }

export default function PainelSolicitacoesPage() {
  // Sem a flag, a própria tela mostra o aviso de indisponível e não faz requisição.
  return (
    <main className="luva-shell min-h-screen px-4 py-8 text-white">
      <div className="mx-auto max-w-4xl">
        <SolicitacoesTela />
      </div>
    </main>
  )
}
