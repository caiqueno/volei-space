'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Medal, ShieldOff, Sparkles, Swords } from 'lucide-react'
import { SectionWizardLayout } from '../../wizard/SectionWizardLayout'
import { WizardStepper, type WizardStepDef } from '../../wizard/WizardStepper'
import { WizardNavigation } from '../../wizard/WizardNavigation'
import { useSectionWizard } from '../../wizard/useSectionWizard'
import { Field } from '../../ui/Field'
import { ChoiceChips } from '../../ui/ChoiceChips'
import { ToggleCards } from '../../ui/ToggleCards'
import { CheckboxRow } from '../../ui/CheckboxRow'
import { FormAlert } from '../../ui/FormAlert'
import { PricingSummary } from '../../pricing/PricingSummary'
import PageLoading from '@/components/ui/page-loading'
import type { EliminatoriasSectionDTO } from '@/types/championship-setup'
import { formatEliminatoryPhase, getEliminatoryPhaseForTeams, getRequiredEliminatoryTeams } from '@/lib/eliminatorias'
import { computeTotalClassificadosFormula } from '@/lib/championship-validation'

const STEPS: WizardStepDef[] = [
  { key: 'fases', title: 'Fases' },
  { key: 'cruzamentos', title: 'Cruzamentos' },
  { key: 'extras', title: 'Terceiro lugar e extras' },
  { key: 'revisao', title: 'Revisão' },
]

const CHAVEAMENTO_OPTIONS = [
  { value: 'MANUAL' as const, label: 'Manual' },
  { value: 'RANKING_GERAL' as const, label: 'Ranking geral (em breve)' },
  { value: 'CRUZAMENTO_GRUPOS' as const, label: 'Cruzamento de grupos (em breve)' },
  { value: 'SORTEIO' as const, label: 'Sorteio (em breve)' },
]

export function EliminatoriasWizard({ ligaId }: { ligaId: number }) {
  const router = useRouter()
  const { data, loading, loadError, autosaveStatus, autosaveError, updateNow, flush, complete } =
    useSectionWizard<EliminatoriasSectionDTO>('eliminatorias', `/api/organizador/ligas/${ligaId}/setup/eliminatorias`)

  const [stepIndex, setStepIndex] = useState(0)
  const [visited, setVisited] = useState<Set<number>>(new Set([0]))
  const [completionIssues, setCompletionIssues] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  function goTo(index: number) {
    flush()
    setStepIndex(index)
    setVisited((current) => new Set(current).add(index))
    setCompletionIssues([])
  }

  async function handleNext() {
    setCompletionIssues([])
    if (stepIndex < STEPS.length - 1) {
      goTo(stepIndex + 1)
      return
    }
    setSaving(true)
    const result = await complete()
    setSaving(false)
    if (result.ok) router.push(`/painel/parametrizacao?ligaId=${ligaId}`)
    else setCompletionIssues(result.issues.map((issue) => issue.message))
  }

  // Fase inicial calculada automaticamente a partir dos classificados já
  // definidos em Estrutura/Classificação — não pergunta mais isso ao
  // organizador (só uma combinação é matematicamente coerente). Mesma
  // ramificação de validateClassificacaoEliminatoriaMatch: pontos corridos
  // nunca tem eliminatória; mata-mata puro usa quantidadeEquipes; os demais
  // formatos usam a fórmula de classificados por grupo.
  //
  // Precisa ficar ANTES dos returns condicionais de loading/erro abaixo —
  // hooks (useEffect) não podem ser chamados depois de um return
  // condicional, senão a contagem de hooks muda entre renders.
  const isPontosCorridos = data?.formato === 'PONTOS_CORRIDOS'
  const isMataMataPuro = data?.formato === 'MATA_MATA' || data?.formato === 'COPA_CURTA'
  const totalClassificados = !data ? 0 : isMataMataPuro ? Number(data.quantidadeEquipes ?? 0) : computeTotalClassificadosFormula(data)
  const faseCalculada = isPontosCorridos ? 'NENHUMA' : totalClassificados > 0 ? getEliminatoryPhaseForTeams(totalClassificados) : null

  useEffect(() => {
    if (data && faseCalculada && faseCalculada !== data.faseEliminatoria) {
      updateNow({ faseEliminatoria: faseCalculada })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faseCalculada, Boolean(data)])

  if (loading) return <PageLoading label="Carregando eliminatórias..." />
  if (loadError || !data) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <FormAlert variant="error">{loadError ?? 'Campeonato não encontrado.'}</FormAlert>
      </div>
    )
  }

  const vagas = getRequiredEliminatoryTeams(data.faseEliminatoria)
  const temEliminatoria = data.faseEliminatoria !== 'NENHUMA'

  return (
    <SectionWizardLayout
      ligaId={ligaId}
      section="eliminatorias"
      title="Eliminatórias"
      subtitle="A fase inicial é calculada automaticamente a partir dos classificados definidos em Classificação."
      autosaveStatus={autosaveStatus}
      autosaveError={autosaveError}
      priceSlot={<PricingSummary ligaId={ligaId} refreshKey={autosaveStatus} />}
    >
      <WizardStepper steps={STEPS} currentIndex={stepIndex} visitedIndexes={visited} onSelect={goTo} />

      <div className="mt-6 grid gap-4">
        {stepIndex === 0 && (
          <>
            {isPontosCorridos && (
              <FormAlert variant="info">Pontos corridos não tem fase eliminatória — a classificação final decide o campeão.</FormAlert>
            )}
            {!isPontosCorridos && totalClassificados === 0 && (
              <FormAlert variant="info">
                Configure {isMataMataPuro ? 'a quantidade de equipes em Estrutura' : 'os classificados por grupo em Classificação'} para calcular a fase inicial automaticamente.
              </FormAlert>
            )}
            {!isPontosCorridos && totalClassificados > 0 && faseCalculada && (
              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <Swords size={16} className="shrink-0 text-luva-amber" />
                <div className="flex-1">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Fase inicial (calculada automaticamente)</p>
                  <p className="text-sm font-bold text-white">{formatEliminatoryPhase(faseCalculada)} — {totalClassificados} equipe(s) classificada(s)</p>
                </div>
              </div>
            )}
            {!isPontosCorridos && totalClassificados > 0 && !faseCalculada && (
              <FormAlert variant="error">
                <p className="font-black">{totalClassificados} classificado(s) não formam uma chave eliminatória válida (2, 4, 8, 16 ou 32).</p>
                <p className="mt-1">
                  Ajuste {isMataMataPuro ? 'a quantidade de equipes em Estrutura' : 'os classificados por grupo ou os melhores classificados gerais'} em{' '}
                  <Link href={`/painel/parametrizacao/${isMataMataPuro ? 'estrutura' : 'classificacao'}?ligaId=${ligaId}`} className="underline">
                    corrigir
                  </Link>
                  .
                </p>
              </FormAlert>
            )}
          </>
        )}

        {stepIndex === 1 && (
          temEliminatoria ? (
            <Field label="Método de chaveamento" hint="Só o método manual tem execução automática hoje — os demais ficam configurados para quando o gerador automático estiver disponível.">
              <ChoiceChips value={data.metodoChaveamento} onChange={(value) => updateNow({ metodoChaveamento: value })} options={CHAVEAMENTO_OPTIONS} />
            </Field>
          ) : (
            <FormAlert variant="info">Sem fase eliminatória configurada — esta etapa não se aplica.</FormAlert>
          )
        )}

        {stepIndex === 2 && (
          temEliminatoria ? (
            <>
              <CheckboxRow label="Disputa de 3º lugar" checked={data.disputaTerceiroLugar} onChange={(v) => updateNow({ disputaTerceiroLugar: v })} disabled={vagas < 4} />
              <ToggleCards
                value={data.eliminatoriaIdaVolta}
                onChange={(v) => updateNow({ eliminatoriaIdaVolta: v })}
                trueOption={{ icon: Swords, title: 'Ida e volta', description: 'Dois jogos por confronto, com vencedor pelo agregado.' }}
                falseOption={{ icon: Medal, title: 'Jogo único', description: 'Um jogo decide o confronto.' }}
              />
              <CheckboxRow label="Golden set (em breve)" checked={data.goldenSet} onChange={(v) => updateNow({ goldenSet: v })} />
            </>
          ) : (
            <FormAlert variant="info">Sem fase eliminatória configurada — esta etapa não se aplica.</FormAlert>
          )
        )}

        {stepIndex === 3 && (
          <div className="grid gap-3">
            <ReviewRow icon={Swords} label="Fase inicial" value={formatEliminatoryPhase(data.faseEliminatoria)} />
            {temEliminatoria && (
              <>
                <ReviewRow icon={Sparkles} label="Chaveamento" value={CHAVEAMENTO_OPTIONS.find((o) => o.value === data.metodoChaveamento)?.label ?? 'Manual'} />
                <ReviewRow icon={Medal} label="Formato" value={data.eliminatoriaIdaVolta ? 'Ida e volta' : 'Jogo único'} />
                <ReviewRow icon={Medal} label="Disputa de 3º lugar" value={data.disputaTerceiroLugar ? 'Sim' : 'Não'} />
              </>
            )}
            {!temEliminatoria && <ReviewRow icon={ShieldOff} label="Situação" value="Não aplicável — concluído automaticamente" />}
          </div>
        )}

        {completionIssues.length > 0 && (
          <FormAlert variant="error">
            <p className="font-black">Não foi possível concluir:</p>
            <ul className="mt-1 list-disc pl-4">
              {completionIssues.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </FormAlert>
        )}
      </div>

      <WizardNavigation
        onBack={() => goTo(Math.max(0, stepIndex - 1))}
        backDisabled={stepIndex === 0}
        onNext={handleNext}
        isLastStep={stepIndex === STEPS.length - 1}
        saving={saving}
      />
    </SectionWizardLayout>
  )
}

function ReviewRow({ icon: Icon, label, value }: { icon: typeof Swords; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <Icon size={16} className="shrink-0 text-slate-400" />
      <p className="flex-1 text-xs font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="text-right text-sm font-bold text-white">{value}</p>
    </div>
  )
}
