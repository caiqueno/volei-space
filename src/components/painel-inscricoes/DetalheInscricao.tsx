'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, Check, FileText, Fingerprint, Loader2, X } from 'lucide-react'
import {
  MENSAGEM_MAX, ROTULO_ACAO, acoesDoStatus, corpoDecisao, dataCurta, mensagemDecisao, motivoBloqueio, normalizarDetalhe, podeDecidirPapel,
  rotuloStatus, textoAtletas, textoConfirmacao, tituloConfirmacao, tratarResposta, urlDecidir, urlDetalhe, urlDocumento,
  urlDocumentoSegura, validarDecisao, exigeMensagem,
  type AcaoDecisao, type InscricaoDetalhe, type PapelOrganizador,
} from '@/lib/painel-inscricoes-ui'
import { mensagemDaAprovacao } from '@/lib/pagamento-comprovante-ui'
import { PagamentoDaInscricao } from '@/components/pagamento-comprovante/PagamentoDaInscricao'

const COR_ACAO: Record<AcaoDecisao, string> = {
  APROVAR: 'bg-emerald-500 text-[#07111f]',
  ANALISAR: 'border border-white/25 bg-white/5 text-white',
  PEDIR_CORRECAO: 'border border-luva-amber/60 bg-luva-amber/10 text-luva-amber',
  LISTA_ESPERA: 'border border-sky-300/50 bg-sky-300/10 text-sky-200',
  RECUSAR: 'border border-red-400/50 bg-red-400/10 text-red-200',
}

function Marca({ ok, rotulo, Icone }: { ok: boolean; rotulo: string; Icone: typeof Camera }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold ${ok ? 'bg-emerald-400/15 text-emerald-300' : 'bg-red-400/15 text-red-300'}`}
      title={`${rotulo}: ${ok ? 'presente' : 'faltando'}`}
    >
      <Icone size={13} aria-hidden="true" />
      <span className="sr-only">{rotulo}: {ok ? 'presente' : 'faltando'}</span>
      <span aria-hidden="true">{ok ? 'ok' : 'falta'}</span>
    </span>
  )
}

interface Props {
  id: string
  papel: PapelOrganizador | null
  aoFechar: () => void
  /** Chamado depois de uma decisão (ou 409) para recarregar a lista. */
  aoAtualizar: () => void
}

export function DetalheInscricao({ id, papel, aoFechar, aoAtualizar }: Props) {
  const [detalhe, setDetalhe] = useState<InscricaoDetalhe | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [acao, setAcao] = useState<AcaoDecisao | null>(null)
  const [mensagem, setMensagem] = useState('')
  const [erroForm, setErroForm] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null)
  const [abrindoDoc, setAbrindoDoc] = useState<string | null>(null)
  const painel = useRef<HTMLDivElement>(null)

  const carregar = useCallback(async (sinal?: AbortSignal) => {
    try {
      const r = await fetch(urlDetalhe(id), { cache: 'no-store', signal: sinal })
      const corpo = await r.json().catch(() => null)
      const t = tratarResposta(r.status, corpo)
      if (!t.ok) { setErro(t.mensagem); return }
      const d = normalizarDetalhe(corpo)
      if (!d) { setErro('Inscrição não encontrada.'); return }
      setDetalhe(d)
      setErro(null)
    } catch {
      if (!sinal?.aborted) setErro('Sem conexão. Tente de novo.')
    } finally {
      if (!sinal?.aborted) setCarregando(false)
    }
  }, [id])

  useEffect(() => {
    setCarregando(true)
    setDetalhe(null)
    setAcao(null)
    setAviso(null)
    const c = new AbortController()
    void carregar(c.signal)
    return () => c.abort()
  }, [carregar])

  useEffect(() => {
    painel.current?.focus()
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape' && !enviando) aoFechar() }
    document.addEventListener('keydown', tecla)
    return () => document.removeEventListener('keydown', tecla)
  }, [aoFechar, enviando])

  async function verDocumento(atletaId: string) {
    setAbrindoDoc(atletaId)
    setAviso(null)
    try {
      const r = await fetch(urlDocumento(id, atletaId), { cache: 'no-store' })
      const corpo = await r.json().catch(() => null)
      const t = tratarResposta(r.status, corpo)
      const url = t.ok ? urlDocumentoSegura((corpo as { data?: { url?: unknown } } | null)?.data?.url) : null
      if (!url) {
        setAviso({ ok: false, texto: t.ok ? 'Documento indisponível no momento.' : t.mensagem })
        return
      }
      // URL assinada de 60 s: abre na hora e não guarda.
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch {
      setAviso({ ok: false, texto: 'Sem conexão. Tente de novo.' })
    } finally {
      setAbrindoDoc(null)
    }
  }

  async function confirmar() {
    if (!detalhe || !acao || enviando) return
    const invalido = validarDecisao(acao, mensagem)
    if (invalido) { setErroForm(invalido); return }
    setEnviando(true)
    setErroForm(null)
    try {
      const r = await fetch(urlDecidir(detalhe.id), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpoDecisao(acao, mensagem)),
      })
      const corpo = await r.json().catch(() => null)
      const t = tratarResposta(r.status, corpo)
      setAviso({ ok: t.ok, texto: t.ok ? mensagemDecisao(acao, detalhe.equipe.nome) : mensagemDaAprovacao(r.status, corpo, t.mensagem) })
      if (t.ok || t.recarregar) {
        setAcao(null)
        setMensagem('')
        await carregar()
        aoAtualizar()
      } else if (t.tipo === 'validacao') {
        setErroForm(t.mensagem)
      }
    } catch {
      setAviso({ ok: false, texto: 'Sem conexão. Tente de novo.' })
    } finally {
      setEnviando(false)
    }
  }

  const acoes = detalhe ? acoesDoStatus(detalhe.status) : []
  const semPermissao = !podeDecidirPapel(papel)
  const destino = detalhe ? [detalhe.campeonato, detalhe.categoria].filter(Boolean).join(' / ') || 'o campeonato' : ''

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/60" onMouseDown={(e) => { if (e.target === e.currentTarget && !enviando) aoFechar() }}>
      <div
        ref={painel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-detalhe-inscricao"
        className="h-full w-full max-w-xl overflow-y-auto border-l border-white/15 bg-[#0b1a2c] p-5 focus:outline-none"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 id="titulo-detalhe-inscricao" className="truncate text-xl font-black text-white">{detalhe?.equipe.nome ?? 'Inscrição'}</h3>
            {detalhe && <p className="text-xs font-semibold text-slate-300">{[detalhe.equipe.cidade, destino].filter(Boolean).join(' - ')}</p>}
          </div>
          <button type="button" onClick={aoFechar} aria-label="Fechar detalhe" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/20 text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-luva-amber">
            <X size={18} />
          </button>
        </div>

        {carregando && <p className="mt-6 flex items-center gap-2 text-sm font-bold text-slate-200"><Loader2 className="animate-spin" size={16} /> Carregando inscrição...</p>}
        {erro && !carregando && (
          <p role="alert" className="mt-6 rounded-2xl border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm font-bold text-white">
            {erro} <button type="button" onClick={() => { setCarregando(true); void carregar() }} className="ml-2 min-h-[44px] underline">Tentar de novo</button>
          </p>
        )}

        <div aria-live="polite">
          {aviso && (
            <p role={aviso.ok ? 'status' : 'alert'} className={`mt-4 rounded-2xl border px-4 py-3 text-sm font-bold text-white ${aviso.ok ? 'border-emerald-400/40 bg-emerald-400/10' : 'border-red-400/40 bg-red-400/10'}`}>
              {aviso.texto}
            </p>
          )}
        </div>

        {detalhe && (
          <>
            <p className="mt-4 text-sm font-black text-luva-amber">
              {rotuloStatus(detalhe.status)}
              {detalhe.status === 'LISTA_ESPERA' && detalhe.posicaoEspera ? ` (posição ${detalhe.posicaoEspera})` : ''}
            </p>
            {detalhe.pendencias.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-2" aria-label="Pendências">
                {detalhe.pendencias.map((p) => <li key={p} className="rounded-full bg-red-400/15 px-3 py-1 text-xs font-bold text-red-200">{p}</li>)}
              </ul>
            )}

            <section className="mt-6" aria-labelledby="atletas-detalhe">
              <h4 id="atletas-detalhe" className="text-xs font-black uppercase tracking-[0.18em] text-slate-300">Atletas ({textoAtletas(detalhe.atletasLista.length)})</h4>
              {detalhe.atletasLista.length === 0 ? (
                <p className="mt-2 text-sm font-semibold text-slate-300">Nenhum atleta na inscrição.</p>
              ) : (
                <ul className="mt-2 grid gap-2">
                  {detalhe.atletasLista.map((a) => (
                    <li key={a.id} className="rounded-2xl border border-white/10 bg-[#102033] p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="min-w-0 text-sm font-black text-white">
                          <span className="mr-2 inline-block min-w-[2ch] text-luva-amber">{a.camisa ?? '-'}</span>
                          {a.nome}
                          {a.capitao && <span className="ml-2 rounded bg-luva-amber/20 px-1.5 py-0.5 text-[11px] font-black text-luva-amber">C</span>}
                          {a.libero && <span className="ml-1 rounded bg-sky-300/20 px-1.5 py-0.5 text-[11px] font-black text-sky-200">L</span>}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Marca ok={a.temFoto} rotulo="Foto" Icone={Camera} />
                          <Marca ok={a.temDocumento} rotulo="Documento" Icone={FileText} />
                          <Marca ok={a.temCpf} rotulo="CPF" Icone={Fingerprint} />
                        </div>
                      </div>
                      {a.temDocumento && (
                        <button
                          type="button"
                          disabled={abrindoDoc === a.id}
                          onClick={() => void verDocumento(a.id)}
                          className="mt-2 flex min-h-[44px] items-center gap-2 rounded-xl border border-white/20 px-3 text-sm font-black text-white disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-luva-amber"
                        >
                          {abrindoDoc === a.id ? <Loader2 className="animate-spin" size={14} /> : <FileText size={14} />} Ver documento
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {detalhe.comissao.length > 0 && (
              <section className="mt-6" aria-labelledby="comissao-detalhe">
                <h4 id="comissao-detalhe" className="text-xs font-black uppercase tracking-[0.18em] text-slate-300">Comissão técnica</h4>
                <ul className="mt-2 grid gap-1">
                  {detalhe.comissao.map((c, i) => (
                    <li key={`${c.nome}-${i}`} className="text-sm font-semibold text-slate-100">{c.nome}{c.funcao ? <span className="text-slate-300"> - {c.funcao}</span> : null}</li>
                  ))}
                </ul>
              </section>
            )}

            <section className="mt-6" aria-labelledby="comentarios-detalhe">
              <h4 id="comentarios-detalhe" className="text-xs font-black uppercase tracking-[0.18em] text-slate-300">Comentários</h4>
              {detalhe.comentarios.length === 0 ? (
                <p className="mt-2 text-sm font-semibold text-slate-300">Sem comentários.</p>
              ) : (
                <ul className="mt-2 grid gap-2">
                  {detalhe.comentarios.map((c) => (
                    <li key={c.id} className="rounded-xl bg-white/5 px-3 py-2">
                      <p className="text-sm font-semibold text-slate-100">{c.texto}</p>
                      <p className="mt-1 text-[11px] font-semibold text-slate-400">{c.autor}{c.criadoEm ? ` - ${dataCurta(c.criadoEm)}` : ''}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <PagamentoDaInscricao inscricaoId={detalhe.id} equipeNome={detalhe.equipe.nome} papel={papel} aoMudar={aoAtualizar} />

            <section className="mt-6" aria-labelledby="decisao-detalhe">
              <h4 id="decisao-detalhe" className="text-xs font-black uppercase tracking-[0.18em] text-slate-300">Decisão</h4>
              {semPermissao && <p className="mt-2 rounded-xl bg-white/5 px-3 py-2 text-sm font-semibold text-slate-200">{motivoBloqueio(papel)}</p>}
              {acoes.length === 0 && !semPermissao && <p className="mt-2 text-sm font-semibold text-slate-300">Nenhuma ação disponível nesta situação.</p>}
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(semPermissao ? acoesDoStatus(detalhe.status) : acoes).map((a) => (
                  <button
                    key={a}
                    type="button"
                    disabled={semPermissao || enviando}
                    title={semPermissao ? motivoBloqueio(papel) : undefined}
                    onClick={() => { setAviso(null); setErroForm(null); setMensagem(''); setAcao(a) }}
                    className={`flex min-h-[48px] items-center justify-center gap-2 rounded-2xl px-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-white ${COR_ACAO[a]}`}
                  >
                    {a === 'APROVAR' && <Check size={16} />}
                    {ROTULO_ACAO[a]}
                  </button>
                ))}
              </div>
            </section>
          </>
        )}

        {detalhe && acao && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center" role="alertdialog" aria-modal="true" aria-labelledby="titulo-confirma-inscricao">
            <div className="w-full max-w-md rounded-[1.5rem] border border-white/15 bg-[#0b1a2c] p-6">
              <h3 id="titulo-confirma-inscricao" className="text-xl font-black text-white">{tituloConfirmacao(acao)}</h3>
              <p className="mt-2 text-sm font-semibold text-slate-200">{textoConfirmacao(acao, detalhe.equipe.nome, destino)}</p>
              {(exigeMensagem(acao) || acao === 'LISTA_ESPERA' || acao === 'ANALISAR') && (
                <label className="mt-4 grid gap-1 text-xs font-black uppercase tracking-[0.14em] text-slate-300">
                  {acao === 'RECUSAR' ? 'Motivo (obrigatório)' : acao === 'PEDIR_CORRECAO' ? 'O que corrigir (obrigatório)' : 'Comentário (opcional)'}
                  <textarea
                    value={mensagem}
                    maxLength={MENSAGEM_MAX}
                    onChange={(e) => { setMensagem(e.target.value); setErroForm(null) }}
                    rows={3}
                    required={exigeMensagem(acao)}
                    aria-invalid={erroForm ? true : undefined}
                    className="rounded-xl border border-white/10 bg-[#07111f] px-3 py-2 text-sm font-semibold normal-case tracking-normal text-white"
                  />
                </label>
              )}
              {erroForm && <p role="alert" className="mt-2 text-sm font-bold text-red-300">{erroForm}</p>}
              <div className="mt-5 grid grid-cols-2 gap-2">
                <button type="button" disabled={enviando} onClick={() => setAcao(null)} className="min-h-[48px] rounded-2xl border border-white/20 px-4 text-sm font-black text-white disabled:opacity-50">Voltar</button>
                <button
                  type="button"
                  disabled={enviando}
                  onClick={() => void confirmar()}
                  className={`flex min-h-[48px] items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black disabled:opacity-60 ${acao === 'APROVAR' ? 'bg-emerald-500 text-[#07111f]' : acao === 'RECUSAR' ? 'bg-red-300 text-[#07111f]' : 'bg-luva-amber text-[#07111f]'}`}
                >
                  {enviando && <Loader2 className="animate-spin" size={16} />}
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
