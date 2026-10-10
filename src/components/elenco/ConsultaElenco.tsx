'use client'

import { useMemo, useState } from 'react'
import { filtrarElenco, type LinhaElenco } from '@/lib/grupos-fase'
import { NomeEquipe } from '@/components/equipes/NomeEquipe'

export function ConsultaElenco({ linhas }: { linhas: LinhaElenco[] }) {
  const [termo, setTermo] = useState('')
  const visiveis = useMemo(() => filtrarElenco(linhas, termo), [linhas, termo])
  const equipes = useMemo(() => {
    const grupos = new Map<string, LinhaElenco[]>()
    for (const linha of visiveis) {
      const chave = `${linha.grupo ?? 'Sem grupo'}::${linha.equipeId}`
      const lista = grupos.get(chave) ?? []
      lista.push(linha)
      grupos.set(chave, lista)
    }
    return Array.from(grupos.values())
  }, [visiveis])

  return (
    <div className="grid gap-4">
      <label className="grid gap-2">
        <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-300">Buscar por nome</span>
        <input
          value={termo}
          onChange={(evento) => setTermo(evento.target.value)}
          placeholder="Nome do jogador ou da equipe"
          className="rounded-2xl border border-white/10 bg-[#102033] px-4 py-3 text-sm font-bold text-white outline-none"
        />
      </label>
      {linhas.length === 0 ? (
        <p className="text-sm font-semibold text-slate-300">Nenhum jogador cadastrado neste campeonato.</p>
      ) : visiveis.length === 0 ? (
        <p className="text-sm font-semibold text-slate-300">Nenhum jogador encontrado para essa busca.</p>
      ) : (
        <div className="grid gap-4">
          {equipes.map((elenco) => {
            const primeira = elenco[0]
            return (
              <section key={`${primeira.equipeId}-${primeira.grupo ?? 'sem'}`} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#ffb331]">{primeira.grupo ?? 'Sem grupo'}</p>
                <h3 className="mt-1 font-display text-xl font-black text-white"><NomeEquipe nome={primeira.equipe} /></h3>
                <ul className="mt-3 divide-y divide-white/10">
                  {elenco.map((linha) => (
                    <li key={linha.jogadorId} className="flex items-center justify-between gap-3 py-2 text-sm font-bold text-white">
                      <span>{linha.jogador}</span>
                      <span className="text-[#ffb331]">{linha.numero ?? '—'}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
