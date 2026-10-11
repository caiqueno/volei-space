'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CartazVisual } from '@/components/stories/CartazVisual'
import { capturarCartaz } from '@/lib/stories-imagem'
import { AVISO_STORIES_FALLBACK, compartilharStories, deepLinkStories } from '@/lib/stories-compartilhar'
import { PALETA_OFICIAL_ID, PALETAS_STORIES, paletaDaCorLivre, paletaOficial, paletaPorId, type PaletaStories } from '@/lib/stories-paleta'
import { cartazMataMata, type CartazStories, type ChaveCartaz } from '@/lib/stories-cartaz'
import estilos from '@/components/stories/stories.module.css'

type Props = {
  titulo: string
  montar: (opcoes: { incluirSumula: boolean; link: string; grupoId: string | null }) => CartazStories
  oferecerSumula?: boolean
  versao?: string | number
  variante?: 'icone' | 'linha'
}

export function BotaoStoriesInstagram({ titulo, montar, oferecerSumula = false, versao, variante = 'icone' }: Props) {
  const [aberto, setAberto] = useState(false)
  const [paletaId, setPaletaId] = useState(PALETA_OFICIAL_ID)
  const [corLivre, setCorLivre] = useState<string | null>(null)
  const [incluirSumula, setIncluirSumula] = useState(false)
  const [aviso, setAviso] = useState('')
  const [enviando, setEnviando] = useState(false)
  const capturaRef = useRef<HTMLDivElement>(null)
  const botaoRef = useRef<HTMLButtonElement>(null)
  const painelRef = useRef<HTMLDivElement>(null)
  const sumulaId = useId()
  const tituloId = useId()
  const paleta = useMemo(() => (corLivre ? paletaDaCorLivre(corLivre) : paletaPorId(paletaId)), [corLivre, paletaId])

  function abrir() {
    setPaletaId(PALETA_OFICIAL_ID)
    setCorLivre(null)
    setIncluirSumula(false)
    setAviso('')
    setAberto(true)
  }

  const cartaz = aberto ? montar({ incluirSumula, link: linkDaPagina(), grupoId: null }) : null

  useEffect(() => {
    if (!aberto) return
    const botao = botaoRef.current
    const painel = painelRef.current
    painel?.focus()
    function tecla(evento: KeyboardEvent) {
      if (evento.key === 'Escape') setAberto(false)
    }
    document.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('keydown', tecla)
      botao?.focus()
    }
  }, [aberto])

  async function compartilhar() {
    const no = capturaRef.current
    if (!no || enviando) return
    setEnviando(true)
    setAviso('')
    try {
      deepLinkStories()
      const arquivo = await capturarCartaz(no)
      const resultado = await compartilharStories(arquivo, linkDaPagina(), titulo)
      if (resultado === 'fallback') setAviso(AVISO_STORIES_FALLBACK)
      if (resultado === 'nativo') setAberto(false)
    } catch {
      setAviso('Não foi possível compartilhar agora. Tente de novo.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      <button ref={botaoRef} type="button" className={variante === 'linha' ? estilos.botaoLinha : estilos.botao} aria-label="Compartilhar nos stories do Instagram" onClick={abrir}>
        <IconeInstagram />
      </button>
      {aberto && typeof document !== 'undefined' && createPortal(
        <div className={estilos.velo} onClick={() => setAberto(false)}>
          <div
            ref={painelRef}
            className={estilos.painel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={tituloId}
            tabIndex={-1}
            onClick={(evento) => evento.stopPropagation()}
          >
            <h2 id={tituloId} className="font-display text-2xl font-bold">Prévia do story</h2>
            <p className="mt-1 text-sm font-semibold text-[#9AA8C1]">A cor vale só para esta imagem.</p>
            {cartaz && (
              <div className={estilos.janela} aria-label="Prévia da imagem para os stories">
                <div className={estilos.escala}>
                  <CartazVisual key={versao ?? 'cartaz'} cartaz={cartaz} paleta={paleta} />
                </div>
              </div>
            )}
            {cartaz && (
              <div className={estilos.captura} aria-hidden="true">
                <div ref={capturaRef}>
                  <CartazVisual key={versao ?? 'captura'} cartaz={cartaz} paleta={paleta} />
                </div>
              </div>
            )}
            <div className={estilos.paletas} role="group" aria-label="Paletas">
              {PALETAS_STORIES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={estilos.amostra}
                  aria-label={item.nome}
                  aria-pressed={!corLivre && item.id === paleta.id}
                  style={{ background: `linear-gradient(135deg, ${item.fundoA}, ${item.primaria} 55%, ${item.destaque})` }}
                  onClick={() => {
                    setCorLivre(null)
                    setPaletaId(item.id)
                  }}
                />
              ))}
            </div>
            <label className={estilos.livre}>
              Cor primária
              <input
                type="color"
                value={corDoSeletor(paleta)}
                aria-label="Cor primária"
                onChange={(evento) => setCorLivre(evento.target.value)}
              />
            </label>
            {oferecerSumula && (
              <label className={estilos.sumula} htmlFor={sumulaId}>
                <input id={sumulaId} type="checkbox" checked={incluirSumula} onChange={(evento) => setIncluirSumula(evento.target.checked)} />
                Incluir súmula
              </label>
            )}
            <button type="button" className={estilos.enviar} onClick={() => void compartilhar()} disabled={enviando}>
              {enviando ? 'Compartilhando' : 'Compartilhar'}
            </button>
            {aviso && <p className={estilos.aviso} role="status">{aviso}</p>}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

export function FaixaStories({ kicker, titulo, children }: { kicker?: string; titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        {kicker ? <p className="text-xs font-black uppercase tracking-[0.16em] text-[#ffb331]">{kicker}</p> : null}
        <h2 className="truncate font-display text-2xl font-bold text-vs-text">{titulo}</h2>
      </div>
      {children}
    </div>
  )
}

export function BotaoChaveStories({ chave, campeonato, logoCampeonato }: { chave: ChaveCartaz; campeonato?: string; logoCampeonato?: string | null }) {
  const jogos = chave.rounds.reduce((total, round) => total + round.slots.length, 0)
  return (
    <BotaoStoriesInstagram
      titulo="Chave do mata-mata"
      versao={jogos}
      montar={({ link }) => cartazMataMata(chave, link, campeonato, logoCampeonato)}
    />
  )
}

function corDoSeletor(paleta: PaletaStories) {
  return /^#[0-9A-Fa-f]{6}$/.test(paleta.primaria) ? paleta.primaria : paletaOficial().primaria
}

function linkDaPagina() {
  if (typeof window === 'undefined') return 'https://volei.space'
  return window.location.href
}

function IconeInstagram() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}
