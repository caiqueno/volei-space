'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { faseDoisAtiva } from '@/lib/meu-time-fase2-ui/flag'
import { itemAtual, itensVisiveis } from '@/lib/meu-time-fase2-ui/navegacao'
import { contarNaoLidas, rotuloSino, textoContador } from '@/lib/meu-time-fase2-ui/notificacoes'
import type { Notificacao } from '@/lib/meu-time-fase2-ui/tipos'
import { obterClienteFase2 } from './cliente'
import { ListaNotificacoes } from './Notificacoes'

function Sino() {
  const [itens, setItens] = useState<Notificacao[] | null>(null)
  const [aberto, setAberto] = useState(false)
  const [erro, setErro] = useState(false)
  const raiz = useRef<HTMLDivElement>(null)

  const carregar = useCallback(async () => {
    try {
      setItens(await obterClienteFase2().listarNotificacoes())
      setErro(false)
    } catch {
      setErro(true)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  useEffect(() => {
    if (!aberto) return
    const fechar = (e: KeyboardEvent) => e.key === 'Escape' && setAberto(false)
    document.addEventListener('keydown', fechar)
    return () => document.removeEventListener('keydown', fechar)
  }, [aberto])

  const naoLidas = itens ? contarNaoLidas(itens) : 0
  return (
    <div ref={raiz} className="relative">
      <button
        type="button"
        aria-expanded={aberto}
        aria-controls="painel-notificacoes"
        aria-label={rotuloSino(naoLidas)}
        onClick={() => setAberto((v) => !v)}
        className="relative inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-[var(--vs-border-strong)] text-[var(--vs-text)] hover:bg-[var(--vs-elevated)]"
      >
        <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {naoLidas > 0 && (
          <span aria-hidden="true" className="absolute -right-1 -top-1 min-w-[20px] rounded-full bg-[var(--vs-gold)] px-1 text-center text-xs font-black text-[var(--vs-on-gold)]">
            {textoContador(naoLidas)}
          </span>
        )}
      </button>
      {aberto && (
        <div id="painel-notificacoes" role="region" aria-label="Lista de notificações" className="absolute right-0 z-40 mt-2 flex max-h-[70vh] w-[min(92vw,22rem)] flex-col gap-3 overflow-y-auto rounded-2xl border border-[var(--vs-border)] bg-[var(--vs-surface)] p-3 shadow-lg">
          {erro && <p role="alert" className="text-sm font-bold text-[var(--vs-error-fg)]">Não deu para buscar as notificações agora.</p>}
          {itens && (
            <ListaNotificacoes
              itens={itens.slice(0, 5)}
              aoMarcar={async (id) => {
                await obterClienteFase2().marcarLida(id)
                await carregar()
              }}
            />
          )}
          <Link href="/meu-time/notificacoes" onClick={() => setAberto(false)} className="inline-flex min-h-[44px] items-center text-sm font-bold text-[var(--vs-gold)] underline">
            Ver todas
          </Link>
        </div>
      )}
    </div>
  )
}

export function NavMeuTime() {
  const caminho = usePathname() ?? ''
  const ativa = faseDoisAtiva()
  const itens = itensVisiveis(ativa)
  // Flag desligada: nada novo aparece, a tela segue como era.
  if (!ativa) return null
  return (
    <nav aria-label="Meu Time" className="border-b border-[var(--vs-border)] bg-[var(--vs-bg)] px-3 py-2 text-[var(--vs-text)]">
      <div className="mx-auto flex max-w-xl items-center gap-2">
        <ul className="flex flex-1 gap-1 overflow-x-auto">
          {itens.map((i) => {
            const atual = itemAtual(caminho, i)
            return (
              <li key={i.rotulo} className="shrink-0">
                <Link
                  href={i.href}
                  aria-current={atual ? 'page' : undefined}
                  className={`inline-flex min-h-[44px] items-center rounded-xl px-3 text-sm font-bold ${atual ? 'bg-[var(--vs-elevated)] text-[var(--vs-gold)] underline' : 'text-[var(--vs-text)] hover:bg-[var(--vs-elevated)]'}`}
                >
                  {i.rotulo}
                </Link>
              </li>
            )
          })}
        </ul>
        {ativa && <Sino />}
      </div>
    </nav>
  )
}
