import { EstadoVazio } from '@/components/ui/EstadoVazio'

export const dynamic = 'force-dynamic'

export default function InscricaoRapidaPage() {
  return (
    <main className="luva-shell min-h-screen px-4 py-12 text-white">
      <EstadoVazio
        titulo="Use o link da categoria"
        descricao="O organizador envia um link para cada categoria. Por esse link a equipe é cadastrada direto, sem aprovação."
      />
    </main>
  )
}
