import { NomeEquipe } from '@/components/equipes/NomeEquipe'
import { ordenarScouts, pontosDoAtleta, type AtletaQuadro } from '@/lib/quadro-publico'

export function TabelaScouts({ atletas }: { atletas: AtletaQuadro[] }) {
  const linhas = ordenarScouts(atletas)
  return (
    <section aria-labelledby="scouts-gerais" className="rounded-2xl border border-vs-border bg-vs-surface">
      <header className="border-b border-vs-border px-4 py-4">
        <h3 id="scouts-gerais" className="font-display text-xl font-bold text-vs-text">Scouts gerais</h3>
        <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-vs-muted">Pontos, ataques, bloqueios e aces acumulados no campeonato</p>
      </header>
      {linhas.length === 0 ? (
        <p className="px-4 py-6 text-sm font-semibold text-vs-muted">Sem dados ainda</p>
      ) : (
        <table data-stack className="w-full text-sm text-vs-text">
          <caption className="sr-only">Scouts gerais de todos os atletas</caption>
          <thead className="max-md:hidden">
            <tr className="border-b border-vs-border text-left text-xs font-bold uppercase tracking-[0.12em] text-vs-muted">
              <th className="px-3 py-3">#</th>
              <th className="px-3 py-3">Atleta</th>
              <th className="px-3 py-3">Equipe</th>
              <th className="px-3 py-3 text-right">PTS</th>
              <th className="px-3 py-3 text-right">ATQ</th>
              <th className="px-3 py-3 text-right">BLQ</th>
              <th className="px-3 py-3 text-right">ACE</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((atleta, indice) => (
              <tr key={atleta.jogadorId} className="border-t border-vs-border">
                <td data-label="#" className="px-3 py-2 font-display font-bold tabular-nums text-vs-gold">{indice + 1}</td>
                <td data-label="Atleta" className="px-3 py-2 font-bold">{atleta.numero == null ? atleta.nome : `${atleta.nome} #${atleta.numero}`}</td>
                <td data-label="Equipe" className="px-3 py-2 font-semibold text-vs-muted"><NomeEquipe nome={atleta.equipe} /></td>
                <td data-label="PTS" className="px-3 py-2 text-right font-display text-lg font-bold tabular-nums">{pontosDoAtleta(atleta)}</td>
                <td data-label="ATQ" className="px-3 py-2 text-right tabular-nums">{atleta.ataque}</td>
                <td data-label="BLQ" className="px-3 py-2 text-right tabular-nums">{atleta.bloqueio}</td>
                <td data-label="ACE" className="px-3 py-2 text-right tabular-nums">{atleta.saque}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
