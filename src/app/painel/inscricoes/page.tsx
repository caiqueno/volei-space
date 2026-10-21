import type { Metadata } from 'next'
import { InscricoesTela } from '@/components/painel-inscricoes/InscricoesTela'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Inscrições' }

export default function PainelInscricoesPage() {
  // Sem a flag, a própria tela mostra o aviso de indisponível e não faz requisição.
  return (
    <main className="luva-shell min-h-screen px-4 py-8 text-white">
      <div className="mx-auto max-w-5xl">
        <InscricoesTela />
      </div>
    </main>
  )
}
