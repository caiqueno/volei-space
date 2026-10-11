import { LinhaScout } from '@/components/classificacao/LinhaScout'
import { ordenarScouts, type AtletaQuadro } from '@/lib/quadro-publico'

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
              <LinhaScout key={atleta.jogadorId} atleta={atleta} indice={indice} />
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
