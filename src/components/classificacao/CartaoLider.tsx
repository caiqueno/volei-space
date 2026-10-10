import { Crown } from 'lucide-react'
import { NomeEquipe } from '@/components/equipes/NomeEquipe'
import type { LinhaGrupo } from '@/lib/quadro-publico'

export function CartaoLider({ lider }: { lider: LinhaGrupo }) {
  const jogos = lider.jogos === 1 ? '1 jogo' : `${lider.jogos} jogos`
  return (
    <article aria-label="Líder" className="rounded-2xl border border-vs-border bg-vs-elevated p-4">
      <p className="luva-kicker">Líder</p>
      <h2 className="mt-2 font-display text-3xl font-bold text-vs-text"><NomeEquipe nome={lider.equipe} /></h2>
      <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-vs-muted">
        <Crown size={16} className="text-vs-gold" aria-hidden="true" />
        <b className="font-display text-xl font-bold text-vs-gold">{lider.pontos}</b>
        pontos em {jogos}
      </p>
    </article>
  )
}
