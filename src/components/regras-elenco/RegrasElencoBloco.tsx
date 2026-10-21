'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { AlertTriangle, Loader2, Lock } from 'lucide-react'
import { DateTimePickerInput } from '@/components/parametrizacao/ui/DateTimePickerInput'
import {
  DOCUMENTOS, aplicarModelo, ajustar, alternarDocumento, corpoPut, elencoCompletoAtivo, explicacaoNascimento, formVazio, fraseResumo,
  iguais, normalizarModelos, normalizarRegra, temErros, tratarResposta, urlRegra, validarForm,
  type FormRegra, type ModeloRegra,
} from '@/lib/regras-elenco-ui'

const CAMPO = 'min-h-[44px] w-full rounded-xl border border-white/10 bg-[#07111f] px-3 text-sm font-bold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-luva-amber disabled:opacity-60'
const ROTULO = 'grid gap-1 text-xs font-black uppercase tracking-[0.14em] text-slate-300'

/**
 * Bloco "Regras de elenco" da parametrização, por categoria (a categoria vem da URL, como o modo de inscrição).
 * Com a flag desligada não renderiza nada e não faz nenhuma requisição.
 */
export function RegrasElencoBloco() {
  const ativo = elencoCompletoAtivo(process.env.NEXT_PUBLIC_ELENCO_COMPLETO_ATIVO)
  if (!ativo) return null
  return <BlocoAtivo />
}

function BlocoAtivo() {
  const categoriaId = useSearchParams().get('categoriaCampeonatoId')
  const [modelos, setModelos] = useState<ModeloRegra[]>([])
  const [form, setForm] = useState<FormRegra>(formVazio())
  const [salvo, setSalvo] = useState<FormRegra>(formVazio())
  const [somenteLeitura, setSomenteLeitura] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [indisponivel, setIndisponivel] = useState(false)
  const [erroCarga, setErroCarga] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState<{ ok: boolean; texto: string } | null>(null)
  const [tentouSalvar, setTentouSalvar] = useState(false)

  const carregar = useCallback(async (sinal: { vivo: boolean }) => {
    if (!categoriaId) return
    setCarregando(true)
    setErroCarga(null)
    try {
      const [rm, rr] = await Promise.all([
        fetch('/api/regras-elenco/modelos', { cache: 'no-store' }),
        fetch(urlRegra(categoriaId), { cache: 'no-store' }),
      ])
      const [cm, cr] = await Promise.all([rm.json().catch(() => null), rr.json().catch(() => null)])
      if (!sinal.vivo) return
      for (const [status, corpo] of [[rm.status, cm], [rr.status, cr]] as const) {
        const t = tratarResposta(status, corpo)
        if (!t.ok) {
          if (t.tipo === 'desligado' || t.tipo === 'nao-habilitado') setIndisponivel(true)
          else setErroCarga(t.mensagem)
          return
        }
      }
      setModelos(normalizarModelos(cm))
      const regra = normalizarRegra(cr)
      setForm(regra.form)
      setSalvo(regra.form)
      setSomenteLeitura(regra.somenteLeitura)
    } catch {
      if (sinal.vivo) setErroCarga('Sem conexão. Não foi possível carregar as regras de elenco.')
    } finally {
      if (sinal.vivo) setCarregando(false)
    }
  }, [categoriaId])

  useEffect(() => {
    const sinal = { vivo: true }
    setMensagem(null)
    setTentouSalvar(false)
    void carregar(sinal)
    return () => { sinal.vivo = false }
  }, [carregar])

  const erros = useMemo(() => validarForm(form), [form])
  const alterado = !iguais(form, salvo)

  if (indisponivel) return null

  function mudar(m: Partial<Omit<FormRegra, 'modelo'>>) {
    setMensagem(null)
    setForm((f) => ajustar(f, m))
  }

  function pedirSalvar() {
    setTentouSalvar(true)
    setMensagem(null)
    if (temErros(erros)) return
    setConfirmando(true)
  }

  async function salvar() {
    if (!categoriaId || salvando) return
    setSalvando(true)
    try {
      const r = await fetch(urlRegra(categoriaId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpoPut(form)),
      })
      const corpo = await r.json().catch(() => null)
      const t = tratarResposta(r.status, corpo)
      if (t.ok) {
        setSalvo(form)
        setMensagem({ ok: true, texto: 'Regras de elenco salvas.' })
      } else {
        if (t.tipo === 'conflito') setSomenteLeitura(true)
        setMensagem({ ok: false, texto: t.mensagem })
      }
    } catch {
      setMensagem({ ok: false, texto: 'Sem conexão. Tente de novo.' })
    } finally {
      setSalvando(false)
      setConfirmando(false)
    }
  }

  const bloqueado = somenteLeitura || carregando || salvando
  const erro = (campo: 'atletasMin' | 'atletasMax' | 'liberosMax' | 'comissaoMax') => (tentouSalvar || form[campo] !== salvo[campo] ? erros[campo] : undefined)

  return (
    <section className="grid gap-4 rounded-2xl border border-white/10 p-4" aria-labelledby="regras-elenco-titulo">
      <div>
        <h3 id="regras-elenco-titulo" className="text-xs font-black uppercase tracking-[0.16em] text-luva-amber">Regras de elenco</h3>
        <p className="mt-1 text-xs font-semibold text-slate-400">
          Escolha um modelo pronto e ajuste o que precisar. Vale para esta categoria. O servidor confere tudo de novo ao salvar.
        </p>
      </div>

      {!categoriaId ? (
        <p className="rounded-xl border border-white/12 bg-white/5 px-4 py-3 text-sm font-semibold text-white/80">Escolha uma categoria para definir as regras de elenco.</p>
      ) : (
        <>
          {somenteLeitura && (
            <p role="status" className="flex items-center gap-2 rounded-xl border border-luva-amber/40 bg-luva-amber/10 px-4 py-3 text-sm font-bold text-white">
              <Lock size={16} className="shrink-0 text-luva-amber" /> Campeonato finalizado: as regras só podem ser consultadas.
            </p>
          )}
          {carregando && <p className="flex items-center gap-2 text-sm font-bold text-slate-200"><Loader2 className="animate-spin" size={16} /> Carregando regras...</p>}
          {erroCarga && (
            <p role="alert" className="rounded-xl border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm font-bold text-white">
              {erroCarga}
              <button type="button" onClick={() => void carregar({ vivo: true })} className="ml-3 min-h-[44px] underline">Tentar de novo</button>
            </p>
          )}

          {!erroCarga && (
            <>
              <fieldset className="grid gap-2" disabled={bloqueado}>
                <legend className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-slate-300">Modelo</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {modelos.map((m) => (
                    <label
                      key={m.modelo}
                      className={`creator-category-option grid cursor-pointer gap-1 text-left focus-within:ring-2 focus-within:ring-luva-amber ${form.modelo === m.modelo ? 'is-selected' : ''}`}
                    >
                      <input
                        type="radio"
                        name="modelo-regra-elenco"
                        value={m.modelo}
                        checked={form.modelo === m.modelo}
                        onChange={() => { setMensagem(null); setForm((f) => aplicarModelo(f, m)) }}
                        className="sr-only"
                      />
                      <span className="flex flex-wrap items-center gap-2 text-sm font-black">
                        {m.nome}
                        {!m.confirmado && (
                          <span className="rounded-full bg-luva-amber/20 px-2 py-0.5 text-[11px] font-black text-luva-amber">Valores a confirmar</span>
                        )}
                      </span>
                      <span className="text-xs font-semibold opacity-80">{m.descricao}</span>
                    </label>
                  ))}
                </div>
                {modelos.some((m) => m.modelo === form.modelo && !m.confirmado) && (
                  <p className="flex items-start gap-2 text-xs font-semibold text-luva-amber">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0" /> Este modelo ainda não tem fonte oficial confirmada. Confira os valores com o regulamento antes de salvar.
                  </p>
                )}
              </fieldset>

              <fieldset className="grid gap-4" disabled={bloqueado}>
                <legend className="sr-only">Ajustes das regras</legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className={ROTULO}>
                    Mínimo de atletas
                    <input inputMode="numeric" className={CAMPO} value={form.atletasMin} onChange={(e) => mudar({ atletasMin: e.target.value })} aria-invalid={!!erro('atletasMin')} aria-describedby={erro('atletasMin') ? 'erro-atletasMin' : undefined} />
                    {erro('atletasMin') && <span id="erro-atletasMin" role="alert" className="text-xs font-bold normal-case tracking-normal text-red-300">{erro('atletasMin')}</span>}
                  </label>
                  <label className={ROTULO}>
                    Máximo de atletas
                    <input inputMode="numeric" className={CAMPO} value={form.atletasMax} onChange={(e) => mudar({ atletasMax: e.target.value })} aria-invalid={!!erro('atletasMax')} aria-describedby={erro('atletasMax') ? 'erro-atletasMax' : undefined} />
                    {erro('atletasMax') && <span id="erro-atletasMax" role="alert" className="text-xs font-bold normal-case tracking-normal text-red-300">{erro('atletasMax')}</span>}
                  </label>
                  <label className={ROTULO}>
                    Máximo de líberos
                    <input inputMode="numeric" className={CAMPO} value={form.liberosMax} onChange={(e) => mudar({ liberosMax: e.target.value })} aria-invalid={!!erro('liberosMax')} aria-describedby={erro('liberosMax') ? 'erro-liberosMax' : undefined} />
                    {erro('liberosMax') && <span id="erro-liberosMax" role="alert" className="text-xs font-bold normal-case tracking-normal text-red-300">{erro('liberosMax')}</span>}
                  </label>
                  <label className={ROTULO}>
                    Comissão técnica (máximo de pessoas)
                    <input inputMode="numeric" className={CAMPO} value={form.comissaoMax} onChange={(e) => mudar({ comissaoMax: e.target.value })} aria-invalid={!!erro('comissaoMax')} aria-describedby={erro('comissaoMax') ? 'erro-comissaoMax' : undefined} />
                    {erro('comissaoMax') && <span id="erro-comissaoMax" role="alert" className="text-xs font-bold normal-case tracking-normal text-red-300">{erro('comissaoMax')}</span>}
                  </label>
                </div>

                <div className="grid gap-2">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-300">Faixa de nascimento</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className={ROTULO}>
                      Nasceu a partir de
                      <input type="date" className={CAMPO} value={form.nascimentoDe} onChange={(e) => mudar({ nascimentoDe: e.target.value })} />
                    </label>
                    <label className={ROTULO}>
                      Nasceu até
                      <input type="date" className={CAMPO} value={form.nascimentoAte} onChange={(e) => mudar({ nascimentoAte: e.target.value })} />
                    </label>
                  </div>
                  <p className="text-xs font-semibold text-slate-300">{explicacaoNascimento(form.nascimentoDe, form.nascimentoAte)}</p>
                  {erros.nascimento && <p role="alert" className="text-xs font-bold text-red-300">{erros.nascimento}</p>}
                </div>

                <div className="grid gap-2">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-300">Documentos exigidos de cada atleta</p>
                  <div className="flex flex-wrap gap-2">
                    {DOCUMENTOS.map((d) => (
                      <label key={d.value} className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-slate-100 focus-within:ring-2 focus-within:ring-luva-amber">
                        <input
                          type="checkbox"
                          className="h-5 w-5 accent-[#ffb331]"
                          checked={form.documentosExigidos.includes(d.value)}
                          onChange={() => mudar({ documentosExigidos: alternarDocumento(form.documentosExigidos, d.value) })}
                        />
                        {d.rotulo}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid gap-1">
                  <DateTimePickerInput
                    id="regra-prazo-troca"
                    label="Prazo para trocar atletas (data e hora)"
                    value={form.prazoTrocaEm}
                    onChange={(iso) => mudar({ prazoTrocaEm: iso })}
                    disabled={bloqueado}
                  />
                  <p className="text-xs font-semibold text-slate-400">Depois desse momento, trocar atletas deixa de ser possível. Deixe em branco para não ter prazo.</p>
                </div>

                <label className="flex min-h-[44px] items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <span className="font-bold text-slate-100">Exigir autorização do responsável para atletas menores de idade</span>
                  <input
                    type="checkbox"
                    className="h-5 w-5 shrink-0 accent-[#ffb331]"
                    checked={form.exigeConsentimentoMenor}
                    onChange={(e) => mudar({ exigeConsentimentoMenor: e.target.checked })}
                  />
                </label>
              </fieldset>

              <div className="rounded-xl border border-luva-amber/30 bg-luva-amber/5 px-4 py-3" aria-live="polite">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-luva-amber">Resumo</p>
                <p className="mt-1 text-sm font-semibold leading-6 text-white">{fraseResumo(form)}</p>
              </div>

              {mensagem && (
                <p role={mensagem.ok ? 'status' : 'alert'} className={`rounded-xl border px-4 py-3 text-sm font-bold text-white ${mensagem.ok ? 'border-emerald-400/40 bg-emerald-400/10' : 'border-red-400/40 bg-red-400/10'}`}>
                  {mensagem.texto}
                </p>
              )}

              {!somenteLeitura && (
                <button
                  type="button"
                  onClick={pedirSalvar}
                  disabled={bloqueado || !alterado}
                  className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-luva-amber px-5 text-sm font-black text-[#07111f] focus:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:cursor-not-allowed disabled:opacity-50 sm:justify-self-start"
                >
                  {salvando && <Loader2 className="animate-spin" size={16} />} Salvar regras de elenco
                </button>
              )}
            </>
          )}
        </>
      )}

      {confirmando && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="titulo-confirma-regra">
          <div className="w-full max-w-md rounded-[1.5rem] border border-white/15 bg-[#0b1a2c] p-6">
            <h3 id="titulo-confirma-regra" className="text-xl font-black text-white">Salvar as regras de elenco?</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-200">{fraseResumo(form)}</p>
            <p className="mt-2 text-xs font-semibold text-slate-400">As equipes desta categoria passam a ser conferidas por estas regras.</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" disabled={salvando} onClick={() => setConfirmando(false)} className="min-h-[48px] rounded-2xl border border-white/20 px-4 text-sm font-black text-white disabled:opacity-50">Voltar</button>
              <button type="button" disabled={salvando} onClick={() => void salvar()} className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-luva-amber px-4 text-sm font-black text-[#07111f] disabled:opacity-60">
                {salvando && <Loader2 className="animate-spin" size={16} />} Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
