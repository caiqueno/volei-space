'use client'

import { FormEvent, useEffect, useState } from 'react'
import { ActionBar } from '@/components/ui/action-bar'

type RefereeAccount = {
  id: string
  nome: string
  email: string
  status: string
}

export function ArbitrosPanel() {
  const [accounts, setAccounts] = useState<RefereeAccount[]>([])
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [senhas, setSenhas] = useState<Record<string, string>>({})
  const [resetando, setResetando] = useState<string | null>(null)

  async function loadAccounts() {
    const response = await fetch('/api/organizador/arbitros', { cache: 'no-store' })
    const json = await response.json().catch(() => ({}))
    if (response.ok) setAccounts(json.data ?? [])
  }

  useEffect(() => {
    void loadAccounts()
  }, [])

  async function saveAccount(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setMessage('')
    setErrorMessage('')
    const response = await fetch('/api/organizador/arbitros', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, email, senha }),
    })
    const json = await response.json().catch(() => ({}))
    setLoading(false)
    if (!response.ok) {
      setErrorMessage(json.error ?? 'Não foi possível criar o acesso do árbitro.')
      return
    }
    setMessage(json.data?.atualizado
      ? `Senha atualizada para ${json.data.email}. Na próxima entrada ele substitui por uma senha nova.`
      : `Acesso criado para ${json.data?.email}. Passe o usuário e a senha. Na primeira entrada ele substitui por uma senha nova.`)
    setNome('')
    setEmail('')
    setSenha('')
    await loadAccounts()
  }

  async function resetPassword(item: RefereeAccount) {
    const novaSenha = (senhas[item.id] ?? '').trim()
    if (novaSenha.length < 8) {
      setErrorMessage('A senha nova precisa ter pelo menos 8 caracteres.')
      setMessage('')
      return
    }
    setResetando(item.id)
    setMessage('')
    setErrorMessage('')
    const response = await fetch('/api/organizador/arbitros', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, senha: novaSenha }),
    })
    const json = await response.json().catch(() => ({}))
    setResetando(null)
    if (!response.ok) {
      setErrorMessage(json.error ?? 'Não foi possível resetar a senha.')
      return
    }
    setSenhas((current) => ({ ...current, [item.id]: '' }))
    setMessage(`Senha resetada para ${item.email}. Passe essa senha ao árbitro. Na próxima entrada ele substitui por uma senha nova.`)
    await loadAccounts()
  }

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <section className="luva-card rounded-2xl p-6 sm:p-8">
        <h2 className="text-2xl font-black text-white">Árbitros</h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-300">
          Cadastre o árbitro e crie o usuário e a senha dele. Ele entra na mesma tela de identificação e abre o painel de partidas.
        </p>
        <form onSubmit={saveAccount} className="mt-5 grid gap-3">
          <input required value={nome} onChange={(event) => setNome(event.target.value)} placeholder="Nome do árbitro" className="creator-input rounded-2xl border px-4 py-3 font-bold" />
          <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Usuário (e-mail)" className="creator-input rounded-2xl border px-4 py-3 font-bold" />
          <input required type="text" minLength={8} value={senha} onChange={(event) => setSenha(event.target.value)} placeholder="Senha com pelo menos 8 caracteres" className="creator-input rounded-2xl border px-4 py-3 font-bold" />
          <ActionBar type="submit" loading={loading} loadingLabel="Criando acesso" className="inline-flex items-center justify-center rounded-full bg-luva-amber px-4 py-3 text-sm font-black text-[#050914] disabled:opacity-60">
            Criar acesso
          </ActionBar>
        </form>
        {message && <p className="mt-4 text-sm font-bold text-emerald-300">{message}</p>}
        {errorMessage && <p className="mt-4 text-sm font-bold text-red-300">{errorMessage}</p>}
      </section>

      <section className="grid gap-3">
        {accounts.length === 0 && <p className="text-sm font-semibold text-slate-400">Nenhum árbitro cadastrado ainda.</p>}
        {accounts.map((item) => (
          <article key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="font-black text-white">{item.nome}</p>
            <p className="mt-1 text-sm font-semibold text-slate-300">{item.email} · {item.status}</p>
            <form
              onSubmit={(event) => {
                event.preventDefault()
                void resetPassword(item)
              }}
              className="mt-3 flex flex-col gap-2 sm:flex-row"
            >
              <input
                type="text"
                minLength={8}
                value={senhas[item.id] ?? ''}
                onChange={(event) => setSenhas((current) => ({ ...current, [item.id]: event.target.value }))}
                placeholder="Senha nova"
                className="creator-input rounded-2xl border px-4 py-3 font-bold sm:max-w-xs"
              />
              <ActionBar type="submit" loading={resetando === item.id} loadingLabel="Resetando" className="rounded-full border border-white/10 px-4 py-3 text-sm font-black text-white">
                Resetar senha
              </ActionBar>
            </form>
          </article>
        ))}
      </section>
    </div>
  )
}
