'use client'

import { useEffect, useRef, useState } from 'react'
import { CARD_ORDER, CARD_TITLES, type SetupCardKey } from '@/lib/championship-setup-status'
import { SECTION_WIZARD_REGISTRY } from '@/components/parametrizacao/sections/registry'
import { ParametrizacaoNoPainelProvider } from '@/components/parametrizacao/PainelParametrizacaoContext'
import { ToastProvider } from '@/components/parametrizacao/ui/Toast'

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
  const [escolhido, setEscolhido] = useState<number | null>(null)
  const idsAnteriores = useRef<number[]>([])

  useEffect(() => {
    const ids = ligas.map((liga) => liga.id)
    const novo = ids.find((id) => !idsAnteriores.current.includes(id))
    if (idsAnteriores.current.length > 0 && novo && campeonatoId === novo) setEscolhido(novo)
    idsAnteriores.current = ids
  }, [ligas, campeonatoId])

  if (ligas.length === 0) {
    return <p className="text-sm font-semibold text-slate-300">Crie um campeonato em Início para escolher o que parametrizar.</p>
  }

  const selecionado = ligas.some((liga) => liga.id === escolhido) ? escolhido : null
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
          <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Guias do campeonato">
            {CARD_ORDER.map((key) => {
              const ativa = key === guia
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={ativa}
                  onClick={() => setGuia(key)}
                  className={`shrink-0 rounded-full px-4 py-2 text-sm font-black transition ${ativa ? 'bg-luva-amber text-[#050914]' : 'border border-white/15 text-white hover:border-luva-amber/60'}`}
                >
                  {CARD_TITLES[key]}
                </button>
              )
            })}
          </div>
          <div className="mt-6">
            <ToastProvider>
              <ParametrizacaoNoPainelProvider openSection={(section) => setGuia(section as SetupCardKey)}>
                <Secao key={`${selecionado}-${guia}`} ligaId={selecionado} />
              </ParametrizacaoNoPainelProvider>
            </ToastProvider>
          </div>
        </div>
      )}
    </div>
  )
}
