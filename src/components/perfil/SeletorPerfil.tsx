'use client'

import { useEffect, useRef, useState } from 'react'
import { listarPerfis, trocarPerfil } from '@/components/login-sem-senha/cliente'
import {
  descricaoDoPerfil,
  destinoDoPerfil,
  loginSemSenhaAtivo,
  rotuloDoPerfil,
  type Perfil,
} from '@/lib/login-sem-senha-ui/regras'

/** Mostra o perfil ativo e, havendo mais de um, deixa trocar entre Líder e Organizador. Flag desligada: não renderiza nada e não faz requisição. */
export function SeletorPerfil() {
  const ativaFlag = loginSemSenhaAtivo()
  const [perfis, setPerfis] = useState<Perfil[]>([])
  const [ativo, setAtivo] = useState<Perfil | null>(null)
  const [aberto, setAberto] = useState(false)
  const [erro, setErro] = useState('')
  const [trocando, setTrocando] = useState(false)
  const raiz = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ativaFlag) return
    let vivo = true
    void listarPerfis().then((r) => {
      if (!vivo || !r.ok) return
      setPerfis(r.dados.perfis)
      setAtivo(r.dados.perfilAtivo ?? r.dados.perfis[0] ?? null)
    })
    return () => { vivo = false }
  }, [ativaFlag])

  useEffect(() => {
    if (!aberto) return
    const fechar = (e: KeyboardEvent) => e.key === 'Escape' && setAberto(false)
    const fora = (e: MouseEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('keydown', fechar)
    document.addEventListener('mousedown', fora)
    return () => {
      document.removeEventListener('keydown', fechar)
      document.removeEventListener('mousedown', fora)
    }
  }, [aberto])

  if (!ativaFlag || !ativo) return null

  async function escolher(p: Perfil) {
    if (trocando) return
    if (ativo && p.perfil === ativo.perfil && p.referenciaId === ativo.referenciaId) {
      setAberto(false)
      return
    }
    setTrocando(true)
    setErro('')
    const r = await trocarPerfil(p)
    if (!r.ok) {
      setErro(r.mensagem)
      setTrocando(false)
      return
    }
    try {
      if (p.perfil === 'ORGANIZADOR') window.localStorage.setItem('luva_session', JSON.stringify({ tipo: 'organizador', perfil: 'organizador' }))
      else window.localStorage.removeItem('luva_session')
    } catch { /* sem armazenamento local */ }
    window.location.assign(destinoDoPerfil(p.perfil))
  }

  const podeTrocar = perfis.length > 1
  return (
    <div ref={raiz} className="relative border-b border-[var(--vs-border)] bg-[var(--vs-bg)] px-3 py-2 text-[var(--vs-text)]">
      <div className="mx-auto flex max-w-xl items-center justify-end">
        <button
          type="button"
          aria-expanded={aberto}
          aria-controls="menu-perfil"
          aria-label={`Perfil ativo: ${rotuloDoPerfil(ativo)}${podeTrocar ? '. Trocar de perfil' : ''}`}
          onClick={() => setAberto((v) => !v)}
          className="inline-flex min-h-[44px] max-w-full items-center gap-2 rounded-xl border border-[var(--vs-border-strong)] px-3 text-sm font-bold hover:bg-[var(--vs-elevated)]"
        >
          <span className="truncate">{rotuloDoPerfil(ativo)}</span>
          <span aria-hidden="true">{aberto ? '▲' : '▼'}</span>
        </button>
      </div>
      {aberto && (
        <div id="menu-perfil" role="region" aria-label="Perfis" className="absolute right-3 z-40 mt-1 grid w-[min(92vw,20rem)] gap-1 rounded-2xl border border-[var(--vs-border)] bg-[var(--vs-surface)] p-2 shadow-lg">
          {podeTrocar ? (
            <>
              <p className="px-2 text-xs font-black uppercase tracking-wide text-[var(--vs-muted)]">Entrar como</p>
              {perfis.map((p) => {
                const atual = p.perfil === ativo.perfil && p.referenciaId === ativo.referenciaId
                return (
                  <button
                    key={`${p.perfil}:${p.referenciaId}`}
                    type="button"
                    disabled={trocando}
                    aria-current={atual ? 'true' : undefined}
                    onClick={() => void escolher(p)}
                    className={`flex min-h-[44px] flex-col items-start justify-center rounded-xl px-3 text-left hover:bg-[var(--vs-elevated)] disabled:opacity-60 ${atual ? 'bg-[var(--vs-elevated)]' : ''}`}
                  >
                    <span className="text-sm font-black">{rotuloDoPerfil(p)}{atual ? ' (ativo)' : ''}</span>
                    <span className="text-xs text-[var(--vs-muted)]">{descricaoDoPerfil(p.perfil)}</span>
                  </button>
                )
              })}
            </>
          ) : (
            <p className="px-2 py-1 text-sm">Você só tem o perfil {rotuloDoPerfil(ativo)}.</p>
          )}
          {erro && <p role="alert" className="px-2 text-sm font-bold text-[var(--vs-error-fg)]">{erro}</p>}
        </div>
      )}
    </div>
  )
}
