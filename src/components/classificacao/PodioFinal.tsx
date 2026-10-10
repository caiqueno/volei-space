import { Trophy } from 'lucide-react'
import { TeamIdentity } from '@/components/equipes/TeamIdentity'
import type { PodiumTeam } from '@/lib/championship-podium'
import mi from '@/styles/microinteracoes.module.css'

type Posicao = 1 | 2 | 3

const POSITION_LABEL: Record<Posicao, string> = { 1: 'Campeão', 2: 'Vice-campeão', 3: '3º lugar' }
const POSITION_TAG: Record<Posicao, string> = { 1: 'Campeão', 2: 'Vice', 3: '3º lugar' }
const POSITION_ACCENT: Record<Posicao, string> = { 1: 'text-luva-amber', 2: 'text-slate-300', 3: 'text-orange-300' }
const POSITION_BLOCK: Record<Posicao, string> = {
  1: 'border-luva-amber/40 bg-luva-amber/15',
  2: 'border-slate-300/30 bg-slate-400/15',
  3: 'border-orange-300/30 bg-orange-400/15',
}

export function PodioFinal({ podium, variant = 'default' }: { podium: PodiumTeam[]; variant?: 'default' | 'hero' }) {
  const campeao = podium.find((team) => team.posicao === 1)
  if (!campeao) return null

  const vice = podium.find((team) => team.posicao === 2)
  const terceiro = podium.find((team) => team.posicao === 3)
  const ordem = [vice, campeao, terceiro].filter((team): team is PodiumTeam => Boolean(team))

  const isHero = variant === 'hero'

  return (
    <div
      role="list"
      aria-label="Pódio final do campeonato"
      className={`flex items-end justify-center ${isHero ? 'gap-3 sm:gap-6' : 'gap-4 sm:gap-8'}`}
    >
      {ordem.map((team) => (
        <PodioSpot key={team.equipeId} team={team} isHero={isHero} />
      ))}
    </div>
  )
}

function PodioSpot({ team, isHero }: { team: PodiumTeam; isHero: boolean }) {
  const accent = POSITION_ACCENT[team.posicao]
  const blockTone = POSITION_BLOCK[team.posicao]
  const heightClass = isHero
    ? ({ 1: 'h-14', 2: 'h-10', 3: 'h-8' } as const)[team.posicao]
    : ({ 1: 'h-28', 2: 'h-20', 3: 'h-16' } as const)[team.posicao]
  const markCompact = isHero || team.posicao !== 1

  const celebracao = team.posicao === 1
  const atraso = team.posicao === 2 ? '0ms' : team.posicao === 1 ? '70ms' : '35ms'

  return (
    <div role="listitem" className={`flex flex-col items-center ${celebracao ? `${mi.campeao} ${mi.entrar}` : mi.entrar}`} style={{ animationDelay: atraso }}>
      <Trophy size={isHero ? 14 : 20} className={`mb-1 shrink-0 ${accent} ${celebracao ? mi.pop : ''}`} aria-hidden="true" />
      <TeamIdentity nome={team.nome} cor={team.corHex} logoUrl={team.logoUrl} compact={markCompact} showName={false} />
      <p className={`mt-1.5 max-w-[86px] truncate text-center font-black text-white ${isHero ? 'text-[11px]' : 'text-sm'}`}>
        {team.nome}
      </p>
      <p className={`text-[9px] font-black uppercase tracking-[0.12em] ${accent}`}>{POSITION_TAG[team.posicao]}</p>
      <div
        className={`mt-2 flex items-start justify-center rounded-t-xl border ${blockTone} ${heightClass} ${isHero ? 'w-16 pt-1.5' : 'w-24 pt-2'}`}
      >
        <span className={`px-1 text-center font-black uppercase leading-tight tracking-[0.06em] ${accent} ${isHero ? 'text-[8px]' : 'text-[10px]'}`}>
          {POSITION_LABEL[team.posicao]}
        </span>
      </div>
    </div>
  )
}
