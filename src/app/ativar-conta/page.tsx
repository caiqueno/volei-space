'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Loader2, XCircle } from 'lucide-react'

type Status = 'loading' | 'success' | 'error'

export default function AtivarContaPage() {
  const [status, setStatus] = useState<Status>('loading')
  const [message, setMessage] = useState('Ativando sua conta...')
  const attempted = useRef(false)

  useEffect(() => {
    if (attempted.current) return
    attempted.current = true

    const token = new URLSearchParams(window.location.search).get('token') ?? ''
    if (!token) {
      setStatus('error')
      setMessage('Link de ativação inválido.')
      return
    }

    fetch('/api/auth/ativar-conta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
          setStatus('error')
          setMessage(json.error ?? 'Não foi possível ativar a conta.')
          return
        }
        setStatus('success')
        setMessage(json.data?.mensagem ?? 'Conta ativada com sucesso.')
        window.setTimeout(() => {
          window.location.href = '/painel'
        }, 1500)
      })
      .catch(() => {
        setStatus('error')
        setMessage('Não foi possível ativar a conta agora. Verifique sua conexão e tente novamente.')
      })
  }, [])

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#020611] px-5 py-8 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(239,159,39,0.18),transparent_30%),radial-gradient(circle_at_84%_12%,rgba(23,95,166,0.26),transparent_36%),linear-gradient(135deg,#020611_0%,#071a2f_56%,#03101f_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.22] [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:72px_72px]" />
      <section className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] max-w-lg flex-col justify-center">
        <div className="rounded-[1.5rem] border border-white/12 bg-[#071426]/92 p-6 text-center shadow-[0_24px_90px_rgba(0,0,0,0.45)] backdrop-blur">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-luva-amber">Ativação de conta</p>
          <h1 className="mt-2 font-display text-3xl font-black leading-tight text-white">
            {status === 'success' ? 'Conta ativada' : status === 'error' ? 'Não foi possível ativar' : 'Confirmando seu e-mail'}
          </h1>

          <div className="mt-6 flex flex-col items-center gap-3">
            {status === 'loading' && <Loader2 size={32} className="animate-spin text-luva-amber" />}
            {status === 'success' && <CheckCircle2 size={32} className="text-emerald-300" />}
            {status === 'error' && <XCircle size={32} className="text-red-300" />}
            <p className="text-sm font-semibold leading-6 text-white/78">{message}</p>
            {status === 'success' && <p className="text-xs font-bold text-white/55">Redirecionando para o seu painel...</p>}
          </div>

          {status === 'error' && (
            <Link href="/cadastro?modo=login" className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-luva-amber px-6 py-3 text-sm font-black uppercase tracking-wide text-[#061322] transition hover:-translate-y-0.5 hover:bg-amber-300">
              Ir para o login
            </Link>
          )}
        </div>
      </section>
    </main>
  )
}
