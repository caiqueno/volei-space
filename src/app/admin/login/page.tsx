'use client'

import Image from 'next/image'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertCircle, Loader2, LockKeyhole } from 'lucide-react'

export default function AdminLoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErro('')
    setLoading(true)

    const fd = new FormData(e.currentTarget)
    try {
      const res = await fetch('/api/auth?admin=1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: fd.get('email'), senha: fd.get('senha') }),
      })
      const json = await res.json().catch(() => ({}))

      if (!res.ok) {
        setErro(json.error ?? json.message ?? 'Nao foi possivel autenticar.')
        return
      }

      if (!json.data?.admin) {
        setErro('Este login nao tem permissao de administrador.')
        return
      }

      const next = searchParams.get('next')
      router.push(next?.startsWith('/admin') ? next : '/admin')
      router.refresh()
    } catch {
      setErro('Falha na conexao. Tente novamente em instantes.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="admin-login-shell flex min-h-screen items-center justify-center px-4 py-10">
      <div className="admin-login-panel grid w-full max-w-5xl overflow-hidden rounded-[2rem] border lg:grid-cols-[0.95fr_1.05fr]">
        <section className="relative hidden min-h-[560px] overflow-hidden p-8 text-white lg:block">
          <Image src="/brand/volei-space_fundo-quadrado.png" alt="volei.space" fill sizes="480px" className="object-cover opacity-25" />
          <div className="absolute inset-0 bg-gradient-to-br from-[#050914]/92 via-[#071322]/88 to-[#102033]/94" />
          <div className="relative z-10 flex h-full flex-col justify-end pb-2">
            <h1 className="max-w-md text-5xl font-black leading-tight text-white">Controle completo da sua temporada.</h1>
            <p className="mt-4 max-w-sm text-sm font-semibold leading-7 text-slate-200">
              Campeonatos, candidaturas, partidas, atletas, QR Codes e sumulas em uma operacao centralizada.
            </p>
          </div>
        </section>

        <section className="admin-login-form p-6 sm:p-10 lg:p-12">
          <div className="mx-auto max-w-sm">
            <div className="mb-8 text-center">
              <span className="relative mx-auto flex h-20 w-20 overflow-hidden rounded-2xl">
                <Image src="/brand/volei-space_simbolo-orbital_transparente.png" alt="volei.space" fill sizes="80px" className="object-contain" />
              </span>
              <h2 className="mt-5 text-4xl font-black text-white">volei.space Admin</h2>
              <p className="mt-2 text-sm font-semibold text-slate-300">Acesso restrito da organizacao</p>
            </div>

            <form onSubmit={handleSubmit} className="grid gap-4">
              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-luva-amber">E-mail</span>
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  className="admin-login-input rounded-2xl px-4 py-4 text-sm font-semibold outline-none transition"
                  placeholder="admin@luv.com.br"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-luva-amber">Senha</span>
                <input
                  name="senha"
                  type="password"
                  required
                  autoComplete="current-password"
                  className="admin-login-input rounded-2xl px-4 py-4 text-sm font-semibold outline-none transition"
                />
              </label>

              {erro && (
                <p className="flex items-start gap-2 rounded-2xl border border-red-400/35 bg-red-500/14 px-4 py-3 text-sm font-bold leading-6 text-red-50">
                  <AlertCircle className="mt-0.5 shrink-0 text-red-200" size={18} />
                  <span>{erro}</span>
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="admin-login-button mt-2 inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-4 text-sm font-black uppercase tracking-wide transition disabled:opacity-60"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : <LockKeyhole size={18} />}
                {loading ? 'Entrando...' : 'Entrar no painel'}
              </button>
            </form>
          </div>
        </section>
      </div>
    </main>
  )
}
