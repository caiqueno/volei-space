'use client'

import { Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { EstadoVazio } from '@/components/ui/EstadoVazio'
import { SECTION_WIZARD_REGISTRY, isValidSetupSectionSlug } from '@/components/parametrizacao/sections/registry'
import { ToastProvider } from '@/components/parametrizacao/ui/Toast'

function Content() {
  const params = useParams<{ secao: string }>()
  const searchParams = useSearchParams()
  const ligaId = Number(searchParams.get('ligaId')) || null
  const secao = params.secao

  if (!ligaId) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <EstadoVazio titulo="Campeonato não informado" descricao="Acesse esta seção a partir da Central de Parametrização, no card do campeonato." />
      </div>
    )
  }

  if (!isValidSetupSectionSlug(secao)) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <Link href={`/painel/parametrizacao?ligaId=${ligaId}`} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-300 transition hover:text-white">
          <ArrowLeft size={16} /> Voltar à Central de Parametrização
        </Link>
        <div className="mt-6">
          <EstadoVazio titulo="Seção não encontrada" descricao="Esta etapa de parametrização não existe." />
        </div>
      </div>
    )
  }

  const { component: SectionWizard } = SECTION_WIZARD_REGISTRY[secao]
  return <SectionWizard key={ligaId} ligaId={ligaId} />
}

export default function SetupSectionPage() {
  return (
    <main className="luva-shell public-dashboard creator-dashboard min-h-screen text-white">
      <ToastProvider>
        <Suspense fallback={<main className="luva-shell public-dashboard min-h-screen p-8 text-white">Carregando...</main>}>
          <Content />
        </Suspense>
      </ToastProvider>
    </main>
  )
}
