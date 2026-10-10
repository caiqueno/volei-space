'use client'

import { ChaveamentoMataMata } from '@/components/mata-mata/ChaveamentoMataMata'
import { PodioFinal } from '@/components/classificacao/PodioFinal'
import { NomeEquipe } from '@/components/equipes/NomeEquipe'
import { resumirChavePublica, type SlotPublico } from '@/lib/chave-publica'
import type { ChavePublica } from '@/lib/portal-chave'

export function VistaChavePublica({ ligaId, chave }: { ligaId: number; chave: ChavePublica }) {
  if (!chave.temMataMata) return null
  const resumo = resumirChavePublica(chave.rounds, chave.thirdPlace)

  return (
    <section className="grid gap-4" aria-label="Mata-mata">
      {chave.podium.length > 0 && (
        <article className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#ffb331]">Pódio</p>
          <h2 className="mt-2 font-display text-2xl font-black text-white">Campeão, vice e 3º lugar</h2>
          <p className="mt-2 text-sm font-semibold text-slate-300">O 1º e o 2º saem da final. O 3º sai da disputa de 3º lugar, quando ela existe.</p>
          <div className="mt-6">
            <PodioFinal podium={chave.podium} />
          </div>
        </article>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        <CartaoResultado titulo="Final" slot={resumo.final} />
        {resumo.terceiro && <CartaoResultado titulo="3º lugar" slot={resumo.terceiro} />}
      </div>
      <article className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-5">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#ffb331]">Mata-mata</p>
        <h2 className="mt-2 font-display text-2xl font-black text-white">Chave</h2>
        <div className="mt-4">
          <ChaveamentoMataMata
            ligaId={ligaId}
            rounds={chave.rounds}
            champion={chave.champion}
            thirdPlace={chave.thirdPlace}
            organizerMode={false}
          />
        </div>
      </article>
    </section>
  )
}

function NomeDoLado({ equipe }: { equipe: { nome: string; vaga?: boolean } }) {
  if (equipe.vaga) return <>{equipe.nome}</>
  return <NomeEquipe nome={equipe.nome} />
}

function CartaoResultado({ titulo, slot }: { titulo: string; slot: SlotPublico }) {
  const partida = slot?.partida ?? null
  const sets = [...(partida?.sets ?? [])].sort((a, b) => a.numero - b.numero)
  return (
    <article className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-[#ffb331]">{titulo}</p>
      {!partida ? (
        <p className="mt-3 text-sm font-semibold text-slate-300">A definir</p>
      ) : (
        <>
          <p className="mt-3 text-lg font-black text-white">
            <NomeDoLado equipe={partida.equipeA} /> {partida.setsPorA ?? 0} × {partida.setsPorB ?? 0} <NomeDoLado equipe={partida.equipeB} />
          </p>
          {sets.length > 0 && (
            <p className="mt-2 text-sm font-bold text-slate-300">{sets.map((set) => `${set.pontosA}–${set.pontosB}`).join(' · ')}</p>
          )}
        </>
      )}
    </article>
  )
}
