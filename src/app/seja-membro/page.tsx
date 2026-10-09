'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { ActionBar } from '@/components/ui/action-bar'

function formatarTelefone(telefone: string) {
  const digits = telefone.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 2) return digits ? `(${digits}` : ''
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

export default function SejaMembroPage() {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [erro, setErro] = useState('')

  async function enviar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (enviando) return
    setErro('')
    setEnviando(true)
    try {
      const resposta = await fetch('/api/candidaturas/organizadores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, email, telefone }),
      })
      const json = await resposta.json().catch(() => ({}))
      if (!resposta.ok) {
        setErro(json.error || 'Não foi possível enviar o cadastro.')
        setEnviando(false)
        return
      }
      setEnviado(true)
    } catch {
      setErro('Falha na conexão. Tente novamente.')
      setEnviando(false)
    }
  }

  return (
    <main className="admin-login-shell flex min-h-screen items-center justify-center px-4 py-10">
      <section className="admin-login-form w-full max-w-md rounded-[2rem] border p-6 sm:p-10">
        <div className="mb-8 text-center">
          <span className="relative mx-auto flex h-20 w-20 overflow-hidden rounded-2xl">
            <Image src="/brand/volei-space_simbolo-orbital_transparente.png" alt="volei.space" fill sizes="80px" className="object-contain" />
          </span>
          <h1 className="mt-5 text-3xl font-black text-white">Seja um organizador de campeonatos</h1>
        </div>
        {enviado ? (
          <div className="grid gap-4 text-center">
            <p className="text-sm font-semibold leading-6 text-slate-200">Cadastro enviado. O administrador precisa liberar o seu acesso de organizador.</p>
            <Link href="/login" className="text-sm font-black text-white underline">Voltar para entrar</Link>
          </div>
        ) : (
          <form onSubmit={enviar} className="grid gap-4">
            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-[0.18em] text-luva-amber">Nome</span>
              <input required value={nome} onChange={(event) => setNome(event.target.value)} className="admin-login-input rounded-2xl px-4 py-4 text-base font-semibold outline-none" />
            </label>
            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-[0.18em] text-luva-amber">E-mail</span>
              <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="admin-login-input rounded-2xl px-4 py-4 text-base font-semibold outline-none" />
            </label>
            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-[0.18em] text-luva-amber">Telefone</span>
              <input required inputMode="tel" value={telefone} onChange={(event) => setTelefone(formatarTelefone(event.target.value))} className="admin-login-input rounded-2xl px-4 py-4 text-base font-semibold outline-none" />
            </label>
            {erro && <p className="text-sm font-bold text-red-200">{erro}</p>}
            <ActionBar type="submit" loading={enviando} loadingLabel="Enviando" className="admin-login-button mt-2 inline-flex w-full items-center justify-center rounded-2xl px-5 py-4 text-sm font-black uppercase tracking-wide">
              Enviar cadastro
            </ActionBar>
          </form>
        )}
      </section>
    </main>
  )
}
