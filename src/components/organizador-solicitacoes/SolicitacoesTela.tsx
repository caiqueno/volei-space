'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Inbox, Loader2, Users, X } from 'lucide-react'
import { usePollingVisivel, type ResultadoConsulta } from '@/lib/ao-vivo-ui/usePollingVisivel'
import {
  FILTROS_ESTADO, INTERVALO_SOLICITACOES_MS, MOTIVO_MAX, campeonatosDaLista, dataCurta, limparMotivo,
  mensagemDecisao, normalizarSolicitacoes, podeDecidir, rotuloEstado, solicitacoesAtivo, textoAtletas, textoVazio,
  tratarResposta, urlSolicitacoes, type FiltroEstado, type Solicitacao, type TipoFalha,
} from '@/lib/organizador-solicitacoes-ui'

const COR_ESTADO: Record<string, string> = {
  PENDENTE: 'bg-luva-amber/20 text-luva-amber',
  APROVADA: 'bg-emerald-400/15 text-emerald-300',
  RECUSADA: 'bg-red-400/15 text-red-300',
  CANCELADA: 'bg-white/10 text-slate-300',
}

export function SolicitacoesTela() {
  const ativo = solicitacoesAtivo(process.env.NEXT_PUBLIC_INSCRICAO_SOLICITACAO_ATIVO)
  const [estado, setEstado] = useState<FiltroEstado>('PENDENTE')
  const [ligaId, setLigaId] = useState('')
  const [itens, setItens] = useState<Solicitacao[]>([])
  const [conhecidos, setConhecidos] = useState<Array<{ ligaId: string; campeonato: string }>>([])
  const [carregou, setCarregou] = useState(false)
  const [falha, setFalha] = useState<{ tipo: TipoFalha; mensagem: string } | null>(null)
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null)
  const [decidindo, setDecidindo] = useState<{ item: Solicitacao; decisao: 'APROVADA' | 'RECUSADA' } | null>(null)
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const filtroRef = useRef({ estado, ligaId })
  filtroRef.current = { estado, ligaId }

  const buscar = useCallback(async (sinal?: AbortSignal): Promise<ResultadoConsulta> => {
    const { estado: e, ligaId: l } = filtroRef.current
    try {
      const resposta = await fetch(urlSolicitacoes(e, l || undefined), { cache: 'no-store', signal: sinal })
      const corpo = await resposta.json().catch(() => null)
      const t = tratarResposta(resposta.status, corpo)
      if (!t.ok) {
        setFalha({ tipo: t.tipo ?? 'generica', mensagem: t.mensagem })
        setCarregou(true)
        return t.tipo === 'desligado' || t.tipo === 'nao-habilitado' ? 'parar' : 'falha'
      }
      // Descarta resposta de um filtro que já mudou.
      if (filtroRef.current.estado !== e || filtroRef.current.ligaId !== l) return 'ok'
      const lista = normalizarSolicitacoes(corpo)
      setItens(lista)
      if (!l) setConhecidos((atual) => (e === 'PENDENTE' || atual.length === 0 ? lista : [...atual, ...lista]))
      setFalha(null)
      setCarregou(true)
      return 'ok'
    } catch {
      if (sinal?.aborted) return 'ok'
      setFalha({ tipo: 'generica', mensagem: 'Sem conexão. Tentando de novo em instantes.' })
      setCarregou(true)
      return 'falha'
    }
  }, [])

  // Polling de 15 s; pausa com a aba oculta. Desligado pela flag: nenhuma requisição.
  usePollingVisivel(buscar, { ativo, baseMs: INTERVALO_SOLICITACOES_MS, maxMs: 60_000 })

  const primeira = useRef(true)
  useEffect(() => {
    if (!ativo) return
    // A primeira consulta já é feita pelo polling.
    if (primeira.current) {
      primeira.current = false
      return
    }
    setCarregou(false)
    void buscar()
  }, [ativo, estado, ligaId, buscar])

  if (!ativo) {
    return (
      <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-6 text-sm font-semibold text-slate-200">
        Este recurso ainda não está disponível.
      </div>
    )
  }

  const campeonatos = campeonatosDaLista(conhecidos)

  async function confirmar() {
    if (!decidindo || enviando) return
    setEnviando(true)
    try {
      const resposta = await fetch(`/api/organizador/solicitacoes/${encodeURIComponent(decidindo.item.id)}/decidir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decisao: decidindo.decisao, motivo: decidindo.decisao === 'RECUSADA' ? limparMotivo(motivo) : undefined }),
      })
      const corpo = await resposta.json().catch(() => null)
      const t = tratarResposta(resposta.status, corpo)
      setAviso({ ok: t.ok, texto: t.ok ? mensagemDecisao(decidindo.decisao, decidindo.item.equipe.nome) : t.mensagem })
      if (t.ok || t.recarregar) {
        setDecidindo(null)
        setMotivo('')
        await buscar()
      }
    } catch {
      setAviso({ ok: false, texto: 'Sem conexão. Tente de novo.' })
    } finally {
      setEnviando(false)
    }
  }

  const bloqueada = falha?.tipo === 'desligado' || falha?.tipo === 'nao-habilitado'

  return (
    <div className="space-y-6">
      <header className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-luva-amber">Inscrições</p>
        <h2 className="mt-2 font-display text-3xl font-black text-white">Solicitações</h2>
        <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-200">
          Pedidos de equipes para entrar nos campeonatos com aprovação. Aprove para inscrever a equipe ou recuse com um motivo opcional.
        </p>
      </header>

      <section className="flex flex-col gap-3 rounded-[1.5rem] border border-white/10 bg-[#102033] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por situação">
          {FILTROS_ESTADO.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={estado === f.value}
              onClick={() => setEstado(f.value)}
              className={`min-h-[44px] rounded-full px-4 py-2 text-sm font-black transition focus:outline-none focus-visible:ring-2 focus-visible:ring-luva-amber ${estado === f.value ? 'bg-luva-amber text-[#07111f]' : 'border border-white/15 bg-white/5 text-slate-100 hover:border-luva-amber/70'}`}
            >
              {f.rotulo}
            </button>
          ))}
        </div>
        <label className="grid gap-1 text-xs font-black uppercase tracking-[0.14em] text-slate-300">
          Campeonato
          <select
            value={ligaId}
            onChange={(e) => setLigaId(e.target.value)}
            className="min-h-[44px] rounded-xl border border-white/10 bg-[#07111f] px-3 text-sm font-bold normal-case tracking-normal text-white"
          >
            <option value="">Todos os campeonatos</option>
            {campeonatos.map((c) => <option key={c.ligaId} value={c.ligaId}>{c.nome}</option>)}
          </select>
        </label>
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
          {!bloqueada && (
            <button type="button" onClick={() => void buscar()} className="ml-3 min-h-[44px] underline">Tentar de novo</button>
          )}
        </p>
      )}

      {!carregou ? (
        <p className="flex items-center gap-2 text-sm font-bold text-slate-200"><Loader2 className="animate-spin" size={16} /> Carregando solicitações...</p>
      ) : itens.length === 0 && !bloqueada ? (
        <div className="flex flex-col items-center gap-3 rounded-[1.5rem] border border-dashed border-white/15 p-10 text-center">
          <Inbox size={28} className="text-luva-amber" />
          <p className="max-w-md text-sm font-semibold text-slate-200">{textoVazio(estado)}</p>
        </div>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {itens.map((s) => (
            <li key={s.id} className="rounded-[1.5rem] border border-white/10 bg-[#102033] p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-lg font-black text-white">{s.equipe.nome}</p>
                  <p className="text-xs font-semibold text-slate-300">{[s.equipe.cidade, dataCurta(s.solicitadoEm)].filter(Boolean).join(' - ')}</p>
                </div>
                <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${COR_ESTADO[s.estado] ?? COR_ESTADO.CANCELADA}`}>{rotuloEstado(s.estado)}</span>
              </div>
              <p className="mt-3 text-sm font-bold text-slate-100">{s.campeonato} <span className="text-luva-amber">/ {s.categoria}</span></p>
              <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-slate-300"><Users size={14} /> {textoAtletas(s.atletas)}</p>
              {s.mensagem && <p className="mt-3 rounded-xl bg-white/5 px-3 py-2 text-sm font-semibold text-slate-100">&ldquo;{s.mensagem}&rdquo;</p>}
              {podeDecidir(s.estado) && (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => { setAviso(null); setMotivo(''); setDecidindo({ item: s, decisao: 'APROVADA' }) }}
                    className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 text-sm font-black text-[#07111f] focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    <Check size={16} /> Aprovar
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAviso(null); setMotivo(''); setDecidindo({ item: s, decisao: 'RECUSADA' }) }}
                    className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-red-400/50 bg-red-400/10 px-4 text-sm font-black text-red-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    <X size={16} /> Recusar
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {decidindo && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="titulo-decisao">
          <div className="w-full max-w-md rounded-[1.5rem] border border-white/15 bg-[#0b1a2c] p-6">
            <h3 id="titulo-decisao" className="text-xl font-black text-white">
              {decidindo.decisao === 'APROVADA' ? 'Aprovar inscrição?' : 'Recusar inscrição?'}
            </h3>
            <p className="mt-2 text-sm font-semibold text-slate-200">
              {decidindo.decisao === 'APROVADA'
                ? `${decidindo.item.equipe.nome} será inscrita em ${decidindo.item.campeonato} / ${decidindo.item.categoria}.`
                : `${decidindo.item.equipe.nome} não entrará em ${decidindo.item.campeonato} / ${decidindo.item.categoria}.`}
            </p>
            {decidindo.decisao === 'RECUSADA' && (
              <label className="mt-4 grid gap-1 text-xs font-black uppercase tracking-[0.14em] text-slate-300">
                Motivo (opcional)
                <textarea
                  value={motivo}
                  maxLength={MOTIVO_MAX}
                  onChange={(e) => setMotivo(e.target.value)}
                  rows={3}
                  className="rounded-xl border border-white/10 bg-[#07111f] px-3 py-2 text-sm font-semibold normal-case tracking-normal text-white"
                />
              </label>
            )}
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" disabled={enviando} onClick={() => setDecidindo(null)} className="min-h-[48px] rounded-2xl border border-white/20 px-4 text-sm font-black text-white disabled:opacity-50">
                Voltar
              </button>
              <button
                type="button"
                disabled={enviando}
                onClick={() => void confirmar()}
                className={`flex min-h-[48px] items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black text-[#07111f] disabled:opacity-60 ${decidindo.decisao === 'APROVADA' ? 'bg-emerald-500' : 'bg-red-300'}`}
              >
                {enviando && <Loader2 className="animate-spin" size={16} />}
                {decidindo.decisao === 'APROVADA' ? 'Confirmar aprovação' : 'Confirmar recusa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
