'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Lock, UserPlus } from 'lucide-react'

export default function InscricaoJogadorPage() {
  const { slug } = useParams<{ slug: string }>()
  const [nome, setNome] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    fetch(`/api/equipes?slug=${slug}`)
      .then((res) => res.json())
      .then((json) => {
        const equipe = (json.data ?? []).find((item: { slug?: string; nome?: string }) => item.slug === slug)
        if (!equipe) {
          setNotFound(true)
          setLoading(false)
          return
        }
        setNome(equipe.nome ?? null)
        setLoading(false)
      })
      .catch(() => {
        setNotFound(true)
        setLoading(false)
      })
  }, [slug])

  if (loading) return <StatusScreen icon={<UserPlus size={24} />} title="Carregando inscrição" description="Estamos buscando os dados da equipe." />
  if (notFound) return <StatusScreen icon={<UserPlus size={24} />} title="Equipe não encontrada" description="Verifique se o link de inscrição está correto e tente novamente." />

  return (
    <StatusScreen
      icon={<Lock size={24} />}
      title="Cadastro pelo convite"
      description={nome
        ? `${nome} não recebe atleta por este link público. O líder cadastra o elenco no link de convite enviado pelo organizador.`
        : 'Este link público não cadastra atleta. Use o link de convite enviado pelo organizador.'}
    />
  )
}

function StatusScreen({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <main className="sport-grid flex min-h-screen items-center justify-center px-4">
      <div className="luva-surface max-w-md rounded-[2rem] p-7 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-luva-amber text-[#050914]">{icon}</span>
        <h1 className="mt-5 text-2xl font-black text-luva-navy">{title}</h1>
        <p className="mt-2 text-sm font-semibold leading-6 text-luva-muted">{description}</p>
      </div>
    </main>
  )
}
