'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  botoesDoPagamento, corpoDecisaoPagamento, dataHora, falhaEscondeArea, formatarReais, mensagemDecisaoPagamento, normalizarPagamentoOrganizador,
  pagamentoComprovanteAtivo, rotuloEstadoOrganizador, textoDecisaoPagamento, tituloDecisaoPagamento, tomDoEstado, tratarRespostaPagamento,
  urlComprovanteOrganizador, urlComprovanteSegura, urlDecidirPagamento, urlPagamentoOrganizador, validarDecisaoPagamento, MOTIVO_MAX,
  type DecisaoPagamento, type PagamentoOrganizador, type PapelPagamento, type Tom,
} from '@/lib/pagamento-comprovante-ui'

const COR_TOM: Record<Tom, string> = {
  ok: 'bg-emerald-400/15 text-emerald-300',
  atencao: 'bg-luva-amber/20 text-luva-amber',
  erro: 'bg-red-400/15 text-red-300',
  neutro: 'bg-white/10 text-slate-200',
}

type Carga = { fase: 'carregando' } | { fase: 'oculto' } | { fase: 'erro'; mensagem: string } | { fase: 'pronto'; pagamento: PagamentoOrganizador }

type Props = {
  inscricaoId: string
  equipeNome: string
  papel: PapelPagamento
  /** Chamado depois de uma decisão para recarregar a lista. */
  aoMudar: () => void
}

/**
 * Pagamento no detalhe da inscrição do painel: valor, estado, quando o time enviou,
 * "Ver comprovante" (URL assinada, abre em nova aba e não é guardada), Confirmar, Recusar e Isentar.
 * Flag desligada: nada e nenhuma requisição.
 */
export function PagamentoDaInscricao({ inscricaoId, equipeNome, papel, aoMudar }: Props) {
  const ativo = pagamentoComprovanteAtivo()
  const [carga, setCarga] = useState<Carga>({ fase: 'carregando' })
  const [decisao, setDecisao] = useState<DecisaoPagamento | null>(null)
  const [motivo, setMotivo] = useState('')
  const [erroForm, setErroForm] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [abrindo, setAbrindo] = useState(false)
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null)

  const carregar = useCallback(async (sinal?: AbortSignal) => {
    try {
      const r = await fetch(urlPagamentoOrganizador(inscricaoId), { cache: 'no-store', signal: sinal })
      const corpo = await r.json().catch(() => null)
      const t = tratarRespostaPagamento(r.status, corpo)
      if (!t.ok) {
        setCarga(falhaEscondeArea(t.tipo) ? { fase: 'oculto' } : { fase: 'erro', mensagem: t.mensagem })
        return
      }
      const pagamento = normalizarPagamentoOrganizador(corpo)
      setCarga(pagamento ? { fase: 'pronto', pagamento } : { fase: 'oculto' })
    } catch {
      if (!sinal?.aborted) setCarga({ fase: 'erro', mensagem: 'Sem conexão para ver o pagamento. Tente de novo.' })
    }
  }, [inscricaoId])

  useEffect(() => {
    if (!ativo) return
    setCarga({ fase: 'carregando' })
    setAviso(null)
    setDecisao(null)
    const c = new AbortController()
    void carregar(c.signal)
    return () => c.abort()
  }, [ativo, carregar])

  async function verComprovante() {
    if (abrindo) return
    setAbrindo(true)
    setAviso(null)
    try {
      const r = await fetch(urlComprovanteOrganizador(inscricaoId), { cache: 'no-store' })
      const corpo = await r.json().catch(() => null)
      const t = tratarRespostaPagamento(r.status, corpo)
      const url = t.ok ? urlComprovanteSegura((corpo as { data?: { url?: unknown } } | null)?.data?.url) : null
      if (!url) {
        setAviso({ ok: false, texto: t.ok ? 'Comprovante indisponível no momento.' : t.mensagem })
        return
      }
      // URL assinada de curta duração: abre na hora, em nova aba, e não é guardada.
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch {
      setAviso({ ok: false, texto: 'Sem conexão. Tente de novo.' })
    } finally {
      setAbrindo(false)
    }
  }

  async function confirmar() {
    if (!decisao || enviando) return
    const invalido = validarDecisaoPagamento(decisao, motivo)
    if (invalido) { setErroForm(invalido); return }
    setEnviando(true)
    setErroForm(null)
    try {
      const r = await fetch(urlDecidirPagamento(inscricaoId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpoDecisaoPagamento(decisao, motivo)),
      })
      const corpo = await r.json().catch(() => null)
      const t = tratarRespostaPagamento(r.status, corpo)
      setAviso({ ok: t.ok, texto: t.ok ? mensagemDecisaoPagamento(decisao, equipeNome) : t.mensagem })
      if (t.ok || t.recarregar) {
        setDecisao(null)
        setMotivo('')
        await carregar()
        aoMudar()
      } else if (t.tipo === 'validacao') {
        setErroForm(t.mensagem)
      }
    } catch {
      setAviso({ ok: false, texto: 'Sem conexão. Tente de novo.' })
    } finally {
      setEnviando(false)
    }
  }

  if (!ativo || carga.fase === 'oculto') return null

  return (
    <section className="mt-6" aria-labelledby="pagamento-detalhe">
      <h4 id="pagamento-detalhe" className="text-xs font-black uppercase tracking-[0.18em] text-slate-300">Pagamento</h4>

      {carga.fase === 'carregando' && <p className="mt-2 flex items-center gap-2 text-sm font-bold text-slate-200"><Loader2 className="animate-spin motion-reduce:animate-none" size={14} /> Carregando pagamento...</p>}

      {carga.fase === 'erro' && (
        <p role="alert" className="mt-2 rounded-2xl border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm font-bold text-white">
          {carga.mensagem}
          <button type="button" onClick={() => { setCarga({ fase: 'carregando' }); void carregar() }} className="ml-2 min-h-[44px] underline">Tentar de novo</button>
        </p>
      )}

      <div aria-live="polite">
        {aviso && (
          <p role={aviso.ok ? 'status' : 'alert'} className={`mt-2 rounded-2xl border px-4 py-3 text-sm font-bold text-white ${aviso.ok ? 'border-emerald-400/40 bg-emerald-400/10' : 'border-red-400/40 bg-red-400/10'}`}>
            {aviso.texto}
          </p>
        )}
      </div>

      {carga.fase === 'pronto' && (() => {
        const p = carga.pagamento
        const botoes = botoesDoPagamento(p.estado, papel, p.comprovanteEnviadoEm)
        const algumBotao = botoes.confirmar || botoes.recusar || botoes.isentar
        return (
          <div className="mt-2 rounded-2xl border border-white/10 bg-[#102033] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-lg font-black text-white">{formatarReais(p.valorCentavos)}</p>
              <span className={`rounded-full px-3 py-1 text-xs font-black ${COR_TOM[tomDoEstado(p.estado)]}`}>{rotuloEstadoOrganizador(p.estado)}</span>
            </div>
            {p.comprovanteEnviadoEm && <p className="mt-2 text-sm font-semibold text-slate-200">Comprovante enviado em {dataHora(p.comprovanteEnviadoEm)}.</p>}
            {!p.comprovanteEnviadoEm && p.estado === 'PENDENTE' && <p className="mt-2 text-sm font-semibold text-slate-200">O time ainda não enviou o comprovante. A inscrição só pode ser aprovada depois que o pagamento for confirmado ou isentado.</p>}
            {p.decididoEm && <p className="mt-1 text-xs font-semibold text-slate-400">Decidido em {dataHora(p.decididoEm)}.</p>}
            {p.estado === 'RECUSADO' && p.motivoRecusa && <p className="mt-2 text-sm font-semibold text-red-200">Motivo da recusa: {p.motivoRecusa}</p>}

            {(botoes.verComprovante || algumBotao) && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {botoes.verComprovante && (
                  <button
                    type="button" disabled={abrindo} onClick={() => void verComprovante()}
                    className="col-span-2 flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-white/20 px-3 text-sm font-black text-white disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-luva-amber"
                  >
                    {abrindo && <Loader2 className="animate-spin motion-reduce:animate-none" size={14} />} Ver comprovante
                  </button>
                )}
                {botoes.confirmar && (
                  <button type="button" disabled={enviando} onClick={() => { setAviso(null); setErroForm(null); setMotivo(''); setDecisao('CONFIRMAR') }} className="flex min-h-[48px] items-center justify-center rounded-2xl bg-emerald-500 px-3 text-sm font-black text-[#07111f] disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-white">Confirmar pagamento</button>
                )}
                {botoes.recusar && (
                  <button type="button" disabled={enviando} onClick={() => { setAviso(null); setErroForm(null); setMotivo(''); setDecisao('RECUSAR') }} className="flex min-h-[48px] items-center justify-center rounded-2xl border border-red-400/50 bg-red-400/10 px-3 text-sm font-black text-red-200 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-white">Recusar comprovante</button>
                )}
                {botoes.isentar && (
                  <button type="button" disabled={enviando} onClick={() => { setAviso(null); setErroForm(null); setMotivo(''); setDecisao('ISENTAR') }} className="flex min-h-[48px] items-center justify-center rounded-2xl border border-white/25 bg-white/5 px-3 text-sm font-black text-white disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-white">Isentar</button>
                )}
              </div>
            )}
            {!algumBotao && papel === 'ARBITRAGEM' && <p className="mt-3 rounded-xl bg-white/5 px-3 py-2 text-sm font-semibold text-slate-200">Seu papel só permite ver o pagamento.</p>}

            {decisao && (
              <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-4 sm:items-center" role="alertdialog" aria-modal="true" aria-labelledby="titulo-decisao-pagamento">
                <div className="w-full max-w-md rounded-[1.5rem] border border-white/15 bg-[#0b1a2c] p-6">
                  <h3 id="titulo-decisao-pagamento" className="text-xl font-black text-white">{tituloDecisaoPagamento(decisao)}</h3>
                  <p className="mt-2 text-sm font-semibold text-slate-200">{textoDecisaoPagamento(decisao, equipeNome, p.valorCentavos)}</p>
                  {(decisao === 'RECUSAR' || decisao === 'ISENTAR') && (
                    <label className="mt-4 grid gap-1 text-xs font-black uppercase tracking-[0.14em] text-slate-300">
                      {decisao === 'RECUSAR' ? 'Motivo (obrigatório)' : 'Observação (opcional)'}
                      <textarea
                        value={motivo} maxLength={MOTIVO_MAX} rows={3} required={decisao === 'RECUSAR'} aria-invalid={erroForm ? true : undefined}
                        onChange={(e) => { setMotivo(e.target.value); setErroForm(null) }}
                        className="rounded-xl border border-white/10 bg-[#07111f] px-3 py-2 text-sm font-semibold normal-case tracking-normal text-white"
                      />
                    </label>
                  )}
                  {erroForm && <p role="alert" className="mt-2 text-sm font-bold text-red-300">{erroForm}</p>}
                  <div className="mt-5 grid grid-cols-2 gap-2">
                    <button type="button" disabled={enviando} onClick={() => setDecisao(null)} className="min-h-[48px] rounded-2xl border border-white/20 px-4 text-sm font-black text-white disabled:opacity-50">Voltar</button>
                    <button
                      type="button" disabled={enviando} onClick={() => void confirmar()}
                      className={`flex min-h-[48px] items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black disabled:opacity-60 ${decisao === 'CONFIRMAR' ? 'bg-emerald-500 text-[#07111f]' : decisao === 'RECUSAR' ? 'bg-red-300 text-[#07111f]' : 'bg-luva-amber text-[#07111f]'}`}
                    >
                      {enviando && <Loader2 className="animate-spin motion-reduce:animate-none" size={16} />}
                      {decisao === 'CONFIRMAR' ? 'Confirmar pagamento' : decisao === 'RECUSAR' ? 'Recusar' : 'Isentar'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })()}
    </section>
  )
}
