'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { capaDoCampeonato } from '@/lib/capa-publica'
import { formatLigaStatus } from '@/lib/format-liga'
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

function campeonatoEncerrado(status?: string | null) {
  const valor = String(status ?? '').trim().toUpperCase()
  return valor === 'FINALIZADO' || valor === 'ENCERRADA'
}

export function CampeonatosExpansiveis({
  kicker,
  titulo,
  descricao,
  vazioLista,
  modulo,
  ligaIdInicial = null,
  categoriaInicial = null,
}: {
  kicker: string
  titulo: string
  descricao: string
  vazioLista: string
  modulo: 'classificacao' | 'rankings' | 'galeria'
  ligaIdInicial?: number | null
  categoriaInicial?: string | null
}) {
  const [campeonatos, setCampeonatos] = useState<Campeonato[]>([])
  const [abertos, setAbertos] = useState<number[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const rolou = useRef(false)

  useEffect(() => {
    const controle = new AbortController()
    async function carregar() {
      const acumulado: Campeonato[] = []
      let offset = 0
      try {
        for (let guarda = 0; guarda < 8; guarda += 1) {
          const resposta = await fetch(`/api/portal/campeonatos?limite=24&offset=${offset}`, { signal: controle.signal })
          const json = await resposta.json()
          if (!resposta.ok) throw new Error(json.error || 'Falha ao carregar')
          const pagina = (json.data?.campeonatos ?? []) as Campeonato[]
          acumulado.push(...pagina)
          const temMais = Boolean(json.data?.temMais)
          const proximo = Number(json.data?.proximoOffset ?? offset + pagina.length)
          const achou = ligaIdInicial != null && acumulado.some((item) => item.id === ligaIdInicial)
          if (!ligaIdInicial || achou || !temMais || proximo <= offset) break
          offset = proximo
        }
        setCampeonatos(acumulado)
        if (ligaIdInicial != null && acumulado.some((item) => item.id === ligaIdInicial)) {
          setAbertos([ligaIdInicial])
        }
        setErro('')
      } catch (causa) {
        if (causa instanceof DOMException && causa.name === 'AbortError') return
        setErro('Erro ao carregar dados')
      } finally {
        if (!controle.signal.aborted) setCarregando(false)
      }
    }
    carregar()
    return () => controle.abort()
  }, [ligaIdInicial])

  useEffect(() => {
    if (ligaIdInicial == null || rolou.current || carregando) return
    if (!campeonatos.some((item) => item.id === ligaIdInicial)) return
    rolou.current = true
    document.getElementById(`campeonato-${ligaIdInicial}`)?.scrollIntoView({ block: 'nearest' })
  }, [campeonatos, carregando, ligaIdInicial])

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
            <article id={`campeonato-${campeonato.id}`} key={campeonato.id} className={`scroll-mt-24 overflow-hidden rounded-3xl border bg-white/[0.04] ${campeonato.id === ligaIdInicial ? 'border-[#ffb331]' : 'border-white/10'} ${modulo === 'classificacao' ? `${mi.cartao} ${mi.entrar}` : ''}`} style={modulo === 'classificacao' ? { animationDelay: `${Math.min(index, 6) * 40}ms` } : undefined}>
              <button type="button" aria-expanded={aberto} onClick={() => alternar(campeonato.id)} className={`flex w-full items-center gap-4 p-4 text-left ${modulo === 'classificacao' ? mi.toque : ''}`}>
                <img src={capaDoCampeonato(campeonato.id, campeonato.capaUrl, campeonato.logoUrl)} alt="" className="h-16 w-24 shrink-0 rounded-2xl object-cover sm:w-28" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-black text-white">{campeonato.nome}</span>
                  {modulo === 'rankings' && (
                    <span className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-black ${campeonatoEncerrado(campeonato.status) ? 'bg-luva-amber text-slate-950' : 'border border-white/15 text-slate-300'}`}>
                      {formatLigaStatus(campeonato.status)}
                    </span>
                  )}
                </span>
                <ChevronDown size={18} className={`shrink-0 text-slate-300 transition ${aberto ? 'rotate-180' : ''}`} />
              </button>
              {aberto && (
                <div className="border-t border-white/10 px-4 py-4">
                  {modulo === 'classificacao' && <PainelClassificacao ligaId={campeonato.id} categoriaInicial={campeonato.id === ligaIdInicial ? categoriaInicial : null} />}
                  {modulo === 'rankings' && <PainelRanking ligaId={campeonato.id} concluido={campeonatoEncerrado(campeonato.status)} categoriaInicial={campeonato.id === ligaIdInicial ? categoriaInicial : null} />}
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
