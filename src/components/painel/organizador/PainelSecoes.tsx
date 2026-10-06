'use client'

import { useEffect, useRef, useState } from 'react'
import { CARD_TITLES, cartoesVisiveis, formatoPulaClassificacao, type SetupCardKey } from '@/lib/championship-setup-status'
import { consultar, invalidarConsultas } from '@/lib/api-cliente'
import { isCampeonatoFinalizado, MENSAGEM_CAMPEONATO_FINALIZADO } from '@/lib/championship-finalization'
import { SECTION_WIZARD_REGISTRY } from '@/components/parametrizacao/sections/registry'
import { ParametrizacaoNoPainelProvider } from '@/components/parametrizacao/PainelParametrizacaoContext'
import { ToastProvider } from '@/components/parametrizacao/ui/Toast'
import { CategoryNavigation, type SetupCategory } from '@/components/parametrizacao/CategoryControls'
import { flushWizardChanges } from '@/components/parametrizacao/wizard/useSectionWizard'
import { categoriaParaAbrir, chaveCategoriaAtiva, secaoExigeCategoria } from '@/lib/categoria-ativa'

type CampeonatoAba = { id: number; nome: string }

export function ParametrizacaoNoPainel({
  ligas,
  campeonatoId,
  onSelect,
}: {
  ligas: CampeonatoAba[]
  campeonatoId: number | null
  onSelect: (id: number) => void
}) {
  const [guia, setGuia] = useState<SetupCardKey>('informacoes')
  const [etapaInformacoes, setEtapaInformacoes] = useState(0)
  const [formato, setFormato] = useState<string | null>(null)
  const [escolhido, setEscolhido] = useState<number | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [confirmar, setConfirmar] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [erroFinalizacao, setErroFinalizacao] = useState<string | null>(null)
  const [categoriaAtivaId, setCategoriaAtivaId] = useState<string | null>(null)
  const [categorias, setCategorias] = useState<SetupCategory[]>([])
  const [revisaoCategorias, setRevisaoCategorias] = useState(0)
  const idsAnteriores = useRef<number[]>([])
  const geracaoCategoria = useRef(0)
  const selecionado = ligas.some((liga) => liga.id === escolhido) ? escolhido : null
  const finalizado = isCampeonatoFinalizado(status)

  useEffect(() => {
    const ids = ligas.map((liga) => liga.id)
    const novo = ids.find((id) => !idsAnteriores.current.includes(id))
    if (idsAnteriores.current.length > 0 && novo && campeonatoId === novo) setEscolhido(novo)
    idsAnteriores.current = ids
  }, [ligas, campeonatoId])

  useEffect(() => {
    const atualizar = () => setRevisaoCategorias((valor) => valor + 1)
    window.addEventListener('categories-updated', atualizar)
    return () => window.removeEventListener('categories-updated', atualizar)
  }, [])

  useEffect(() => {
    if (!selecionado) {
      setStatus(null)
      setFormato(null)
      setCategoriaAtivaId(null)
      setCategorias([])
      return
    }
    let cancelado = false
    const controlador = new AbortController()
    setStatus(null)
    setAviso(null)
    consultar<{ data?: { status?: string } }>(`/api/organizador/ligas/${selecionado}/setup/informacoes`, { signal: controlador.signal })
      .then((payload) => {
        if (!cancelado) setStatus(String(payload.data?.status ?? ''))
      })
      .catch(() => {
        if (!cancelado) setStatus('')
      })
    return () => {
      cancelado = true
      controlador.abort()
    }
  }, [selecionado])

  useEffect(() => {
    if (!selecionado) return
    let cancelado = false
    const geracaoNoInicio = geracaoCategoria.current
    const controlador = new AbortController()
    consultar<{ data?: SetupCategory[] }>(`/api/organizador/ligas/${selecionado}/categorias`, { signal: controlador.signal })
      .then((payload) => {
        if (cancelado || geracaoCategoria.current !== geracaoNoInicio) return
        const lista = payload.data ?? []
        setCategorias(lista)
        const ultima = window.sessionStorage.getItem(chaveCategoriaAtiva(selecionado))
        const escolhida = categoriaParaAbrir(lista, ultima)
        setCategoriaAtivaId(escolhida)
        if (escolhida) window.sessionStorage.setItem(chaveCategoriaAtiva(selecionado), escolhida)
      })
      .catch(() => {
        if (!cancelado && geracaoCategoria.current === geracaoNoInicio) {
          setCategorias([])
          setCategoriaAtivaId(null)
        }
      })
    return () => {
      cancelado = true
      controlador.abort()
    }
  }, [selecionado, revisaoCategorias])

  useEffect(() => {
    if (!selecionado || !categoriaAtivaId) return
    let cancelado = false
    const controlador = new AbortController()
    consultar<{ data?: { formato?: string | null } }>(`/api/organizador/ligas/${selecionado}/setup/estrutura?categoriaCampeonatoId=${encodeURIComponent(categoriaAtivaId)}`, { signal: controlador.signal })
      .then((payload) => {
        if (!cancelado) setFormato(payload.data?.formato ?? null)
      })
      .catch(() => {
        if (!cancelado) setFormato(null)
      })
    return () => {
      cancelado = true
      controlador.abort()
    }
  }, [selecionado, categoriaAtivaId])

  function definirCategoriaAtiva(id: string) {
    geracaoCategoria.current += 1
    setCategoriaAtivaId(id)
    if (selecionado) window.sessionStorage.setItem(chaveCategoriaAtiva(selecionado), id)
  }

  async function trocarCategoria(id: string) {
    if (id === categoriaAtivaId) return
    const salvo = await flushWizardChanges()
    if (!salvo) return
    definirCategoriaAtiva(id)
  }

  async function confirmarFinalizacao() {
    if (!selecionado || enviando) return
    setEnviando(true)
    setErroFinalizacao(null)
    const response = await fetch(`/api/organizador/ligas/${selecionado}/finalizar`, { method: 'POST' })
    const payload = await response.json().catch(() => ({}))
    setEnviando(false)
    if (!response.ok) {
      setErroFinalizacao(payload.error ?? 'Não foi possível finalizar o campeonato.')
      return
    }
    invalidarConsultas('/api/portal/ativos')
    invalidarConsultas('/api/ligas')
    setStatus('FINALIZADO')
    setConfirmar(false)
    setAviso(payload.data?.mensagem ?? 'Campeonato finalizado. Ele permanece disponível para consulta e apresentação.')
  }

  if (ligas.length === 0) {
    return <p className="text-sm font-semibold text-slate-300">Crie um campeonato em Início para escolher o que parametrizar.</p>
  }
  useEffect(() => {
    if (formatoPulaClassificacao(formato) && guia === 'classificacao') setGuia('eliminatorias')
  }, [formato, guia])

  function abrirSecao(section: string, etapa?: number) {
    if (section === 'informacoes') setEtapaInformacoes(etapa ?? 0)
    setGuia(section as SetupCardKey)
  }

  const guias = cartoesVisiveis(formato)
  const Secao = selecionado ? SECTION_WIZARD_REGISTRY[guia].component : null

  return (
    <div>
      <label className="block">
        <span className="luva-kicker">Selecione o seu campeonato</span>
        <select
          value={selecionado ?? ''}
          onChange={(event) => {
            const id = Number(event.target.value)
            if (!Number.isInteger(id) || id <= 0) return
            onSelect(id)
            setEscolhido(id)
            setEtapaInformacoes(0)
            setGuia('informacoes')
          }}
          className="mt-3 w-full rounded-2xl border border-white/15 bg-[#061426] px-4 py-3 text-sm font-black text-white outline-none focus:border-luva-amber"
        >
          <option value="" disabled>Selecione o seu campeonato</option>
          {ligas.map((liga) => (
            <option key={liga.id} value={liga.id}>{liga.nome}</option>
          ))}
        </select>
      </label>

      {selecionado && Secao && (
        <div className="mt-6">
          {aviso && (
            <p className="mb-4 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm font-bold text-emerald-100">{aviso}</p>
          )}
          {finalizado && (
            <p className="mb-4 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-bold text-white">
              {MENSAGEM_CAMPEONATO_FINALIZADO}
            </p>
          )}
          {status === 'ATIVA' && !finalizado && (
            <button
              type="button"
              onClick={() => {
                setErroFinalizacao(null)
                setConfirmar(true)
              }}
              className="mb-4 inline-flex items-center justify-center rounded-full border border-white/20 px-5 py-3 text-sm font-black text-white hover:border-luva-amber"
            >
              Finalizar campeonato
            </button>
          )}
          <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Guias do campeonato">
            {guias.map((key) => {
              const ativa = key === guia
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={ativa}
                  onClick={() => abrirSecao(key)}
                  className={`shrink-0 rounded-full px-4 py-2 text-sm font-black transition ${ativa ? 'bg-luva-amber text-[#050914]' : 'border border-white/15 text-white hover:border-luva-amber/60'}`}
                >
                  {CARD_TITLES[key]}
                </button>
              )
            })}
          </div>
          <div className="mt-4">
            <CategoryNavigation ligaId={selecionado} categorias={categorias} ativaId={categoriaAtivaId} onSelect={trocarCategoria} aoSemCategoria={() => abrirSecao('informacoes', 4)} />
          </div>
          <fieldset disabled={finalizado} className="mt-6 min-w-0 border-0 p-0 disabled:opacity-80">
            <ToastProvider>
              <ParametrizacaoNoPainelProvider openSection={abrirSecao} definirFormato={setFormato} categoriaAtivaId={categoriaAtivaId} definirCategoriaAtiva={definirCategoriaAtiva}>
                {secaoExigeCategoria(guia) && !categoriaAtivaId ? (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                    <p className="text-sm font-bold text-white">Esta etapa precisa de uma categoria.</p>
                    <button type="button" onClick={() => abrirSecao('informacoes', 4)} className="mt-3 text-sm font-black text-amber-200 underline">
                      Selecione as categorias do campeonato
                    </button>
                  </div>
                ) : (
                  <Secao key={`${selecionado}-${guia}-${etapaInformacoes}-${categoriaAtivaId ?? ''}`} ligaId={selecionado} etapaInicial={guia === 'informacoes' ? etapaInformacoes : 0} />
                )}
              </ParametrizacaoNoPainelProvider>
            </ToastProvider>
          </fieldset>
          {confirmar && (
            <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="finalizar-campeonato-titulo">
              <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#061426] p-5">
                <h2 id="finalizar-campeonato-titulo" className="font-display text-xl font-black text-white">Finalizar campeonato</h2>
                <p className="mt-3 text-sm font-semibold leading-6 text-slate-200">
                  Tem certeza de que deseja finalizar este campeonato? Após a finalização, ele ficará disponível apenas para consulta e apresentação. Não será possível realizar alterações operacionais.
                </p>
                {erroFinalizacao && <p className="mt-3 text-sm font-bold text-amber-200">{erroFinalizacao}</p>}
                <div className="mt-5 flex flex-wrap justify-end gap-3">
                  <button type="button" onClick={() => setConfirmar(false)} disabled={enviando} className="rounded-full border border-white/20 px-4 py-2 text-sm font-black text-white">
                    Cancelar
                  </button>
                  <button type="button" onClick={confirmarFinalizacao} disabled={enviando} className="rounded-full bg-luva-amber px-4 py-2 text-sm font-black text-[#050914] disabled:opacity-60">
                    {enviando ? 'Finalizando...' : 'Confirmar finalização'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
