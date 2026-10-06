'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { ConsultaCancelada, consultar } from '@/lib/api-cliente'
import { capaDoCampeonato } from '@/lib/capa-publica'
import { formatLigaFormato } from '@/lib/format-liga'
import { EstadoVazio } from '@/components/ui/EstadoVazio'

type CampeonatoAtivo = {
  id: number
  slug: string
  nome: string
  subtitulo: string | null
  descricao: string | null
  capaUrl: string | null
  logoUrl: string | null
  formato: string | null
  dataInicio: string | null
  dataFim: string | null
  inscricoesAbertas: boolean
  corTematica: string | null
  local: string | null
}

const INTERVALO_MS = 7000

export function PortalAtivosCarousel() {
  const [slides, setSlides] = useState<CampeonatoAtivo[] | null>(null)
  const [falha, setFalha] = useState(false)
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const toqueRef = useRef<number | null>(null)
  const reduzido = useReducedMotion()

  const abortRef = useRef<AbortController | null>(null)

  const carregar = useCallback(() => {
    abortRef.current?.abort()
    const controlador = new AbortController()
    abortRef.current = controlador
    consultar<{ data?: CampeonatoAtivo[] }>('/api/portal/ativos', { signal: controlador.signal })
      .then((payload) => {
        const lista = Array.isArray(payload.data) ? payload.data : []
        setFalha(false)
        setSlides(lista)
        setIndex((atual) => (lista.length === 0 ? 0 : atual % lista.length))
      })
      .catch((erro) => {
        if (erro instanceof ConsultaCancelada) return
        setFalha(true)
      })
  }, [])

  useEffect(() => {
    carregar()
    const aoFocar = () => carregar()
    window.addEventListener('focus', aoFocar)
    return () => {
      abortRef.current?.abort()
      window.removeEventListener('focus', aoFocar)
    }
  }, [carregar])

  useEffect(() => {
    if (!slides || slides.length < 2 || paused || reduzido) return
    const timer = window.setInterval(() => {
      setIndex((atual) => (atual + 1) % slides.length)
    }, INTERVALO_MS)
    return () => window.clearInterval(timer)
  }, [slides, paused, reduzido])

  if (!slides && falha) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12">
        <EstadoVazio
          titulo="Não foi possível carregar os campeonatos"
          descricao="A consulta falhou. Isso não significa que não existam campeonatos ativos."
          acao={<button type="button" onClick={carregar} className="rounded-full bg-[#ffb331] px-5 py-3 text-sm font-black text-slate-950">Tentar novamente</button>}
        />
      </div>
    )
  }

  if (!slides) {
    return <p className="px-4 py-16 text-sm font-semibold text-slate-300">Carregando campeonatos ativos...</p>
  }

  if (slides.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12">
        <EstadoVazio
          titulo="Nenhum campeonato ativo"
          descricao="Quando um organizador ativar um campeonato, ele aparece aqui."
        />
      </div>
    )
  }

  const atual = slides[index] ?? slides[0]
  const varios = slides.length > 1
  const imagem = capaDoCampeonato(atual.id, atual.capaUrl, atual.logoUrl)

  function irPara(proximo: number) {
    const total = slides?.length ?? 1
    setIndex((proximo + total) % total)
  }

  return (
    <section
      className="orange-wave"
      aria-roledescription="carrossel"
      aria-label="Campeonatos ativos"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onPointerDown={(event) => {
        if (event.pointerType === 'mouse') return
        toqueRef.current = event.clientX
      }}
      onPointerUp={(event) => {
        if (event.pointerType === 'mouse') return
        const inicio = toqueRef.current
        toqueRef.current = null
        if (inicio == null || !varios) return
        const delta = event.clientX - inicio
        if (Math.abs(delta) > 40) irPara(index + (delta < 0 ? 1 : -1))
      }}
    >
      <div className="mx-auto grid min-w-0 max-w-7xl gap-8 overflow-hidden px-4 py-10 lg:grid-cols-[minmax(0,1fr)_minmax(240px,420px)] lg:items-center">
        <AnimatePresence mode="wait">
        <motion.div
          key={atual.id}
          className="min-w-0"
          initial={reduzido ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduzido ? undefined : { opacity: 0 }}
          transition={{ duration: 0.45 }}
        >
          <p className="luva-kicker">Campeonato ativo</p>
          <h1 className="type-page-title mt-3 max-w-4xl break-words">{atual.nome}</h1>
          {(atual.subtitulo || atual.descricao) && (
            <p className="type-lead mt-4 max-w-2xl">
              {atual.descricao || atual.subtitulo}
            </p>
          )}
          <dl className="mt-6 grid gap-3 sm:grid-cols-2">
            <Fato rotulo="Formato" valor={formatLigaFormato(atual.formato)} />
            <Fato rotulo="Período" valor={formatarPeriodo(atual.dataInicio, atual.dataFim)} />
            <Fato rotulo="Local" valor={atual.local || 'Local a definir'} />
            <Fato rotulo="Inscrições" valor={atual.inscricoesAbertas ? 'Abertas' : 'Fechadas'} />
          </dl>
          <Link href={`/campeonatos/${atual.slug}`} className="mt-6 inline-flex items-center justify-center rounded-full bg-[#ffb331] px-5 py-3 text-sm font-black text-[#050914]">
            Ver campeonato
          </Link>
          {varios && (
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button type="button" aria-label="Campeonato anterior" onClick={() => irPara(index - 1)} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-white">
                <ChevronLeft size={18} />
              </button>
              <div className="flex gap-2" role="tablist" aria-label="Posição no carrossel">
                {slides.map((slide, posicao) => (
                  <button
                    key={slide.id}
                    type="button"
                    role="tab"
                    aria-selected={posicao === index}
                    aria-label={slide.nome}
                    onClick={() => setIndex(posicao)}
                    className={`h-2.5 rounded-full ${posicao === index ? 'w-6 bg-[#ffb331]' : 'w-2.5 bg-white/35'}`}
                  />
                ))}
              </div>
              <button type="button" aria-label="Próximo campeonato" onClick={() => irPara(index + 1)} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-white">
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </motion.div>
        </AnimatePresence>
        <div className="relative min-h-52 overflow-hidden rounded-2xl border border-white/10 bg-[#061426]">
          {imagem ? (
            <img src={imagem} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0" style={{ background: atual.corTematica || '#0F2C52' }} />
          )}
        </div>
      </div>
    </section>
  )
}

function Fato({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
      <dt className="text-xs font-bold text-slate-300">{rotulo}</dt>
      <dd className="mt-1 break-words text-sm font-black text-white">{valor}</dd>
    </div>
  )
}

function formatarPeriodo(inicio?: string | null, fim?: string | null) {
  const formato = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
  const texto = (valor?: string | null) => {
    if (!valor) return null
    const data = new Date(valor)
    if (Number.isNaN(data.getTime())) return null
    return formato.format(data)
  }
  const a = texto(inicio)
  const b = texto(fim)
  if (a && b) return `${a} – ${b}`
  return a || b || 'Data a definir'
}
