'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { arquivoDoCanvas, desenharCartaz } from '@/lib/stories-imagem'
import { AVISO_STORIES_FALLBACK, compartilharStories, deepLinkStories } from '@/lib/stories-compartilhar'
import { PALETA_OFICIAL_ID, PALETAS_STORIES, paletaDaCorLivre, paletaOficial, paletaPorId, type PaletaStories } from '@/lib/stories-paleta'
import { cartazJogos, cartazMataMata, type CartazStories, type ChaveCartaz, type JogoCartaz } from '@/lib/stories-cartaz'
import estilos from '@/components/stories/stories.module.css'

type Props = {
  titulo: string
  montar: (opcoes: { incluirSumula: boolean; link: string }) => CartazStories
  oferecerSumula?: boolean
  versao?: string | number
}

export function BotaoStoriesInstagram({ titulo, montar, oferecerSumula = false, versao }: Props) {
  const [aberto, setAberto] = useState(false)
  const [paletaId, setPaletaId] = useState(PALETA_OFICIAL_ID)
  const [corLivre, setCorLivre] = useState<string | null>(null)
  const [incluirSumula, setIncluirSumula] = useState(false)
  const [aviso, setAviso] = useState('')
  const [enviando, setEnviando] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const botaoRef = useRef<HTMLButtonElement>(null)
  const painelRef = useRef<HTMLDivElement>(null)
  const montarRef = useRef(montar)
  const sumulaId = useId()
  const tituloId = useId()
  montarRef.current = montar
  const paleta = useMemo(() => (corLivre ? paletaDaCorLivre(corLivre) : paletaPorId(paletaId)), [corLivre, paletaId])

  function abrir() {
    setPaletaId(PALETA_OFICIAL_ID)
    setCorLivre(null)
    setIncluirSumula(false)
    setAviso('')
    setAberto(true)
  }

  useEffect(() => {
    if (!aberto || !canvasRef.current) return
    desenharCartaz(canvasRef.current, montarRef.current({ incluirSumula, link: linkDaPagina() }), paleta)
  }, [aberto, paleta, incluirSumula, versao])

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
    const canvas = canvasRef.current
    if (!canvas || enviando) return
    setEnviando(true)
    setAviso('')
    try {
      deepLinkStories()
      const arquivo = await arquivoDoCanvas(canvas)
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
      <button ref={botaoRef} type="button" className={estilos.botao} aria-label="Compartilhar nos stories do Instagram" onClick={abrir}>
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
            <canvas ref={canvasRef} className={estilos.previa} aria-label="Prévia da imagem para os stories" />
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

export function BotaoChaveStories({ chave, campeonato }: { chave: ChaveCartaz; campeonato?: string }) {
  const jogos = chave.rounds.reduce((total, round) => total + round.slots.length, 0)
  return (
    <BotaoStoriesInstagram
      titulo="Chave do mata-mata"
      versao={jogos}
      montar={({ link }) => cartazMataMata(chave, link, campeonato)}
    />
  )
}

export function BotaoJogosStories({ jogos, titulo = 'Jogos' }: { jogos: JogoCartaz[]; titulo?: string }) {
  return (
    <BotaoStoriesInstagram
      titulo={titulo}
      versao={jogos.map((jogo) => `${jogo.nomeA}${jogo.setsPorA ?? ''}${jogo.status}`).join('|')}
      montar={({ link }) => cartazJogos(jogos, link)}
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
