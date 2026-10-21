'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Trash2, UserPlus, UsersRound } from 'lucide-react'
import {
  PAPEIS, URL_EQUIPE, corpoConvite, falhaBloqueante, normalizarEquipe, painelInscricoesAtivo, rotuloPapel, tratarResposta, validarEmail,
  type MembroEquipe, type PapelOrganizador, type TipoFalha,
} from '@/lib/painel-inscricoes-ui'

export function EquipeTela() {
  const ativo = painelInscricoesAtivo(process.env.NEXT_PUBLIC_PAINEL_INSCRICOES_ATIVO)
  const [membros, setMembros] = useState<MembroEquipe[]>([])
  const [meuPapel, setMeuPapel] = useState<PapelOrganizador | null>(null)
  const [carregou, setCarregou] = useState(false)
  const [falha, setFalha] = useState<{ tipo: TipoFalha; mensagem: string } | null>(null)
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null)
  const [email, setEmail] = useState('')
  const [papel, setPapel] = useState<PapelOrganizador>('ARBITRAGEM')
  const [erroEmail, setErroEmail] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [removendo, setRemovendo] = useState<MembroEquipe | null>(null)

  const carregar = useCallback(async (sinal?: AbortSignal) => {
    try {
      const r = await fetch(URL_EQUIPE, { cache: 'no-store', signal: sinal })
      const corpo = await r.json().catch(() => null)
      const t = tratarResposta(r.status, corpo)
      if (!t.ok) {
        setFalha({ tipo: t.tipo ?? 'generica', mensagem: t.mensagem })
        return
      }
      const eq = normalizarEquipe(corpo)
      setMembros(eq.membros)
      setMeuPapel(eq.meuPapel)
      setFalha(null)
    } catch {
      if (!sinal?.aborted) setFalha({ tipo: 'generica', mensagem: 'Sem conexão. Tente de novo.' })
    } finally {
      if (!sinal?.aborted) setCarregou(true)
    }
  }, [])

  useEffect(() => {
    if (!ativo) return
    const c = new AbortController()
    void carregar(c.signal)
    return () => c.abort()
  }, [ativo, carregar])

  if (!ativo) {
    return (
      <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-6 text-sm font-semibold text-slate-200">
        Este recurso ainda não está disponível.
      </div>
    )
  }

  const bloqueada = falha ? falhaBloqueante(falha.tipo) : false
  // Papel desconhecido: libera e deixa o servidor responder 403.
  const podeGerir = meuPapel === null || meuPapel === 'ADMINISTRADOR'

  async function enviar(metodo: 'POST' | 'DELETE', corpo: unknown, sucesso: string) {
    setEnviando(true)
    setAviso(null)
    try {
      const r = await fetch(URL_EQUIPE, { method: metodo, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })
      const json = await r.json().catch(() => null)
      const t = tratarResposta(r.status, json)
      setAviso({ ok: t.ok, texto: t.ok ? sucesso : t.mensagem })
      if (t.ok || t.recarregar) await carregar()
      return t.ok
    } catch {
      setAviso({ ok: false, texto: 'Sem conexão. Tente de novo.' })
      return false
    } finally {
      setEnviando(false)
    }
  }

  async function convidar(e: React.FormEvent) {
    e.preventDefault()
    if (enviando) return
    const invalido = validarEmail(email)
    setErroEmail(invalido)
    if (invalido) return
    const corpo = corpoConvite(email, papel)
    if (await enviar('POST', corpo, `Convite enviado para ${corpo.email}.`)) setEmail('')
  }

  async function remover() {
    if (!removendo) return
    const alvo = removendo
    if (await enviar('DELETE', { email: alvo.email, papel: alvo.papel }, `${alvo.email} foi removido da equipe.`)) setRemovendo(null)
    else setRemovendo(null)
  }

  return (
    <div className="space-y-6">
      <header className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-luva-amber">Organização</p>
        <h2 className="mt-2 font-display text-3xl font-black text-white">Minha equipe</h2>
        <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-200">Convide pessoas para ajudar na organização e defina o que cada uma pode fazer.</p>
      </header>

      <section aria-labelledby="papeis-equipe" className="rounded-[1.5rem] border border-white/10 bg-[#102033] p-5">
        <h3 id="papeis-equipe" className="text-xs font-black uppercase tracking-[0.18em] text-slate-300">O que cada papel faz</h3>
        <dl className="mt-3 grid gap-3 md:grid-cols-3">
          {PAPEIS.map((p) => (
            <div key={p.value} className="rounded-2xl bg-white/5 p-3">
              <dt className="text-sm font-black text-white">{p.rotulo}</dt>
              <dd className="mt-1 text-sm font-semibold text-slate-200">{p.descricao}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div aria-live="polite">
        {aviso && (
          <p role={aviso.ok ? 'status' : 'alert'} className={`rounded-2xl border px-4 py-3 text-sm font-bold text-white ${aviso.ok ? 'border-emerald-400/40 bg-emerald-400/10' : 'border-red-400/40 bg-red-400/10'}`}>
            {aviso.texto}
          </p>
        )}
      </div>

      {falha && (
        <p role="alert" className="rounded-2xl border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm font-bold text-white">
          {falha.mensagem}
          {!bloqueada && <button type="button" onClick={() => void carregar()} className="ml-3 min-h-[44px] underline">Tentar de novo</button>}
        </p>
      )}

      {!bloqueada && (
        <form onSubmit={(e) => void convidar(e)} noValidate className="grid gap-3 rounded-[1.5rem] border border-white/10 bg-[#102033] p-5 md:grid-cols-[1fr_auto_auto] md:items-end">
          <label className="grid gap-1 text-xs font-black uppercase tracking-[0.14em] text-slate-300">
            E-mail
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setErroEmail(null) }}
              disabled={!podeGerir}
              autoComplete="off"
              aria-invalid={erroEmail ? true : undefined}
              aria-describedby={erroEmail ? 'erro-email-equipe' : undefined}
              className="min-h-[44px] rounded-xl border border-white/10 bg-[#07111f] px-3 text-sm font-bold normal-case tracking-normal text-white disabled:opacity-50"
            />
            {erroEmail && <span id="erro-email-equipe" role="alert" className="text-xs font-bold normal-case tracking-normal text-red-300">{erroEmail}</span>}
          </label>
          <label className="grid gap-1 text-xs font-black uppercase tracking-[0.14em] text-slate-300">
            Papel
            <select value={papel} onChange={(e) => setPapel(e.target.value as PapelOrganizador)} disabled={!podeGerir} className="min-h-[44px] rounded-xl border border-white/10 bg-[#07111f] px-3 text-sm font-bold normal-case tracking-normal text-white disabled:opacity-50">
              {PAPEIS.map((p) => <option key={p.value} value={p.value}>{p.rotulo}</option>)}
            </select>
          </label>
          <button
            type="submit"
            disabled={!podeGerir || enviando}
            title={podeGerir ? undefined : 'Só administradores convidam pessoas.'}
            className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-luva-amber px-5 text-sm font-black text-[#07111f] disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            {enviando ? <Loader2 className="animate-spin" size={16} /> : <UserPlus size={16} />} Convidar
          </button>
          {!podeGerir && <p className="text-sm font-semibold text-slate-300 md:col-span-3">Só administradores convidam ou removem pessoas.</p>}
        </form>
      )}

      {!carregou ? (
        <p className="flex items-center gap-2 text-sm font-bold text-slate-200"><Loader2 className="animate-spin" size={16} /> Carregando equipe...</p>
      ) : membros.length === 0 && !bloqueada ? (
        <div className="flex flex-col items-center gap-3 rounded-[1.5rem] border border-dashed border-white/15 p-10 text-center">
          <UsersRound size={28} className="text-luva-amber" />
          <p className="max-w-md text-sm font-semibold text-slate-200">Você ainda não convidou ninguém. Use o formulário acima para adicionar a primeira pessoa.</p>
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {membros.map((m) => (
            <li key={`${m.email}-${m.papel}`} className="flex items-center justify-between gap-3 rounded-[1.5rem] border border-white/10 bg-[#102033] p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-white">{m.nome || m.email}</p>
                {m.nome && <p className="truncate text-xs font-semibold text-slate-300">{m.email}</p>}
                <p className="mt-1 text-xs font-black text-luva-amber">{rotuloPapel(m.papel)}{m.pendente ? ' - convite pendente' : ''}</p>
              </div>
              <button
                type="button"
                disabled={!podeGerir || enviando}
                title={podeGerir ? undefined : 'Só administradores removem pessoas.'}
                onClick={() => setRemovendo(m)}
                aria-label={`Remover ${m.email}`}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-red-400/50 bg-red-400/10 text-red-200 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {removendo && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center" role="alertdialog" aria-modal="true" aria-labelledby="titulo-remover-membro">
          <div className="w-full max-w-md rounded-[1.5rem] border border-white/15 bg-[#0b1a2c] p-6">
            <h3 id="titulo-remover-membro" className="text-xl font-black text-white">Remover da equipe?</h3>
            <p className="mt-2 text-sm font-semibold text-slate-200">{removendo.email} perde o acesso de {rotuloPapel(removendo.papel)} à sua organização.</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setRemovendo(null)} className="min-h-[48px] rounded-2xl border border-white/20 px-4 text-sm font-black text-white">Voltar</button>
              <button type="button" disabled={enviando} onClick={() => void remover()} className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-red-300 px-4 text-sm font-black text-[#07111f] disabled:opacity-60">
                {enviando && <Loader2 className="animate-spin" size={16} />} Remover
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
