'use client'

import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { capaDoCampeonato } from '@/lib/capa-publica'
import { PainelClassificacao } from '@/components/portal/PainelClassificacao'
import { PainelGaleria } from '@/components/portal/PainelGaleria'
import { PainelRanking } from '@/components/portal/PainelRanking'
import mi from '@/styles/microinteracoes.module.css'

type Campeonato = {
  id: number
  nome: string
  subtitulo: string | null
  capaUrl: string | null
  logoUrl: string | null
  status?: string | null
}

function situacao(status?: string | null) {
  const valor = String(status ?? '').toUpperCase()
  if (valor === 'FINALIZADO' || valor === 'ENCERRADA') return 'Concluído'
  if (valor === 'EM_BREVE') return 'Não iniciado'
  return 'Em andamento'
}

export function CampeonatosExpansiveis({
  kicker,
  titulo,
  descricao,
  vazioLista,
  modulo,
}: {
  kicker: string
  titulo: string
  descricao: string
  vazioLista: string
  modulo: 'classificacao' | 'rankings' | 'galeria'
}) {
  const [campeonatos, setCampeonatos] = useState<Campeonato[]>([])
  const [abertos, setAbertos] = useState<number[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  useEffect(() => {
    const controle = new AbortController()
    fetch('/api/portal/campeonatos?limite=24', { signal: controle.signal })
      .then(async (resposta) => {
        const json = await resposta.json()
        if (!resposta.ok) throw new Error(json.error || 'Falha ao carregar')
        setCampeonatos(json.data?.campeonatos ?? [])
        setErro('')
      })
      .catch((causa) => {
        if (causa instanceof DOMException && causa.name === 'AbortError') return
        setErro('Erro ao carregar dados')
      })
      .finally(() => {
        if (!controle.signal.aborted) setCarregando(false)
      })
    return () => controle.abort()
  }, [])

  function alternar(id: number) {
    setAbertos((atual) => atual.includes(id) ? atual.filter((item) => item !== id) : [...atual, id])
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-10">
      <p className={`text-xs font-black uppercase tracking-[0.2em] text-[#ffb331] ${modulo === 'classificacao' ? mi.entrar : ''}`}>{kicker}</p>
      <h1 className={`mt-2 font-display text-4xl font-black text-white ${modulo === 'classificacao' ? mi.entrar : ''}`}>{titulo}</h1>
      <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-300">{descricao}</p>
      {erro && <p className="mt-6 text-sm font-bold text-red-200">{erro}</p>}
      {carregando && <p className="mt-8 text-sm font-semibold text-slate-300">Carregando...</p>}
      {!carregando && !erro && campeonatos.length === 0 && <p className="mt-8 text-sm font-semibold text-slate-300">{vazioLista}</p>}
      <div className="mt-8 grid gap-4">
        {campeonatos.map((campeonato, index) => {
          const aberto = abertos.includes(campeonato.id)
          return (
            <article key={campeonato.id} className={`overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] ${modulo === 'classificacao' ? `${mi.cartao} ${mi.entrar}` : ''}`} style={modulo === 'classificacao' ? { animationDelay: `${Math.min(index, 6) * 40}ms` } : undefined}>
              <button type="button" aria-expanded={aberto} onClick={() => alternar(campeonato.id)} className={`flex w-full items-center gap-4 p-4 text-left ${modulo === 'classificacao' ? mi.toque : ''}`}>
                <img src={capaDoCampeonato(campeonato.id, campeonato.capaUrl, campeonato.logoUrl)} alt="" className="h-16 w-24 shrink-0 rounded-2xl object-cover sm:w-28" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-black text-white">{campeonato.nome}</span>
                  {modulo === 'rankings' && (
                    <span className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-black ${situacao(campeonato.status) === 'Concluído' ? 'bg-luva-amber' : 'border border-white/15 text-slate-300'}`}>
                      {situacao(campeonato.status)}
                    </span>
                  )}
                </span>
                <ChevronDown size={18} className={`shrink-0 text-slate-300 transition ${aberto ? 'rotate-180' : ''}`} />
              </button>
              {aberto && (
                <div className="border-t border-white/10 px-4 py-4">
                  {modulo === 'classificacao' && <PainelClassificacao ligaId={campeonato.id} />}
                  {modulo === 'rankings' && <PainelRanking ligaId={campeonato.id} concluido={situacao(campeonato.status) === 'Concluído'} />}
                  {modulo === 'galeria' && <PainelGaleria ligaId={campeonato.id} />}
                </div>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}
