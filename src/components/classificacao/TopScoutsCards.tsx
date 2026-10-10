import { Shield, Swords, Zap } from 'lucide-react'
import { TeamIdentity } from '@/components/equipes/TeamIdentity'
import { NomeEquipe } from '@/components/equipes/NomeEquipe'
import type { EquipeInfo } from '@/components/classificacao/ScoutsGeraisTable'
import type { PlayerScoutRow } from '@/lib/player-scouts'

type Props = {
  dados: PlayerScoutRow[]
  equipeInfoById: Map<number, EquipeInfo>
}

type Categoria = {
  key: 'ataques' | 'bloqueios' | 'aces'
  titulo: string
  icone: typeof Swords
}

const CATEGORIAS: Categoria[] = [
  { key: 'ataques', titulo: 'Top Atacantes', icone: Swords },
  { key: 'bloqueios', titulo: 'Top Bloqueadores', icone: Shield },
  { key: 'aces', titulo: 'Top Sacadores', icone: Zap },
]

export function TopScoutsCards({ dados, equipeInfoById }: Props) {
  return (
    <div className="grid gap-5 md:grid-cols-3">
      {CATEGORIAS.map((categoria) => {
        const top3 = [...dados]
          .filter((entrada) => entrada[categoria.key] > 0)
          .sort((a, b) => b[categoria.key] - a[categoria.key] || b.pontos - a.pontos || a.nome.localeCompare(b.nome))
          .slice(0, 3)
        const Icone = categoria.icone

        return (
          <section key={categoria.key} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
            <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-5 py-4">
              <Icone size={18} className="text-luva-amber" />
              <h3 className="font-display text-lg font-black text-slate-950">{categoria.titulo}</h3>
            </div>
            <div className="divide-y divide-slate-200">
              {top3.length === 0 ? (
                <p className="px-5 py-6 text-sm font-bold text-slate-400">Sem registros ainda</p>
              ) : (
                top3.map((entrada, index) => {
                  const equipe = equipeInfoById.get(entrada.equipeId)
                  return (
                    <div key={entrada.jogadorId} className="flex items-center gap-3 px-5 py-4">
                      <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black ${index === 0 ? 'bg-luva-amber text-[#050914]' : 'bg-slate-100 text-slate-500'}`}>
                        {index + 1}º
                      </span>
                      <TeamIdentity nome={equipe?.nome ?? 'Equipe'} cor={equipe?.corHex} logoUrl={equipe?.logoUrl} compact showName={false} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-black text-slate-950">{entrada.nome}</p>
                        <p className="truncate text-xs font-bold text-slate-400"><NomeEquipe nome={equipe?.nome} /></p>
                      </div>
                      <span className="shrink-0 text-xl font-black text-slate-950">{entrada[categoria.key]}</span>
                    </div>
                  )
                })
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}
