'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useParams, useRouter } from 'next/navigation'

type Jogo = {
  equipeA: string
  equipeB: string
  dataHora: string | null
  localNome: string | null
}

export default function AcessoArbitroPage() {
  const { token } = useParams<{ token: string }>()
  const router = useRouter()
  const [jogo, setJogo] = useState<Jogo | null>(null)
  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState('')
  const [revogado, setRevogado] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [entrando, setEntrando] = useState(false)
  const [validado, setValidado] = useState(false)

  useEffect(() => {
    let ativo = true
    fetch(`/api/arbitro/jogo/${token}`)
      .then(async (resposta) => {
        const json = await resposta.json().catch(() => ({}))
        if (!ativo) return
        if (resposta.status === 410) {
          setRevogado(true)
          return
        }
        if (!resposta.ok) {
          setErro(json.error ?? 'Link de acesso inválido.')
          return
        }
        setJogo(json.data.jogo)
      })
      .catch(() => {
        if (ativo) setErro('Link de acesso inválido.')
      })
      .finally(() => {
        if (ativo) setCarregando(false)
      })
    return () => {
      ativo = false
    }
  }, [token])

  async function entrar(evento: FormEvent) {
    evento.preventDefault()
    setEntrando(true)
    setErro('')
    try {
      const resposta = await fetch(`/api/arbitro/jogo/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo }),
      })
      const json = await resposta.json().catch(() => ({}))
      if (!resposta.ok) {
        setErro(json.error ?? 'Código de acesso inválido. Confira o código enviado pelo organizador e tente novamente.')
        return
      }
      setValidado(true)
      router.push(json.data.redirectTo)
    } catch {
      setErro('Não foi possível validar o código agora.')
    } finally {
      setEntrando(false)
    }
  }

  const quando = jogo?.dataHora
    ? new Date(jogo.dataHora).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : 'Horário a definir'

  return (
    <main className="luva-shell flex min-h-screen items-center justify-center px-4 py-10 text-white">
      <section className="w-full max-w-md rounded-[1.75rem] border border-white/10 bg-[#07111f] p-6">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-luva-amber">Acesso do árbitro</p>
        {carregando ? <p className="mt-6 text-sm font-bold text-white/70">Identificando o jogo...</p> : null}
        {revogado ? (
          <div className="mt-6">
            <h1 className="font-display text-3xl font-black">Acesso indisponível</h1>
            <p className="mt-3 text-sm font-semibold leading-6 text-white/75">Este link de acesso ao jogo foi revogado pelo organizador.</p>
          </div>
        ) : null}
        {!carregando && !revogado && !jogo ? <p className="mt-6 text-sm font-bold text-red-200">{erro || 'Link de acesso inválido.'}</p> : null}
        {jogo && !revogado ? (
          <form className="mt-6" onSubmit={entrar}>
            <h1 className="font-display text-3xl font-black">{jogo.equipeA} × {jogo.equipeB}</h1>
            <p className="mt-2 text-sm font-semibold text-white/70">{quando}</p>
            <p className="text-sm font-semibold text-white/70">{jogo.localNome || 'Quadra a definir'}</p>
            <label className="mt-6 block text-sm font-black" htmlFor="codigo-acesso">Digite o código de acesso</label>
            <input
              id="codigo-acesso"
              value={codigo}
              onChange={(evento) => setCodigo(evento.target.value)}
              autoComplete="off"
              className="mt-2 w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-base text-white"
            />
            {erro ? <p className="mt-3 text-sm font-bold text-red-200">{erro}</p> : null}
            {validado ? <p className="mt-3 text-sm font-black text-emerald-300">Código validado. Abrindo jogo...</p> : null}
            <button type="submit" disabled={entrando || validado} className="mt-5 w-full rounded-full bg-[#ffb331] px-5 py-3 text-sm font-black uppercase tracking-wide text-[#050914] disabled:opacity-60">
              {entrando ? 'Conferindo...' : 'Entrar no jogo'}
            </button>
          </form>
        ) : null}
      </section>
    </main>
  )
}
