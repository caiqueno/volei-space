'use client'

import { FormEvent, useEffect, useState } from 'react'
import { ActionBar } from '@/components/ui/action-bar'

type OrganizerAccount = {
  id: string
  nome: string
  email: string
  status: string
}

export default function AdminAcessosPage() {
  const [accounts, setAccounts] = useState<OrganizerAccount[]>([])
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [senhas, setSenhas] = useState<Record<string, string>>({})
  const [resetando, setResetando] = useState<string | null>(null)

  async function loadAccounts() {
    const response = await fetch('/api/admin/organizadores')
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
    const response = await fetch('/api/admin/organizadores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, email, senha }),
    })
    const json = await response.json().catch(() => ({}))
    setLoading(false)
    if (!response.ok) {
      setMessage(json.error ?? 'Não foi possível atribuir o acesso.')
      return
    }
    setMessage(json.data.atualizado
      ? `Senha atualizada para ${json.data.email}.`
      : `Conta criada para ${json.data.email}. Passe o usuário e a senha ao organizador.`)
    setNome('')
    setEmail('')
    setSenha('')
    await loadAccounts()
  }

  async function resetPassword(item: OrganizerAccount) {
    const senha = (senhas[item.id] ?? '').trim()
    if (senha.length < 8) {
      setMessage('A senha nova precisa ter pelo menos 8 caracteres.')
      return
    }
    setResetando(item.id)
    setMessage('')
    const response = await fetch('/api/admin/organizadores', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, senha }),
    })
    const json = await response.json().catch(() => ({}))
    setResetando(null)
    if (!response.ok) {
      setMessage(json.error ?? 'Não foi possível resetar a senha.')
      return
    }
    setSenhas((current) => ({ ...current, [item.id]: '' }))
    setMessage(`Senha resetada para ${item.email}. Passe essa senha ao organizador. Na próxima entrada ele substitui por uma senha nova.`)
    await loadAccounts()
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h1 className="text-2xl font-black text-slate-950">Acesso do organizador</h1>
        <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
          Atribua o usuário e a senha de quem gerencia o evento. O organizador não cria essa conta. Na primeira entrada, ele substitui essa senha por uma senha nova. Criar conta no site é só para o público.
        </p>
        <form onSubmit={saveAccount} className="mt-5 grid gap-3 md:grid-cols-4">
          <input required value={nome} onChange={(event) => setNome(event.target.value)} placeholder="Nome" className="rounded-xl border border-slate-300 px-3 py-3 text-sm font-semibold" />
          <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Usuário (e-mail)" className="rounded-xl border border-slate-300 px-3 py-3 text-sm font-semibold" />
          <input required type="text" minLength={8} value={senha} onChange={(event) => setSenha(event.target.value)} placeholder="Senha" className="rounded-xl border border-slate-300 px-3 py-3 text-sm font-semibold" />
          <ActionBar type="submit" loading={loading} loadingLabel="Atribuindo" className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white disabled:opacity-50">
            Atribuir acesso
          </ActionBar>
        </form>
        {message && <p className="mt-4 text-sm font-bold text-slate-800">{message}</p>}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Usuário</th>
              <th className="px-4 py-3">Situação</th>
              <th className="px-4 py-3">Resetar senha</th>
            </tr>
          </thead>
          <tbody>
            {accounts.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 font-semibold text-slate-500">Nenhum organizador atribuído ainda.</td>
              </tr>
            )}
            {accounts.map((item) => (
              <tr key={item.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-black text-slate-950">{item.nome}</td>
                <td className="px-4 py-3 font-semibold text-slate-700">{item.email}</td>
                <td className="px-4 py-3 font-semibold text-slate-700">{item.status}</td>
                <td className="px-4 py-3">
                  <form
                    onSubmit={(event) => {
                      event.preventDefault()
                      void resetPassword(item)
                    }}
                    className="flex flex-col gap-2 sm:flex-row sm:items-center"
                  >
                    <input
                      type="text"
                      minLength={8}
                      value={senhas[item.id] ?? ''}
                      onChange={(event) => setSenhas((current) => ({ ...current, [item.id]: event.target.value }))}
                      placeholder="Senha nova"
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold sm:w-40"
                    />
                    <ActionBar
                      type="submit"
                      loading={resetando === item.id}
                      loadingLabel="Resetando"
                      disabled={resetando !== null && resetando !== item.id}
                      className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white disabled:opacity-50"
                    >
                      Resetar senha
                    </ActionBar>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
