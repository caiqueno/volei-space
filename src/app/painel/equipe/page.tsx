import type { Metadata } from 'next'
import { EquipeTela } from '@/components/painel-inscricoes/EquipeTela'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Minha equipe' }

export default function PainelEquipePage() {
  // Sem a flag, a própria tela mostra o aviso de indisponível e não faz requisição.
  return (
    <main className="luva-shell min-h-screen px-4 py-8 text-white">
      <div className="mx-auto max-w-4xl">
        <EquipeTela />
      </div>
    </main>
  )
}
