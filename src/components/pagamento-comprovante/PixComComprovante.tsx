'use client'

import { useEffect, useState } from 'react'
import { FormAlert } from '@/components/parametrizacao/ui/FormAlert'
import {
  CONFIG_VAZIA, corpoConfig, falhaEscondeArea, fraseResumo, mascaraReais, normalizarConfig, pagamentoComprovanteAtivo, textoConfirmacaoConfig,
  tituloConfirmacaoConfig, tratarRespostaPagamento, urlConfigCategoria, validarConfig, BENEFICIARIO_MAX, CHAVE_PIX_MAX, INSTRUCOES_MAX,
  type ConfigPagamento, type ErrosConfig,
} from '@/lib/pagamento-comprovante-ui'

type Categoria = { id: string; nome: string }

const campo = 'min-h-[44px] w-full rounded-xl border border-white/10 bg-[#07111f] px-3 py-2 text-sm font-semibold text-white placeholder:text-slate-500'
const rotulo = 'grid gap-1 text-xs font-black uppercase tracking-[0.14em] text-slate-300'

/** Bloco "Pix com comprovante" da seção Pagamento: uma configuração por categoria. Flag desligada: nada e nenhuma requisição. */
export function PixComComprovante({ ligaId }: { ligaId: number }) {
  const ativo = pagamentoComprovanteAtivo()
  const [categorias, setCategorias] = useState<Categoria[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!ativo) return
    let cancelado = false
    fetch(`/api/organizador/ligas/${ligaId}/categorias`, { cache: 'no-store' })
      .then(async (r) => {
        const corpo = await r.json().catch(() => null)
        if (!r.ok) throw new Error(typeof corpo?.error === 'string' ? corpo.error : 'Não foi possível carregar as categorias.')
        return (Array.isArray(corpo?.data) ? corpo.data : []) as Array<{ id: unknown; nome: unknown }>
      })
      .then((linhas) => {
        if (!cancelado) setCategorias(linhas.filter((l) => l.id != null).map((l) => ({ id: String(l.id), nome: typeof l.nome === 'string' ? l.nome : 'Categoria' })))
      })
      .catch((e) => { if (!cancelado) setErro(e instanceof Error ? e.message : 'Não foi possível carregar as categorias.') })
    return () => { cancelado = true }
  }, [ativo, ligaId])

  if (!ativo) return null

  return (
    <section className="mt-8" aria-labelledby="pix-comprovante-titulo">
      <h2 id="pix-comprovante-titulo" className="font-display text-xl font-black text-[#ffffff]">Pix com comprovante</h2>
      <p className="mt-1 text-sm font-semibold text-slate-300">
        Cobre a inscrição por categoria. O time paga por Pix, envia o comprovante e você confirma antes de aprovar. O dinheiro vai direto para a sua chave.
      </p>
      {erro && <div className="mt-3"><FormAlert variant="error">{erro}</FormAlert></div>}
      {!erro && categorias === null && <p className="mt-3 text-sm font-bold text-slate-300">Carregando categorias...</p>}
      {categorias && categorias.length === 0 && <div className="mt-3"><FormAlert variant="info">Este campeonato ainda não tem categorias. Crie as categorias primeiro.</FormAlert></div>}
      <div className="mt-4 grid gap-4">
        {categorias?.map((c) => <CategoriaPix key={c.id} categoria={c} />)}
      </div>
    </section>
  )
}

type Aviso = { ok: boolean; texto: string }

function CategoriaPix({ categoria }: { categoria: Categoria }) {
  const [carga, setCarga] = useState<'carregando' | 'pronto' | 'oculto' | 'erro'>('carregando')
  const [mensagemCarga, setMensagemCarga] = useState('')
  const [salvo, setSalvo] = useState<ConfigPagamento>(CONFIG_VAZIA)
  const [form, setForm] = useState<ConfigPagamento>(CONFIG_VAZIA)
  const [erros, setErros] = useState<ErrosConfig>({})
  const [confirmando, setConfirmando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const [tentativa, setTentativa] = useState(0)
  const id = `pix-${categoria.id}`

  useEffect(() => {
    const c = new AbortController()
    setCarga('carregando')
    fetch(urlConfigCategoria(categoria.id), { cache: 'no-store', signal: c.signal })
      .then(async (r) => {
        const corpo = await r.json().catch(() => null)
        const t = tratarRespostaPagamento(r.status, corpo)
        if (!t.ok) {
          if (falhaEscondeArea(t.tipo)) { setCarga('oculto'); setMensagemCarga(t.mensagem); return }
          setCarga('erro'); setMensagemCarga(t.mensagem); return
        }
        const config = normalizarConfig(corpo)
        setSalvo(config)
        setForm(config)
        setCarga('pronto')
      })
      .catch(() => { if (!c.signal.aborted) { setCarga('erro'); setMensagemCarga('Sem conexão. Tente de novo.') } })
    return () => c.abort()
  }, [categoria.id, tentativa])

  function mudar(parcial: Partial<ConfigPagamento>) {
    setForm((f) => ({ ...f, ...parcial }))
    setAviso(null)
    setErros({})
  }

  function pedirSalvar() {
    const e = validarConfig(form)
    setErros(e)
    if (Object.keys(e).length > 0) return
    setConfirmando(true)
  }

  async function salvar() {
    if (salvando) return
    setSalvando(true)
    try {
      const r = await fetch(urlConfigCategoria(categoria.id), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpoConfig(form)),
      })
      const corpo = await r.json().catch(() => null)
      const t = tratarRespostaPagamento(r.status, corpo)
      if (t.ok) {
        const config = normalizarConfig(corpo)
        const novo = corpo?.data ? config : form
        setSalvo(novo)
        setForm(novo)
        setAviso({ ok: true, texto: novo.modo === 'COMPROVANTE' ? 'Pix com comprovante ativado nesta categoria.' : 'Cobrança desativada nesta categoria.' })
      } else {
        setAviso({ ok: false, texto: t.mensagem })
      }
    } catch {
      setAviso({ ok: false, texto: 'Sem conexão. Tente de novo.' })
    } finally {
      setSalvando(false)
      setConfirmando(false)
    }
  }

  if (carga === 'oculto') {
    return <div className="creator-modal-section rounded-2xl border p-5"><p className="font-black text-white">{categoria.nome}</p><p className="mt-1 text-sm font-semibold text-slate-300">{mensagemCarga}</p></div>
  }

  const ligado = form.modo === 'COMPROVANTE'
  const alterado = JSON.stringify(form) !== JSON.stringify(salvo)

  return (
    <div className="creator-modal-section rounded-2xl border p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-lg font-black text-white">{categoria.nome}</p>
        <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-sm font-black text-white">
          <input
            type="checkbox" role="switch" checked={ligado} disabled={carga !== 'pronto'}
            onChange={(e) => mudar({ modo: e.target.checked ? 'COMPROVANTE' : 'NENHUM' })}
            className="h-6 w-6 accent-amber-400"
          />
          {ligado ? 'Cobrando por Pix' : 'Sem cobrança'}
        </label>
      </div>

      {carga === 'carregando' && <p className="mt-3 text-sm font-bold text-slate-300">Carregando...</p>}
      {carga === 'erro' && (
        <div className="mt-3">
          <FormAlert variant="error">{mensagemCarga}</FormAlert>
          <button type="button" onClick={() => setTentativa((n) => n + 1)} className="mt-2 min-h-[44px] text-sm font-black text-luva-amber underline">Tentar de novo</button>
        </div>
      )}

      {carga === 'pronto' && ligado && (
        <div className="mt-4 grid gap-3">
          <label className={rotulo} htmlFor={`${id}-valor`}>
            Valor por time (R$)
            <input
              id={`${id}-valor`} inputMode="numeric" autoComplete="off" value={form.valor} placeholder="150,00"
              onChange={(e) => mudar({ valor: mascaraReais(e.target.value) })}
              aria-invalid={erros.valor ? true : undefined} aria-describedby={erros.valor ? `${id}-valor-erro` : undefined} className={campo}
            />
            {erros.valor && <span id={`${id}-valor-erro`} role="alert" className="text-sm font-bold normal-case tracking-normal text-red-300">{erros.valor}</span>}
          </label>
          <label className={rotulo} htmlFor={`${id}-chave`}>
            Chave Pix
            <input
              id={`${id}-chave`} value={form.pixChave} maxLength={CHAVE_PIX_MAX} autoComplete="off" placeholder="E-mail, telefone, CPF/CNPJ ou chave aleatória"
              onChange={(e) => mudar({ pixChave: e.target.value })}
              aria-invalid={erros.pixChave ? true : undefined} aria-describedby={erros.pixChave ? `${id}-chave-erro` : undefined} className={campo}
            />
            {erros.pixChave && <span id={`${id}-chave-erro`} role="alert" className="text-sm font-bold normal-case tracking-normal text-red-300">{erros.pixChave}</span>}
          </label>
          <label className={rotulo} htmlFor={`${id}-benef`}>
            Quem recebe (beneficiário)
            <input
              id={`${id}-benef`} value={form.pixBeneficiario} maxLength={BENEFICIARIO_MAX} autoComplete="off" placeholder="Nome que aparece no Pix"
              onChange={(e) => mudar({ pixBeneficiario: e.target.value })}
              aria-invalid={erros.pixBeneficiario ? true : undefined} aria-describedby={erros.pixBeneficiario ? `${id}-benef-erro` : undefined} className={campo}
            />
            {erros.pixBeneficiario && <span id={`${id}-benef-erro`} role="alert" className="text-sm font-bold normal-case tracking-normal text-red-300">{erros.pixBeneficiario}</span>}
          </label>
          <label className={rotulo} htmlFor={`${id}-instr`}>
            Instruções para o time (opcional)
            <textarea
              id={`${id}-instr`} value={form.instrucoes} maxLength={INSTRUCOES_MAX} rows={3} placeholder="Ex.: pague até sexta e escreva o nome do time no Pix"
              onChange={(e) => mudar({ instrucoes: e.target.value })}
              aria-invalid={erros.instrucoes ? true : undefined} aria-describedby={erros.instrucoes ? `${id}-instr-erro` : undefined}
              className="rounded-xl border border-white/10 bg-[#07111f] px-3 py-2 text-sm font-semibold normal-case tracking-normal text-white placeholder:text-slate-500"
            />
            {erros.instrucoes && <span id={`${id}-instr-erro`} role="alert" className="text-sm font-bold normal-case tracking-normal text-red-300">{erros.instrucoes}</span>}
          </label>
        </div>
      )}

      {carga === 'pronto' && (
        <>
          <p className="mt-4 rounded-xl bg-white/5 px-3 py-2 text-sm font-semibold text-slate-100">{fraseResumo(form)}</p>
          <div aria-live="polite">
            {aviso && (
              <p role={aviso.ok ? 'status' : 'alert'} className={`mt-3 rounded-2xl border px-4 py-3 text-sm font-bold text-white ${aviso.ok ? 'border-emerald-400/40 bg-emerald-400/10' : 'border-red-400/40 bg-red-400/10'}`}>{aviso.texto}</p>
            )}
          </div>
          <button
            type="button" disabled={!alterado || salvando} onClick={pedirSalvar}
            className="public-primary-action mt-4 inline-flex min-h-[48px] w-full items-center justify-center rounded-full px-6 py-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            Salvar categoria
          </button>
        </>
      )}

      {confirmando && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center" role="alertdialog" aria-modal="true" aria-labelledby={`${id}-confirma`}>
          <div className="w-full max-w-md rounded-[1.5rem] border border-white/15 bg-[#0b1a2c] p-6">
            <h3 id={`${id}-confirma`} className="text-xl font-black text-white">{tituloConfirmacaoConfig(form)}</h3>
            <p className="mt-2 text-sm font-semibold text-slate-200">{textoConfirmacaoConfig(form, categoria.nome)}</p>
            {ligado && <p className="mt-2 break-all text-sm font-black text-luva-amber">Chave: {form.pixChave.trim()}</p>}
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" disabled={salvando} onClick={() => setConfirmando(false)} className="min-h-[48px] rounded-2xl border border-white/20 px-4 text-sm font-black text-white disabled:opacity-50">Voltar</button>
              <button type="button" disabled={salvando} onClick={() => void salvar()} className="min-h-[48px] rounded-2xl bg-luva-amber px-4 text-sm font-black text-[#07111f] disabled:opacity-60">{salvando ? 'Salvando...' : 'Confirmar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
