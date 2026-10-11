import { NomeEquipe } from '@/components/equipes/NomeEquipe'
import { pontosDoAtleta, type AtletaQuadro } from '@/lib/quadro-publico'

export const COLUNAS_RANKING = ['#', 'Atleta', 'PTS', 'ATQ', 'BLQ', 'ACE'] as const

export function nomeDoAtleta(atleta: Pick<AtletaQuadro, 'nome' | 'numero'>) {
  return atleta.numero == null ? atleta.nome : `${atleta.nome} #${atleta.numero}`
}

export function LinhaScout({ atleta, indice }: { atleta: AtletaQuadro; indice: number }) {
  return (
    <tr className="border-t border-vs-border">
      <td data-label="#" className="px-3 py-2 font-display font-bold tabular-nums text-vs-gold">{indice + 1}</td>
      <td data-label="Atleta" className="px-3 py-2 font-bold">{nomeDoAtleta(atleta)}</td>
      <td data-label="Equipe" className="px-3 py-2 font-semibold text-vs-muted"><NomeEquipe nome={atleta.equipe} /></td>
      <td data-label="PTS" className="px-3 py-2 text-right font-display text-lg font-bold tabular-nums">{pontosDoAtleta(atleta)}</td>
      <td data-label="ATQ" className="px-3 py-2 text-right tabular-nums">{atleta.ataque}</td>
      <td data-label="BLQ" className="px-3 py-2 text-right tabular-nums">{atleta.bloqueio}</td>
      <td data-label="ACE" className="px-3 py-2 text-right tabular-nums">{atleta.saque}</td>
    </tr>
  )
}
