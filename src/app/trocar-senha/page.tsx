'use client'

import Image from 'next/image'
import { useState } from 'react'
import { AlertCircle, LockKeyhole } from 'lucide-react'
import { ActionBar } from '@/components/ui/action-bar'

export default function TrocarSenhaPage() {
  const [senha, setSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErro('')
    if (senha.length < 8) {
      setErro('A senha nova precisa ter pelo menos 8 caracteres.')
      return
    }
    if (senha !== confirmarSenha) {
      setErro('As senhas não coincidem.')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/auth/trocar-senha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senha, confirmarSenha }),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok) {
        setErro(json.error ?? 'Não foi possível substituir a senha.')
        return
      }

      try {
        const stored = JSON.parse(window.localStorage.getItem('luva_session') ?? 'null')
        if (stored && typeof stored === 'object') {
          window.localStorage.setItem('luva_session', JSON.stringify({ ...stored, trocarSenha: false }))
        }
      } catch {
        window.localStorage.removeItem('luva_session')
      }

      window.location.href = json.data?.redirectTo || '/painel'
    } catch {
      setErro('Falha na conexão. Tente novamente em instantes.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="admin-login-shell flex min-h-screen items-center justify-center px-4 py-10">
      <section className="admin-login-form w-full max-w-md rounded-[2rem] border p-6 sm:p-10">
        <div className="mb-8 text-center">
          <span className="relative mx-auto flex h-20 w-20 overflow-hidden rounded-2xl">
            <Image src="/brand/volei-space_simbolo-orbital_transparente.png" alt="volei.space" fill sizes="80px" className="object-contain" />
          </span>
          <h1 className="mt-5 text-4xl font-black text-white">Substituir a senha</h1>
          <p className="mt-3 text-sm font-semibold leading-6 text-slate-300">
            Substitua a senha por uma senha nova.
          </p>
        </div>

        <form autoComplete="off" onSubmit={handleSubmit} className="grid gap-4">
          <label className="grid gap-2">
            <span className="text-xs font-black uppercase tracking-[0.18em] text-luva-amber">Senha nova</span>
            <input
              name="senha-nova"
              type="password"
              required
              minLength={8}
              disabled={loading}
              autoComplete="new-password"
              value={senha}
              onChange={(event) => setSenha(event.target.value)}
              className="admin-login-input rounded-2xl px-4 py-4 text-base font-semibold outline-none transition"
              placeholder="Digite a senha nova aqui"
            />
          </label>
          <label className="grid gap-2">
            <span className="text-xs font-black uppercase tracking-[0.18em] text-luva-amber">Confirmar senha</span>
            <input
              name="confirmar-senha-nova"
              type="password"
              required
              minLength={8}
              disabled={loading}
              autoComplete="new-password"
              value={confirmarSenha}
              onChange={(event) => setConfirmarSenha(event.target.value)}
              className="admin-login-input rounded-2xl px-4 py-4 text-base font-semibold outline-none transition"
              placeholder="Repita a senha nova"
            />
          </label>

          {erro && (
            <p className="flex items-start gap-2 rounded-2xl border border-red-400/35 bg-red-500/14 px-4 py-3 text-sm font-bold leading-6 text-red-50">
              <AlertCircle className="mt-0.5 shrink-0 text-red-200" size={18} />
              <span>{erro}</span>
            </p>
          )}

          <ActionBar
            type="submit"
            loading={loading}
            loadingLabel="Substituindo"
            className="admin-login-button mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-4 text-sm font-black uppercase tracking-wide transition disabled:opacity-60"
          >
            <LockKeyhole size={18} />
            Substituir senha
          </ActionBar>
        </form>
      </section>
    </main>
  )
}
