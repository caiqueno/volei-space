import { TeamIdentity } from './TeamIdentity'
import mi from '@/styles/microinteracoes.module.css'

type Equipe = {
  id: number
  nome: string
  corHex: string | null
  logoUrl: string | null
  jogadores?: { id: number }[]
  quantidadeJogadores?: number | null
}

export function EquipeCard({ equipe, atraso = '0ms' }: { equipe: Equipe; atraso?: string }) {
  const color = equipe.corHex ?? '#185FA5'
  const atletas = Number.isFinite(Number(equipe.quantidadeJogadores))
    ? Number(equipe.quantidadeJogadores)
    : equipe.jogadores?.length ?? 0

  return (
    <article className={`group luva-card overflow-hidden rounded-2xl p-5 ${mi.entrar} ${mi.toque}`} style={{ animationDelay: atraso }}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <TeamIdentity nome={equipe.nome} cor={color} logoUrl={equipe.logoUrl} />
          <p className="mt-2 pl-[60px] text-xs font-bold text-slate-500">{atletas} atletas inscritos</p>
        </div>
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
          <span>Elenco</span>
          <span className={mi.numero}>{Math.min(100, Math.round((atletas / 14) * 100))}%</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
          <span className="block h-full rounded-full" style={{ width: `${Math.min(100, (atletas / 14) * 100)}%`, backgroundColor: color }} />
        </div>
      </div>
    </article>
  )
}
