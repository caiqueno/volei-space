import { notFound } from 'next/navigation'
import { TelaDoPasso } from '@/components/prototipo/TelaDoPasso'
import { PERFIS, getPasso } from '@/lib/prototipo/roteiro'

export function generateStaticParams() {
  return PERFIS.flatMap((p) => p.passos.map((s) => ({ perfil: p.id, passo: s.id })))
}

export const dynamicParams = false

export default function PassoPage({ params }: { params: { perfil: string; passo: string } }) {
  if (!getPasso(params.perfil, params.passo)) notFound()
  return <TelaDoPasso perfil={params.perfil} passo={params.passo} />
}
