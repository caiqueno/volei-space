'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, Loader2, Repeat, X } from 'lucide-react'
import { usePollingVisivel, type ResultadoConsulta } from '@/lib/ao-vivo-ui/usePollingVisivel'
import {
  FILTROS_PEDIDO, INTERVALO_PEDIDOS_MS, MOTIVO_MAX, dataCurta, elencoCompletoAtivo, limparMotivo, mensagemDecisaoPedido, normalizarPedidos,
  podeDecidirPedido, rotuloAtleta, rotuloEstadoPedido, textoVazioPedidos, tratarResposta, urlDecidirPedido, urlPedidos,
  type FiltroPedido, type PedidoTroca, type TipoFalha,
} from '@/lib/regras-elenco-ui'

const COR_ESTADO: Record<string, string> = {
  PENDENTE: 'bg-luva-amber/20 text-luva-amber',
  APROVADO: 'bg-emerald-400/15 text-emerald-300',
  RECUSADO: 'bg-red-400/15 text-red-300',
  CANCELADO: 'bg-white/10 text-slate-300',
}

export function PedidosTrocaTela() {
  const ativo = elencoCompletoAtivo(process.env.NEXT_PUBLIC_ELENCO_COMPLETO_ATIVO)
  const [estado, setEstado] = useState<FiltroPedido>('PENDENTE')
  const [itens, setItens] = useState<PedidoTroca[]>([])
  const [carregou, setCarregou] = useState(false)
  const [falha, setFalha] = useState<{ tipo: TipoFalha; mensagem: string } | null>(null)
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null)
  const [decidindo, setDecidindo] = useState<{ item: PedidoTroca; decisao: 'APROVADO' | 'RECUSADO' } | null>(null)
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const estadoRef = useRef(estado)
  estadoRef.current = estado

  const buscar = useCallback(async (sinal?: AbortSignal): Promise<ResultadoConsulta> => {
    const e = estadoRef.current
    try {
      const resposta = await fetch(urlPedidos(e), { cache: 'no-store', signal: sinal })
      const corpo = await resposta.json().catch(() => null)
      const t = tratarResposta(resposta.status, corpo)
      if (!t.ok) {
        setFalha({ tipo: t.tipo ?? 'generica', mensagem: t.mensagem })
        setCarregou(true)
        return t.tipo === 'desligado' || t.tipo === 'nao-habilitado' ? 'parar' : 'falha'
      }
      // Descarta resposta de um filtro que já mudou.
      if (estadoRef.current !== e) return 'ok'
      setItens(normalizarPedidos(corpo))
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
  usePollingVisivel(buscar, { ativo, baseMs: INTERVALO_PEDIDOS_MS, maxMs: 60_000 })

  const primeira = useRef(true)
  useEffect(() => {
    if (!ativo) return
    if (primeira.current) {
      primeira.current = false
      return
    }
    setCarregou(false)
    void buscar()
  }, [ativo, estado, buscar])

  if (!ativo) {
    return (
      <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-6 text-sm font-semibold text-slate-200">
        Este recurso ainda não está disponível.
      </div>
    )
  }

  async function confirmar() {
    if (!decidindo || enviando) return
    setEnviando(true)
    try {
      const resposta = await fetch(urlDecidirPedido(decidindo.item.id), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decisao: decidindo.decisao, motivo: decidindo.decisao === 'RECUSADO' ? limparMotivo(motivo) : undefined }),
      })
      const corpo = await resposta.json().catch(() => null)
      const t = tratarResposta(resposta.status, corpo)
      setAviso({ ok: t.ok, texto: t.ok ? mensagemDecisaoPedido(decidindo.decisao, decidindo.item.equipe.nome) : t.mensagem })
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
        <p className="text-xs font-black uppercase tracking-[0.22em] text-luva-amber">Elenco</p>
        <h2 className="mt-2 font-display text-3xl font-black text-white">Pedidos de troca</h2>
        <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-200">
          Equipes que pedem para trocar um atleta depois da inscrição. Aprove para valer a troca ou recuse com um motivo opcional.
        </p>
      </header>

      <section className="rounded-[1.5rem] border border-white/10 bg-[#102033] p-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por situação">
          {FILTROS_PEDIDO.map((f) => (
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
        <p className="flex items-center gap-2 text-sm font-bold text-slate-200"><Loader2 className="animate-spin" size={16} /> Carregando pedidos...</p>
      ) : itens.length === 0 && !bloqueada ? (
        <div className="flex flex-col items-center gap-3 rounded-[1.5rem] border border-dashed border-white/15 p-10 text-center">
          <Repeat size={28} className="text-luva-amber" />
          <p className="max-w-md text-sm font-semibold text-slate-200">{textoVazioPedidos(estado)}</p>
        </div>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {itens.map((p) => (
            <li key={p.id} className="rounded-[1.5rem] border border-white/10 bg-[#102033] p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-lg font-black text-white">{p.equipe.nome}</p>
                  <p className="text-xs font-semibold text-slate-300">{dataCurta(p.criadoEm)}</p>
                </div>
                <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${COR_ESTADO[p.estado] ?? COR_ESTADO.CANCELADO}`}>{rotuloEstadoPedido(p.estado)}</span>
              </div>
              <p className="mt-3 text-sm font-bold text-slate-100">{p.campeonato} <span className="text-luva-amber">/ {p.categoria}</span></p>
              <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                <div className="rounded-xl bg-red-400/10 px-3 py-2">
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-red-300">Sai</p>
                  <p className="text-sm font-bold text-white">{rotuloAtleta(p.sai)}</p>
                </div>
                <ArrowRight size={16} className="hidden text-slate-400 sm:block" aria-hidden="true" />
                <div className="rounded-xl bg-emerald-400/10 px-3 py-2">
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-emerald-300">Entra</p>
                  <p className="text-sm font-bold text-white">{rotuloAtleta(p.entra)}</p>
                </div>
              </div>
              {p.motivo && <p className="mt-3 rounded-xl bg-white/5 px-3 py-2 text-sm font-semibold text-slate-100">&ldquo;{p.motivo}&rdquo;</p>}
              {podeDecidirPedido(p.estado) && (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => { setAviso(null); setMotivo(''); setDecidindo({ item: p, decisao: 'APROVADO' }) }}
                    className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 text-sm font-black text-[#07111f] focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    <Check size={16} /> Aprovar
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAviso(null); setMotivo(''); setDecidindo({ item: p, decisao: 'RECUSADO' }) }}
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
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="titulo-decisao-troca">
          <div className="w-full max-w-md rounded-[1.5rem] border border-white/15 bg-[#0b1a2c] p-6">
            <h3 id="titulo-decisao-troca" className="text-xl font-black text-white">
              {decidindo.decisao === 'APROVADO' ? 'Aprovar troca?' : 'Recusar troca?'}
            </h3>
            <p className="mt-2 text-sm font-semibold text-slate-200">
              {decidindo.decisao === 'APROVADO'
                ? `${decidindo.item.equipe.nome}: sai ${rotuloAtleta(decidindo.item.sai)} e entra ${rotuloAtleta(decidindo.item.entra)}.`
                : `${decidindo.item.equipe.nome} continua com ${rotuloAtleta(decidindo.item.sai)} no elenco.`}
            </p>
            {decidindo.decisao === 'RECUSADO' && (
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
                className={`flex min-h-[48px] items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black text-[#07111f] disabled:opacity-60 ${decidindo.decisao === 'APROVADO' ? 'bg-emerald-500' : 'bg-red-300'}`}
              >
                {enviando && <Loader2 className="animate-spin" size={16} />}
                {decidindo.decisao === 'APROVADO' ? 'Confirmar aprovação' : 'Confirmar recusa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
