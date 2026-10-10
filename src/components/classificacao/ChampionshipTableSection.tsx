'use client'

import { CollapseBar } from '@/components/ui/collapse-bar'
import { ClassificacaoTable, type ClassificacaoGroup } from '@/components/classificacao/ClassificacaoTable'

type Entrada = {
  posicao: number
  equipe: { id: number; nome: string; corHex: string | null; logoUrl: string | null }
  pontos: number
  jogos: number
  vitorias: number
  derrotas: number
  setsPro: number
  setsContra: number
  pontosPro: number
  pontosContra: number
  punicoes: number
}

type Props = {
  nome: string
  regra: string
  dados: Entrada[]
  groups?: ClassificacaoGroup[]
  ligaId?: number | null
  categoriaCampeonatoId?: string | null
  organizadorId?: string | null
  requiredClassified?: number
  automaticClassifiedIds?: number[]
  automaticLimit?: number
  initialManualClassifiedIds?: number[]
  organizerMode?: boolean
  locked?: boolean
  groupStageFinished?: boolean
}

export function ChampionshipTableSection({
  nome,
  regra,
  dados,
  groups,
  ligaId,
  categoriaCampeonatoId,
  organizadorId,
  requiredClassified,
  automaticClassifiedIds,
  automaticLimit,
  initialManualClassifiedIds,
  organizerMode,
  locked,
  groupStageFinished,
}: Props) {
  return (
    <CollapseBar title={nome}>
      <p className="mb-5 max-w-3xl text-sm font-semibold leading-6 text-slate-200">{regra}</p>
      <ClassificacaoTable
        dados={dados}
        groups={groups}
        ligaId={ligaId}
        categoriaCampeonatoId={categoriaCampeonatoId}
        organizadorId={organizadorId}
        requiredClassified={requiredClassified}
        automaticClassifiedIds={automaticClassifiedIds}
        automaticLimit={automaticLimit}
        initialManualClassifiedIds={initialManualClassifiedIds}
        organizerMode={organizerMode}
        locked={locked}
        groupStageFinished={groupStageFinished}
      />
      <div className="mt-4 grid gap-3 text-xs font-black uppercase tracking-[0.12em] sm:grid-cols-2 lg:grid-cols-4">
        <span className="rounded-2xl border border-white/10 bg-white/5 p-3 text-slate-100">P = pontos</span>
        <span className="rounded-2xl border border-white/10 bg-white/5 p-3 text-slate-100">J, V, D = jogos, vitórias, derrotas</span>
        <span className="rounded-2xl border border-white/10 bg-white/5 p-3 text-slate-100">DS = saldo de sets</span>
        <span className="rounded-2xl border border-white/10 bg-white/5 p-3 text-slate-100">DP = saldo de pontos</span>
      </div>
    </CollapseBar>
  )
}
