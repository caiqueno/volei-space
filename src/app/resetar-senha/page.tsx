'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { ArrowLeft, CheckCircle2, LockKeyhole } from 'lucide-react'

export default function ResetarSenhaPage() {
  const token = useMemo(() => {
    if (typeof window === 'undefined') return ''
    return new URLSearchParams(window.location.search).get('token') ?? ''
  }, [])
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setFeedback(null)
    if (!token) {
      setFeedback({ type: 'error', text: 'Link de recuperação inválido.' })
      return
    }
    if (senha.length < 8) {
      setFeedback({ type: 'error', text: 'Use uma senha com pelo menos 8 caracteres.' })
      return
    }
    if (senha !== confirmacao) {
      setFeedback({ type: 'error', text: 'As senhas informadas não conferem.' })
      return
    }

    setLoading(true)
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, senha }),
    })
    const json = await res.json().catch(() => ({}))
    setLoading(false)
    setFeedback({
      type: res.ok ? 'success' : 'error',
      text: json.data?.mensagem ?? json.error ?? 'Não foi possível redefinir a senha.',
    })
    if (res.ok) {
      setSenha('')
      setConfirmacao('')
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#020611] px-5 py-8 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(239,159,39,0.18),transparent_30%),radial-gradient(circle_at_84%_12%,rgba(23,95,166,0.26),transparent_36%),linear-gradient(135deg,#020611_0%,#071a2f_56%,#03101f_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.22] [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:72px_72px]" />
      <section className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] max-w-lg flex-col justify-center">
        <Link href="/cadastro?modo=login" className="mb-6 inline-flex w-fit items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3.5 py-2 text-sm font-black text-white transition hover:bg-luva-amber hover:text-[#07101f]">
          <ArrowLeft size={16} />
          Voltar ao login
        </Link>

        <form onSubmit={submit} className="rounded-[1.5rem] border border-white/12 bg-[#071426]/92 p-5 shadow-[0_24px_90px_rgba(0,0,0,0.45)] backdrop-blur">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-luva-amber">Recuperacao de senha</p>
          <h1 className="mt-2 font-display text-3xl font-black leading-tight text-white">Crie uma nova senha</h1>
          <p className="mt-2 text-sm font-semibold leading-6 text-white/74">Informe uma senha nova para sua conta administrativa da volei.space.</p>

          <div className="mt-6 space-y-4">
            <label>
              <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-white/78">Nova senha</span>
              <div className="relative">
                <LockKeyhole className="absolute left-4 top-1/2 -translate-y-1/2 text-white/58" size={18} />
                <input
                  required
                  type="password"
                  value={senha}
                  onChange={(event) => setSenha(event.target.value)}
                  className="w-full rounded-xl border border-white/18 !bg-[#071426] px-3.5 py-2.5 pl-12 text-sm font-bold !text-white outline-none transition placeholder:!text-white/45 focus:border-luva-amber focus:!bg-[#0b1c33] focus:ring-4 focus:ring-luva-amber/20"
                  placeholder="Minimo de 8 caracteres"
                />
              </div>
            </label>

            <label>
              <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-white/78">Confirmar senha</span>
              <input
                required
                type="password"
                value={confirmacao}
                onChange={(event) => setConfirmacao(event.target.value)}
                className="w-full rounded-xl border border-white/18 !bg-[#071426] px-3.5 py-2.5 text-sm font-bold !text-white outline-none transition placeholder:!text-white/45 focus:border-luva-amber focus:!bg-[#0b1c33] focus:ring-4 focus:ring-luva-amber/20"
                placeholder="Repita a nova senha"
              />
            </label>
          </div>

          <button type="submit" disabled={loading} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-luva-amber px-6 py-3 text-sm font-black uppercase tracking-wide text-[#061322] transition hover:-translate-y-0.5 hover:bg-amber-300 disabled:opacity-50">
            {loading ? 'Salvando...' : 'Redefinir senha'}
          </button>

          {feedback && (
            <div className={`mt-5 flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm font-bold ${feedback.type === 'success' ? 'border-emerald-300/40 bg-emerald-500/12 text-emerald-100' : 'border-red-300/40 bg-red-500/12 text-red-100'}`}>
              {feedback.type === 'success' && <CheckCircle2 size={18} className="mt-0.5 shrink-0" />}
              <span>{feedback.text}</span>
            </div>
          )}
        </form>
      </section>
    </main>
  )
}
