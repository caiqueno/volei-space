'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Copy, ExternalLink, Plus } from 'lucide-react'
import { slugify } from '@/utils/slug'
import { OrganizadorSidebar } from './OrganizadorSidebar'
import { OrganizacaoForm, type OrganizacaoFormValues } from './OrganizacaoForm'
import { ChampionshipCarousel } from './ChampionshipCarousel'
import { EmptyChampionshipCard } from './EmptyChampionshipCard'
import type { LigaCarouselItem } from './types'

type RegistrationItem = {
  id: string
  ligaId: number
  status: string
  registrationToken?: string | null
  equipe?: { nome?: string | null; categoria?: string | null; serie?: string | null } | null
}

interface Session {
  tipo: string
  nome?: string
  candidaturaId?: string | null
}

// Orquestrador da nova home do organizador (/painel). Busca perfil da
// organização + ligas 1x no mount; sidebar e carrossel têm estados
// independentes entre si (item 36) — aqui só decide QUAL conteúdo mostrar à
// direita (onboarding / carrossel-empty-state / configurações).
export function OrganizadorHome({ session, logout }: { session: Session; logout: () => void }) {
  const router = useRouter()
  const organizadorId = session.candidaturaId ?? ''

  const [loading, setLoading] = useState(true)
  const [perfil, setPerfil] = useState<OrganizacaoFormValues | null>(null)
  const [ligas, setLigas] = useState<LigaCarouselItem[]>([])
  const [view, setView] = useState<'home' | 'settings'>('home')
  const [activeChampionshipId, setActiveChampionshipId] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [registrations, setRegistrations] = useState<RegistrationItem[]>([])
  const [copiedRegistrationId, setCopiedRegistrationId] = useState<string | null>(null)

  useEffect(() => {
    if (!organizadorId) {
      setLoading(false)
      return
    }
    let cancelled = false

    Promise.all([
      fetch('/api/organizador/perfil', { cache: 'no-store' }).then((r) => r.json()),
      fetch(`/api/ligas?organizadorId=${encodeURIComponent(organizadorId)}`, { cache: 'no-store' }).then((r) => r.json()),
      fetch(`/api/inscricoes-campeonato?organizadorId=${encodeURIComponent(organizadorId)}`, { cache: 'no-store' }).then((r) => r.json()),
    ])
      .then(([perfilJson, ligasJson, registrationsJson]) => {
        if (cancelled) return
        if (perfilJson.data) {
          setPerfil({
            organizacao: perfilJson.data.organizacao ?? '',
            cidade: perfilJson.data.cidade ?? '',
            logoUrl: perfilJson.data.logoUrl ?? '',
          })
        }
        const ligasData: LigaCarouselItem[] = Array.isArray(ligasJson.data) ? ligasJson.data : []
        setLigas(ligasData)
        setRegistrations(Array.isArray(registrationsJson.data?.inscricoes) ? registrationsJson.data.inscricoes : [])
        if (ligasData.length > 0) setActiveChampionshipId((current) => current ?? ligasData[0].id)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [organizadorId])

  async function copyRegistrationLink(registration: RegistrationItem) {
    if (!registration.registrationToken) return
    await navigator.clipboard.writeText(`${window.location.origin}/inscricao-rapida/${registration.registrationToken}`)
    setCopiedRegistrationId(registration.id)
    window.setTimeout(() => setCopiedRegistrationId(null), 2000)
  }

  function handleOnboardingSaved(values: OrganizacaoFormValues) {
    // Atualiza o estado local — sem refetch, sem reload (item 10).
    setPerfil(values)
  }

  async function criarCampeonato() {
    if (!organizadorId || creating) return
    setCreating(true)
    setFeedback(null)
    try {
      const nome = 'Novo campeonato'
      const slug = `${slugify(nome)}-c${Date.now().toString(36)}`
      const response = await fetch('/api/ligas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizadorId, nome, slug }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error ?? 'Erro ao criar campeonato')
      router.push(`/painel/parametrizacao?ligaId=${json.data.id}`)
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Erro ao criar campeonato')
      setCreating(false)
    }
  }

  const organizacaoIncompleta = !loading && !perfil?.organizacao
  const primeiroNome = (session.nome || '').trim().split(/\s+/)[0] || null

  const pageTitle = organizacaoIncompleta
    ? 'Complete sua organização'
    : view === 'settings'
      ? 'Configurações'
      : ligas.length === 0
        ? 'Crie seu primeiro campeonato'
        : 'Seus campeonatos'

  return (
    <>
      <OrganizadorSidebar
        view={view}
        onSelectView={setView}
        organizacaoNome={perfil?.organizacao || null}
        organizacaoLogoUrl={perfil?.logoUrl || null}
        onLogout={logout}
        obfuscated={organizacaoIncompleta}
      />

      {/* Mesmo padrão de /painel/campeonatos/page.tsx: main.luva-shell.public-dashboard.creator-dashboard
          sem aside própria — o deslocamento para a .profile-sidebar fixa acontece
          automaticamente via CSS global (:has(.profile-sidebar) > main). */}
      <main className="luva-shell public-dashboard creator-dashboard min-h-screen text-white">
        <section className="border-b border-white/10 bg-[#061426]/95 px-4 py-5">
          <div className="mx-auto max-w-7xl">
            <p className="luva-kicker">Painel</p>
            <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
              <h1 className="font-display text-3xl font-black sm:text-5xl">{pageTitle}</h1>
              {!organizacaoIncompleta && view === 'home' && ligas.length > 0 && (
                <button
                  type="button"
                  onClick={criarCampeonato}
                  disabled={creating}
                  className="inline-flex items-center gap-2 rounded-full bg-luva-amber px-4 py-2.5 text-sm font-black text-[#050914] transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Plus size={16} />
                  {creating ? 'Criando...' : 'Novo Campeonato'}
                </button>
              )}
            </div>
            {!organizacaoIncompleta && view === 'home' && (
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-300">
                Bem-vindo, {primeiroNome ?? perfil?.organizacao}
                {ligas.length === 0 ? '. Configure nome, datas e inscrições em poucos passos.' : '.'}
              </p>
            )}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-10">
          {loading ? (
            <p className="text-sm font-bold text-white/50">Carregando...</p>
          ) : organizacaoIncompleta ? (
            <div className="luva-card mx-auto max-w-lg rounded-2xl p-6 sm:p-8">
              <OrganizacaoForm mode="onboarding" initialValues={perfil ?? { organizacao: '', cidade: '', logoUrl: '' }} onSaved={handleOnboardingSaved} />
            </div>
          ) : view === 'settings' ? (
            <div className="luva-card mx-auto max-w-lg rounded-2xl p-6 sm:p-8">
              <OrganizacaoForm mode="settings" initialValues={perfil!} onSaved={handleOnboardingSaved} />
            </div>
          ) : (
            <>
              {feedback && <p className="mb-4 text-sm font-bold text-red-300">{feedback}</p>}
              {ligas.length === 0 ? (
                <div className="mx-auto w-full max-w-xs aspect-[4/5]">
                  <EmptyChampionshipCard onCreate={criarCampeonato} creating={creating} />
                </div>
              ) : (
                <>
                  <ChampionshipCarousel ligas={ligas} activeChampionshipId={activeChampionshipId} onActiveChampionshipChange={setActiveChampionshipId} />
                  <div className="mt-8 rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-300">Inscrições do campeonato</p>
                    <div className="mt-4 grid gap-3">
                      {registrations.filter((item) => item.ligaId === activeChampionshipId).length === 0 ? (
                        <p className="text-sm font-semibold text-slate-400">Nenhuma inscrição recebida ainda.</p>
                      ) : registrations.filter((item) => item.ligaId === activeChampionshipId).map((registration) => (
                        <div key={registration.id} className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#07111f] p-4 sm:flex-row sm:items-center sm:justify-between">
                          <div><p className="font-black text-white">{registration.equipe?.nome || 'Equipe'}</p><p className="mt-1 text-xs font-bold text-slate-400">{registration.status}{registration.equipe?.categoria ? ` · ${registration.equipe.categoria}` : ''}{registration.equipe?.serie ? ` · ${registration.equipe.serie}` : ''}</p></div>
                          {registration.registrationToken && <div className="flex gap-2">
                            <a href={`/inscricao-rapida/${registration.registrationToken}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-2 text-xs font-black text-white"><ExternalLink size={13} /> Abrir cadastro</a>
                            <button type="button" onClick={() => copyRegistrationLink(registration)} className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-2 text-xs font-black text-white">{copiedRegistrationId === registration.id ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />} {copiedRegistrationId === registration.id ? 'Copiado' : 'Copiar link'}</button>
                          </div>}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </section>
      </main>
    </>
  )
}
