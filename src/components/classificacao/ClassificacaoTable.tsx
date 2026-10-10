'use client'

import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { ActionBar } from '@/components/ui/action-bar'
import { TeamIdentity } from '@/components/equipes/TeamIdentity'
import { NomeEquipe } from '@/components/equipes/NomeEquipe'
import mi from '@/styles/microinteracoes.module.css'

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

export type ClassificacaoGroup = {
  id: string
  nome: string
  dados: Entrada[]
  automaticLimit: number
}

type Props = {
  dados: Entrada[]
  groups?: ClassificacaoGroup[]
  ligaId?: number | null
  organizadorId?: string | null
  requiredClassified?: number
  automaticLimit?: number
  initialManualClassifiedIds?: number[]
  organizerMode?: boolean
  locked?: boolean
  groupStageFinished?: boolean
}

export function ClassificacaoTable({
  dados,
  groups,
  ligaId,
  organizadorId,
  requiredClassified = 4,
  automaticLimit = 4,
  initialManualClassifiedIds = [],
  organizerMode = false,
  locked = false,
  groupStageFinished = false,
}: Props) {
  const [manualIds, setManualIds] = useState(() => new Set(initialManualClassifiedIds))
  const [message, setMessage] = useState('')
  const [savingId, setSavingId] = useState<number | null>(null)
  const tableGroups = useMemo(() => {
    const validGroups = (groups ?? []).filter((group) => group.dados.length > 0)
    if (validGroups.length) return validGroups
    return [{ id: 'geral', nome: 'Classificação geral', dados, automaticLimit }]
  }, [automaticLimit, dados, groups])

  const automaticIds = useMemo(() => {
    const ids = new Set<number>()
    tableGroups.forEach((group) => {
      const limit = Math.max(0, Number(group.automaticLimit || 0))
      group.dados.slice(0, limit).forEach((entrada) => ids.add(entrada.equipe.id))
    })
    return ids
  }, [tableGroups])

  const manualCount = manualIds.size
  const automaticCount = requiredClassified > 0 ? Math.min(automaticIds.size, requiredClassified) : 0
  const filled = Math.min(requiredClassified || automaticCount, automaticCount + manualCount)
  const hasManualSlots = requiredClassified > 0 && filled < requiredClassified
  const groupedMode = tableGroups.length > 1 || tableGroups[0]?.id !== 'geral'

  async function classifyTeam(equipeId: number, nome: string) {
    if (!ligaId || savingId) return
    setSavingId(equipeId)
    setMessage('')
    try {
      const response = await fetch('/api/classificacao/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ligaId, equipeId }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error ?? 'Não foi possível classificar a equipe.')
      setManualIds((current) => new Set([...Array.from(current), equipeId]))
      setMessage(payload.data?.message ?? `${nome} foi classificada manualmente pelo organizador.`)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Não foi possível classificar a equipe.')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="grid gap-5">
      {organizerMode && requiredClassified > 0 && (
        <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm font-bold text-slate-100 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Eliminatória: {filled}/{requiredClassified} classificado(s). {locked ? 'Chaveamento bloqueado para alterações.' : hasManualSlots ? 'Complete as vagas pendentes manualmente antes do chaveamento.' : !groupStageFinished ? 'Aguardando o fim de todos os jogos da fase de grupos.' : 'Quantidade completa para o chaveamento.'}
          </span>
          {ligaId && filled === requiredClassified && groupStageFinished && (
            <a
              href={`/fase-mata-mata?ligaId=${ligaId}${organizadorId ? `&organizador=${encodeURIComponent(organizadorId)}` : ''}`}
              className="inline-flex shrink-0 items-center justify-center rounded-full bg-[#ffb331] px-5 py-2.5 text-xs font-black uppercase tracking-[0.08em] text-slate-950 transition hover:bg-amber-300"
            >
              {locked ? 'Ver chaveamento' : 'Avançar de Fase'}
            </a>
          )}
        </div>
      )}
      {message && (
        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-100">
          {message}
        </div>
      )}

      {tableGroups.map((group, groupIndex) => (
        <section key={group.id} className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.08)] ${mi.entrar}`} style={{ animationDelay: `${Math.min(groupIndex, 4) * 40}ms` }}>
          {groupedMode && (
            <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
              <h3 className="font-display text-xl font-black text-slate-950">{group.nome}</h3>
              {organizerMode && (
                <p className="mt-1 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                  {Math.max(0, group.automaticLimit)} vaga(s) automática(s)
                </p>
              )}
            </div>
          )}
          <div className="max-w-full">
            <table data-stack className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  {[
                    '#', 'Equipe', 'P', 'J', 'V', 'D', 'SP', 'SC', 'DS', 'DP', 'PE',
                    ...(organizerMode ? ['Ação'] : []),
                  ].map((h) => (
                    <th key={h} className={`px-4 py-5 text-center text-xs font-black uppercase tracking-[0.18em] ${h === 'Equipe' ? 'min-w-72 text-left' : ''}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {group.dados.map((entrada, index) => {
                  const saldoSets = entrada.setsPro - entrada.setsContra
                  const saldoPontos = entrada.pontosPro - entrada.pontosContra
                  const autoClassificado = requiredClassified > 0 && automaticIds.has(entrada.equipe.id)
                  const manualClassificado = manualIds.has(entrada.equipe.id)
                  const classificado = autoClassificado || manualClassificado
                  const canClassify = organizerMode && ligaId && !locked && hasManualSlots && !classificado
                  const posicao = groupedMode ? index + 1 : entrada.posicao
                  return (
                    <tr key={entrada.equipe.id} className={`hover:bg-amber-50/55 ${mi.linha} ${posicao === 1 ? mi.lider : ''}`}>
                      <td data-label="Posição" className="px-4 py-3 text-center">
                        <span className={`inline-flex h-10 w-10 items-center justify-center rounded-full text-sm font-black ${mi.numero} ${classificado ? 'bg-luva-amber text-[#050914] shadow-lg shadow-amber-500/20' : 'bg-slate-100 text-slate-500'}`}>
                          {posicao}
                        </span>
                      </td>
                      <td data-label="Equipe" className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <TeamIdentity nome={entrada.equipe.nome} cor={entrada.equipe.corHex} logoUrl={entrada.equipe.logoUrl} compact showName={false} />
                          <div className="min-w-0">
                            <p className="truncate font-black text-slate-950 text-[1.3em]"><NomeEquipe nome={entrada.equipe.nome} /></p>
                            {organizerMode && autoClassificado && <div className="mt-1"><Badge variant="ouro">Classificado</Badge></div>}
                            {organizerMode && manualClassificado && <div className="mt-1"><Badge variant="info">Manual</Badge></div>}
                          </div>
                        </div>
                      </td>
                      <td data-label="Pontos" className={`px-4 py-3 text-center text-xl font-black text-slate-950 ${mi.numero}`}>{entrada.pontos}</td>
                      <td data-label="Jogos" className="px-4 py-3 text-center font-bold text-slate-400">{entrada.jogos}</td>
                      <td data-label="Vitórias" className="px-4 py-3 text-center font-black text-emerald-300">{entrada.vitorias}</td>
                      <td data-label="Derrotas" className="px-4 py-3 text-center font-bold text-red-300">{entrada.derrotas}</td>
                      <td data-label="Sets pró" className="px-4 py-3 text-center font-bold text-slate-400">{entrada.setsPro}</td>
                      <td data-label="Sets contra" className="px-4 py-3 text-center font-bold text-slate-400">{entrada.setsContra}</td>
                      <td data-label="Saldo de sets" className="px-4 py-3 text-center font-black text-slate-950">{saldoSets > 0 ? '+' : ''}{saldoSets}</td>
                      <td data-label="Saldo de pontos" className="px-4 py-3 text-center font-bold text-slate-400">{saldoPontos > 0 ? '+' : ''}{saldoPontos}</td>
                      <td data-label="Punições" className="px-4 py-3 text-center font-bold text-slate-500">{entrada.punicoes || '-'}</td>
                      {organizerMode && (
                        <td data-label="Ação" className="px-4 py-3 text-center">
                          {classificado ? (
                            <span className="text-xs font-black uppercase tracking-[0.14em] text-emerald-600">Classificado</span>
                          ) : canClassify ? (
                            <ActionBar
                              type="button"
                              onClick={() => classifyTeam(entrada.equipe.id, entrada.equipe.nome)}
                              loading={savingId === entrada.equipe.id}
                              loadingLabel="Classificando"
                              className="rounded-full bg-[#ffb331] px-4 py-2 text-xs font-black uppercase tracking-[0.08em] text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Classificar time
                            </ActionBar>
                          ) : (
                            <span className="text-xs font-bold text-slate-400">-</span>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  )
}
