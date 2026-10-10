import { TeamIdentity } from '@/components/equipes/TeamIdentity'
import { NomeEquipe } from '@/components/equipes/NomeEquipe'
import { EstadoVazio } from '@/components/ui/EstadoVazio'
import type { PlayerScoutRow } from '@/lib/player-scouts'

export type EquipeInfo = { nome: string; corHex: string | null; logoUrl: string | null }

type Props = {
  dados: PlayerScoutRow[]
  equipeInfoById: Map<number, EquipeInfo>
}

export function ScoutsGeraisTable({ dados, equipeInfoById }: Props) {
  if (dados.length === 0) {
    return (
      <EstadoVazio
        titulo="Nenhum scout registrado"
        descricao="Os scouts de cada atleta aparecerão aqui após a primeira súmula com ataques, bloqueios ou aces registrados."
      />
    )
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
      <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
        <h3 className="font-display text-xl font-black text-slate-950">Scouts gerais</h3>
        <p className="mt-1 text-xs font-black uppercase tracking-[0.14em] text-slate-500">Pontos, ataques, bloqueios e aces acumulados no campeonato</p>
      </div>
      <div className="max-w-full">
        <table data-stack className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
              {['#', 'Atleta', 'Equipe', 'PTS', 'ATQ', 'BLQ', 'ACE'].map((h) => (
                <th key={h} className={`px-4 py-5 text-center text-xs font-black uppercase tracking-[0.18em] ${h === 'Atleta' || h === 'Equipe' ? 'min-w-52 text-left' : ''}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {dados.map((entrada, index) => {
              const equipe = equipeInfoById.get(entrada.equipeId)
              return (
                <tr key={entrada.jogadorId} className="transition-colors hover:bg-amber-50/55">
                  <td data-label="Posição" className="px-4 py-3 text-center">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-sm font-black text-slate-500">
                      {index + 1}
                    </span>
                  </td>
                  <td data-label="Atleta" className="px-4 py-3">
                    <p className="truncate font-black text-slate-950 text-[1.3em]">{entrada.nome}</p>
                    {entrada.numero && <p className="mt-0.5 text-xs font-bold text-slate-400">#{entrada.numero}</p>}
                  </td>
                  <td data-label="Equipe" className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <TeamIdentity nome={equipe?.nome ?? 'Equipe'} cor={equipe?.corHex} logoUrl={equipe?.logoUrl} compact showName={false} />
                      <p className="truncate font-bold text-slate-700"><NomeEquipe nome={equipe?.nome} /></p>
                    </div>
                  </td>
                  <td data-label="Pontos" className="px-4 py-3 text-center text-xl font-black text-slate-950">{entrada.pontos}</td>
                  <td data-label="Ataques" className="px-4 py-3 text-center font-bold text-slate-400">{entrada.ataques}</td>
                  <td data-label="Bloqueios" className="px-4 py-3 text-center font-bold text-slate-400">{entrada.bloqueios}</td>
                  <td data-label="Aces" className="px-4 py-3 text-center font-bold text-slate-400">{entrada.aces}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
