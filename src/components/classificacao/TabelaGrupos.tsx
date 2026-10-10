import { NomeEquipe } from '@/components/equipes/NomeEquipe'
import { saldoComSinal, type LinhaGrupo } from '@/lib/quadro-publico'

export function TabelaGrupos({ nome, linhas, vagas }: { nome: string; linhas: LinhaGrupo[]; vagas: number }) {
  return (
    <section aria-labelledby={`grupo-${nome}`} className="rounded-2xl border border-vs-border bg-vs-surface">
      <header className="border-b border-vs-border px-4 py-4">
        <h3 id={`grupo-${nome}`} className="font-display text-xl font-bold text-vs-text">{nome}</h3>
      </header>
      <table data-stack className="w-full text-sm text-vs-text">
        <caption className="sr-only">Classificação de {nome}</caption>
        <thead className="max-md:hidden">
          <tr className="border-b border-vs-border text-left text-xs font-bold uppercase tracking-[0.08em] text-vs-muted">
            {['#', 'Equipe', 'P', 'J', 'V', 'D', 'SP', 'SC', 'DS', 'DP', 'PE'].map((coluna) => (
              <th key={coluna} className={`px-2 py-3 ${coluna === '#' || coluna === 'Equipe' ? '' : 'text-right'}`}>{coluna}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha, indice) => {
            const classifica = vagas > 0 && indice < vagas
            return (
              <tr key={`${nome}-${linha.equipe}`} className="border-t border-vs-border">
                <td data-label="#" className={`border-l-4 px-2 py-2 font-display font-bold tabular-nums ${classifica ? 'border-vs-gold text-vs-gold' : 'border-transparent'}`}>{indice + 1}</td>
                <td data-label="Equipe" className="px-2 py-2 font-bold"><NomeEquipe nome={linha.equipe} /></td>
                <td data-label="P" className="px-2 py-2 text-right font-bold tabular-nums">{linha.pontos}</td>
                <td data-label="J" className="px-2 py-2 text-right tabular-nums">{linha.jogos}</td>
                <td data-label="V" className="px-2 py-2 text-right tabular-nums">{linha.vitorias}</td>
                <td data-label="D" className="px-2 py-2 text-right tabular-nums">{linha.derrotas}</td>
                <td data-label="SP" className="px-2 py-2 text-right tabular-nums">{linha.setsPro}</td>
                <td data-label="SC" className="px-2 py-2 text-right tabular-nums">{linha.setsContra}</td>
                <td data-label="DS" className="px-2 py-2 text-right tabular-nums">{saldoComSinal(linha.saldoSets)}</td>
                <td data-label="DP" className="px-2 py-2 text-right tabular-nums">{saldoComSinal(linha.saldoPontos)}</td>
                <td data-label="PE" className="px-2 py-2 text-right tabular-nums">{linha.punicoes > 0 ? linha.punicoes : '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}
