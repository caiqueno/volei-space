'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { guardarCampoParaCorrigir, MISSING_FIELD_ANCHOR } from '../../wizard/missing-fields'
import { Medal, ShieldOff, Sparkles, Swords } from 'lucide-react'
import { useAbrirSecaoParametrizacao, useParametrizacaoNoPainel } from '../../PainelParametrizacaoContext'
import { abrirProximaSecao, salvarEAvancarEtapa } from '../../wizard/salvar-etapa'
import { SectionWizardLayout } from '../../wizard/SectionWizardLayout'
import { WizardStepper, type WizardStepDef } from '../../wizard/WizardStepper'
import { WizardNavigation } from '../../wizard/WizardNavigation'
import { useSectionWizard } from '../../wizard/useSectionWizard'
import { Field } from '../../ui/Field'
import { NumberInput } from '../../ui/NumberInput'
import { ChoiceChips } from '../../ui/ChoiceChips'
import { ToggleCards } from '../../ui/ToggleCards'
import { CheckboxRow } from '../../ui/CheckboxRow'
import { FormAlert } from '../../ui/FormAlert'
import { PricingSummary } from '../../pricing/PricingSummary'
import PageLoading from '@/components/ui/page-loading'
import type { EliminatoriasSectionDTO } from '@/types/championship-setup'
import { formatEliminatoryPhase, getEliminatoryPhaseForTeams, getRequiredEliminatoryTeams } from '@/lib/eliminatorias'
import { rotuloSetsDaFase } from '@/lib/sets-por-fase'
import { computeTotalClassificadosFormula } from '@/lib/championship-validation'
import { revealMissingFields } from '../../wizard/missing-fields'

const STEPS: WizardStepDef[] = [
  { key: 'fases', title: 'Fases' },
  { key: 'cruzamentos', title: 'Cruzamentos' },
  { key: 'extras', title: 'Terceiro lugar e extras' },
  { key: 'revisao', title: 'Revisão' },
]

const CHAVEAMENTO_OPTIONS = [
  { value: 'MANUAL' as const, label: 'Manual' },
  { value: 'RANKING_GERAL' as const, label: 'Ranking geral' },
  { value: 'CRUZAMENTO_GRUPOS' as const, label: 'Cruzamento de grupos' },
  { value: 'SORTEIO' as const, label: 'Sorteio' },
]

export function EliminatoriasWizard({ ligaId }: { ligaId: number }) {
  const router = useRouter()
  const noPainel = useParametrizacaoNoPainel()
  const abrir = useAbrirSecaoParametrizacao()
  const { data, loading, loadError, autosaveStatus, autosaveError, updateNow, flush, persist, complete } =
    useSectionWizard<EliminatoriasSectionDTO>('eliminatorias', `/api/organizador/ligas/${ligaId}/setup/eliminatorias`)

  const [stepIndex, setStepIndex] = useState(0)
  const [visited, setVisited] = useState<Set<number>>(new Set([0]))
  const [completionIssues, setCompletionIssues] = useState<string[]>([])
  const [invalidKeys, setInvalidKeys] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  function goTo(index: number) {
    flush()
    setStepIndex(index)
    setVisited((current) => new Set(current).add(index))
    setCompletionIssues([])
    setInvalidKeys([])
  }

  async function handleNext() {
    setCompletionIssues([])
    if (stepIndex < STEPS.length - 1) {
      setSaving(true)
      await salvarEAvancarEtapa({ persist, goTo, proximoIndice: stepIndex + 1, setCompletionIssues })
      setSaving(false)
      return
    }
    setSaving(true)
    const result = await complete()
    setSaving(false)
    if (result.ok) {
      abrirProximaSecao({ atual: 'eliminatorias', formato: data?.formato, ligaId, noPainel, abrir, router })
      return
    }
    const fields = result.fields ?? []
    setInvalidKeys(fields)
    setCompletionIssues(Array.isArray(result.issues) ? result.issues.map((issue) => issue.message) : [])
    revealMissingFields(fields, { faseEliminatoria: 0 }, setStepIndex, setVisited)
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

  function irParaCampoInvalido() {
    const secao = isMataMataPuro ? 'estrutura' : 'classificacao'
    const campo = isMataMataPuro ? 'quantidadeEquipes' : 'classificadosPorGrupo'
    guardarCampoParaCorrigir(secao, campo)
    if (abrir) {
      abrir(secao)
      return
    }
    const next = new URLSearchParams(window.location.search)
    next.set('ligaId', String(ligaId))
    next.set('campo', campo)
    const ancora = MISSING_FIELD_ANCHOR[campo] ?? campo
    router.push(`/painel/parametrizacao/${secao}?${next.toString()}#${ancora}`)
  }

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
          <div id="fase-eliminatoria" className={invalidKeys.includes('faseEliminatoria') ? 'field-missing grid gap-4 rounded-2xl p-1' : 'grid gap-4'}>
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
                  Ajuste {isMataMataPuro ? 'a quantidade de equipes' : 'os classificados por grupo'}.{' '}
                  <button type="button" onClick={irParaCampoInvalido} className="underline">
                    corrigir
                  </button>
                </p>
              </FormAlert>
            )}
          </div>
        )}

        {stepIndex === 1 && (
          temEliminatoria ? (
            <Field label="Método de chaveamento" hint="Cruzamento de grupos faz 1º A × 2º B e 1º B × 2º A. Ranking geral enfrenta 1º × último. Sorteio sorteia os classificados. Manual não monta a primeira rodada; as fases seguintes continuam saindo dos jogos já decididos.">
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
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Sets da final" hint="Em branco, a final usa a quantidade de sets do campeonato. O tie-break, quando ligado, vale no último set dessa quantidade.">
                  <NumberInput value={data.setsPorPartidaFinal} min={1} max={5} placeholder={String(data.setsPorPartida ?? 3)} onChange={(v) => updateNow({ setsPorPartidaFinal: v })} />
                </Field>
                {vagas >= 4 && (
                  <Field label="Sets da semifinal" hint="Em branco, usa a quantidade do campeonato.">
                    <NumberInput value={data.setsPorPartidaSemifinal} min={1} max={5} placeholder={String(data.setsPorPartida ?? 3)} onChange={(v) => updateNow({ setsPorPartidaSemifinal: v })} />
                  </Field>
                )}
                {vagas >= 4 && data.disputaTerceiroLugar && (
                  <Field label="Sets do 3º lugar" hint="Em branco, usa a quantidade do campeonato.">
                    <NumberInput value={data.setsPorPartidaTerceiroLugar} min={1} max={5} placeholder={String(data.setsPorPartida ?? 3)} onChange={(v) => updateNow({ setsPorPartidaTerceiroLugar: v })} />
                  </Field>
                )}
                {vagas >= 8 && (
                  <Field label="Sets das quartas" hint="Em branco, as quartas usam a quantidade de sets do campeonato.">
                    <NumberInput value={data.setsPorPartidaQuartas} min={1} max={5} placeholder={String(data.setsPorPartida ?? 3)} onChange={(v) => updateNow({ setsPorPartidaQuartas: v })} />
                  </Field>
                )}
                {vagas >= 16 && (
                  <Field label="Sets das oitavas" hint="Em branco, as oitavas usam a quantidade de sets do campeonato.">
                    <NumberInput value={data.setsPorPartidaOitavas} min={1} max={5} placeholder={String(data.setsPorPartida ?? 3)} onChange={(v) => updateNow({ setsPorPartidaOitavas: v })} />
                  </Field>
                )}
              </div>
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
                <ReviewRow icon={Medal} label="Sets da final" value={rotuloSetsDaFase(data.setsPorPartidaFinal, data.setsPorPartida)} />
                {vagas >= 4 && <ReviewRow icon={Medal} label="Sets da semifinal" value={rotuloSetsDaFase(data.setsPorPartidaSemifinal, data.setsPorPartida)} />}
                {vagas >= 4 && data.disputaTerceiroLugar && <ReviewRow icon={Medal} label="Sets do 3º lugar" value={rotuloSetsDaFase(data.setsPorPartidaTerceiroLugar, data.setsPorPartida)} />}
                {vagas >= 8 && <ReviewRow icon={Medal} label="Sets das quartas" value={rotuloSetsDaFase(data.setsPorPartidaQuartas, data.setsPorPartida)} />}
                {vagas >= 16 && <ReviewRow icon={Medal} label="Sets das oitavas" value={rotuloSetsDaFase(data.setsPorPartidaOitavas, data.setsPorPartida)} />}
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
