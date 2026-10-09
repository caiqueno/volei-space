'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { AlertCircle, LockKeyhole } from 'lucide-react'
import { ActionBar } from '@/components/ui/action-bar'
import { loginDestination } from '@/lib/login-destination'
import { lerSessaoPublica } from '@/lib/sessao-publica'

export function LoginScreen() {
  const searchParams = useSearchParams()
  const contaCriada = searchParams.get('conta') === 'criada'
  const [etapa, setEtapa] = useState<'escolha' | 'membro'>(searchParams.get('modo') === 'membro' || searchParams.get('conta') === 'criada' ? 'membro' : 'escolha')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')

  useEffect(() => {
    const sessao = lerSessaoPublica()
    if (sessao?.tipo) {
      window.location.replace(loginDestination(sessao.tipo, Boolean(sessao.trocarSenha)))
    }
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (loading) return
    setErro('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha }),
      })
      const json = await res.json().catch(() => ({}))

      if (!res.ok) {
        setErro(json.error ?? 'Usuário ou senha não conferem.')
        setLoading(false)
        return
      }

      if (json.data?.admin) {
        const next = searchParams.get('next')
        const destino = next?.startsWith('/admin') && !next.startsWith('/admin/login') ? next : '/admin'
        window.location.assign(destino)
        return
      }

      if (json.data?.user) {
        window.localStorage.setItem('luva_session', JSON.stringify(json.data.user))
      }

      const destino = typeof json.data?.redirectTo === 'string'
        ? json.data.redirectTo
        : loginDestination(json.data?.user?.tipo ?? '', Boolean(json.data?.user?.trocarSenha))
      window.location.assign(destino)
    } catch {
      setErro('Falha na conexão. Tente novamente em instantes.')
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
            <h1 className="max-w-md text-5xl font-black leading-tight text-white">Onde a gestão do voleibol acontece.</h1>
            <p className="mt-4 max-w-sm text-sm font-semibold leading-7 text-slate-200">
              Organize campeonatos, conecte equipes e transforme operações complexas em uma experiência simples, moderna e eficiente.
            </p>
          </div>
        </section>

        <section className="admin-login-form p-6 sm:p-10 lg:p-12">
          <div className="mx-auto max-w-sm">
            <div className="mb-8 text-center">
              <span className="relative mx-auto flex h-20 w-20 overflow-hidden rounded-2xl">
                <Image src="/brand/volei-space_simbolo-orbital_transparente.png" alt="volei.space" fill sizes="80px" className="object-contain" />
              </span>
              <h2 className="mt-5 text-4xl font-black text-white">{etapa === 'membro' ? 'Entrar como membro' : 'Entrar'}</h2>
              {etapa === 'escolha' ? (
                <p className="mt-3 text-sm font-semibold leading-6 text-slate-300">Escolha como você quer continuar.</p>
              ) : (
                <button type="button" onClick={() => setEtapa('escolha')} className="mt-3 text-xs font-semibold text-slate-300 underline decoration-white/30 underline-offset-4 transition hover:text-white">
                  Voltar
                </button>
              )}
              {contaCriada && (
                <p className="cadastro-field-ok mt-4 text-sm font-semibold leading-6">
                  Conta criada. Entre com o e-mail e a senha que você acabou de definir.
                </p>
              )}
            </div>

            {etapa === 'escolha' ? (
              <div className="grid gap-3">
                <button type="button" onClick={() => setEtapa('membro')} className="admin-login-button inline-flex w-full items-center justify-center rounded-2xl px-5 py-4 text-sm font-black uppercase tracking-wide">
                  Membro
                </button>
                <Link href="/seja-membro" className="inline-flex w-full items-center justify-center rounded-2xl border border-white/15 px-5 py-4 text-sm font-black uppercase tracking-wide text-white">
                  Seja membro
                </Link>
              </div>
            ) : null}

            {etapa === 'membro' && <form autoComplete="off" onSubmit={handleSubmit} className="grid gap-4">
              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-luva-amber">E-mail</span>
                <input
                  name="acesso-email"
                  type="email"
                  required
                  disabled={loading}
                  autoComplete="username"
                  inputMode="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="admin-login-input rounded-2xl px-4 py-4 text-base font-semibold outline-none transition"
                  placeholder="Coloque seu usuário aqui"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-luva-amber">Senha</span>
                <input
                  name="acesso-senha"
                  type="password"
                  required
                  disabled={loading}
                  autoComplete="current-password"
                  value={senha}
                  onChange={(event) => setSenha(event.target.value)}
                  className="admin-login-input rounded-2xl px-4 py-4 text-base font-semibold outline-none transition"
                  placeholder="Coloque sua senha aqui"
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
                loadingLabel="Entrando"
                className="admin-login-button mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-4 text-sm font-black uppercase tracking-wide transition disabled:opacity-60"
              >
                <LockKeyhole size={18} />
                Entrar
              </ActionBar>
            </form>}
          </div>
        </section>
      </div>
    </main>
  )
}
