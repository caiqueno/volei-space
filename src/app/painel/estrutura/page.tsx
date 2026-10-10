'use client'

import Link from 'next/link'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  MapPin,
  RefreshCcw,
  Save,
  ShieldCheck,
  Shuffle,
  UsersRound,
} from 'lucide-react'
import { ActionBar } from '@/components/ui/action-bar'
import { formatEliminatoryPhase, getRequiredEliminatoryTeams } from '@/lib/eliminatorias'
import { LinksCategoria } from '@/components/painel/organizador/LinksCategoria'

type Equipe = {
  id: number
  nome: string
  categoria?: string | null
  serie?: string | null
  quantidadeJogadores?: number
  elencoAtualizadoEm?: string | null
  jogadores?: Array<{
    id: number
    nome: string
    numero?: number | null
    posicao?: string | null
    status?: 'ATIVO' | 'INATIVO'
  }>
}

type Liga = {
  id: number
  nome: string
  slug: string
  quantidadeGrupos?: number | null
  classificadosPorGrupo?: number | null
  faseEliminatoria?: string | null
}

type GrupoState = {
  nome: string
  equipeIds: number[]
}

type Partida = {
  id: number
  equipeAId: number
  equipeBId: number
  rodada: number
  status: string
  grupoId?: number | null
  dataHora?: string | null
  localNome?: string | null
  fase?: string | null
  escala?: Array<{
    id: number
    arbitroId: number
    cargo?: string | null
    arbitro?: { id: number; nome: string; email?: string | null } | null
  }>
}

type Arbitro = {
  id: string
  nome: string
  email?: string | null
  status?: string | null
  arbitroId?: number | null
}

type CalendarDraft = {
  data: string
  horario: string
  localNome: string
  mandanteId: string
  arbitroId: string
  status: string
}

function EstruturaContent() {
  const searchParams = useSearchParams()
  const ligaId = searchParams.get('ligaId')
  const [liga, setLiga] = useState<Liga | null>(null)
  const [equipes, setEquipes] = useState<Equipe[]>([])
  const [grupos, setGrupos] = useState<GrupoState[]>([])
  const [partidas, setPartidas] = useState<Partida[]>([])
  const [arbitros, setArbitros] = useState<Arbitro[]>([])
  const [calendarDrafts, setCalendarDrafts] = useState<Record<number, CalendarDraft>>({})
  const [quantidadeGrupos, setQuantidadeGrupos] = useState(2)
  const [classificadosPorGrupo, setClassificadosPorGrupo] = useState(2)
  const [metodo, setMetodo] = useState<'AUTO' | 'MANUAL'>('AUTO')
  const [turnoReturno, setTurnoReturno] = useState(false)
  const [dataInicial, setDataInicial] = useState('')
  const [horarioPadrao, setHorarioPadrao] = useState('17:00')
  const [localPadrao, setLocalPadrao] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [calendarSaving, setCalendarSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [paymentRequired, setPaymentRequired] = useState(false)

  useEffect(() => {
    if (!ligaId) {
      setLoading(false)
      return
    }
    loadEstrutura(ligaId)
    loadArbitros()
  }, [ligaId])

  const equipeById = useMemo(() => new Map(equipes.map((equipe) => [equipe.id, equipe])), [equipes])
  const grupoById = useMemo(() => {
    const byName = new Map(grupos.map((grupo) => [grupo.nome, grupo]))
    return new Map(partidas.map((partida) => {
      const found = Array.from(byName.keys()).find((nome) => {
        const grupo = byName.get(nome)
        return grupo?.equipeIds.includes(partida.equipeAId) && grupo?.equipeIds.includes(partida.equipeBId)
      })
      return [partida.id, found || 'Grupo']
    }))
  }, [grupos, partidas])

  const eliminatoryRequired = useMemo(() => getRequiredEliminatoryTeams(liga?.faseEliminatoria), [liga?.faseEliminatoria])
  const validation = useMemo(() => validateDistribution(grupos, equipes, classificadosPorGrupo, eliminatoryRequired), [grupos, equipes, classificadosPorGrupo, eliminatoryRequired])
  const automaticClassified = useMemo(() => grupos.reduce((total, grupo) => total + Math.min(classificadosPorGrupo, grupo.equipeIds.length), 0), [grupos, classificadosPorGrupo])
  const manualClassifiedNeeded = Math.max(0, eliminatoryRequired - automaticClassified)

  const confrontosPrevistos = useMemo(() => {
    let total = 0
    grupos.forEach((grupo) => {
      total += (grupo.equipeIds.length * (grupo.equipeIds.length - 1)) / 2
    })
    return turnoReturno ? total * 2 : total
  }, [grupos, turnoReturno])
  const hasGeneratedCalendar = partidas.length > 0
  const unassignedTeams = useMemo(() => {
    const assignedIds = new Set(grupos.flatMap((grupo) => grupo.equipeIds))
    return equipes.filter((equipe) => !assignedIds.has(equipe.id))
  }, [equipes, grupos])

  async function loadEstrutura(id: string) {
    setLoading(true)
    setMessage('')
    const response = await fetch(`/api/organizador/ligas/${id}/estrutura`, { cache: 'no-store' })
    const payload = await response.json()
    if (!response.ok) {
      if (payload.details?.code === 'PAGAMENTO_PENDENTE') {
        setPaymentRequired(true)
      } else {
        setMessage(payload.error || 'Erro ao carregar estrutura.')
      }
      setLoading(false)
      return
    }

    const data = payload.data
    const loadedLiga = data.liga as Liga
    const loadedEquipes = (data.equipes ?? []) as Equipe[]
    const loadedGroups = data.grupos ?? []
    const groupCount = Math.max(1, Number(loadedLiga.quantidadeGrupos ?? loadedGroups.length ?? 2))

    setLiga(loadedLiga)
    setEquipes(loadedEquipes)
    setQuantidadeGrupos(groupCount)
    setClassificadosPorGrupo(Number(loadedLiga.classificadosPorGrupo ?? 2))
    const loadedPartidas = (data.partidas ?? []) as Partida[]
    setPartidas(loadedPartidas)
    setCalendarDrafts(buildCalendarDrafts(loadedPartidas))

    if (loadedGroups.length > 0) {
      setGrupos(loadedGroups.map((grupo: any) => ({
        nome: grupo.nome,
        equipeIds: (grupo.equipes ?? []).map((item: any) => Number(item.equipeId)).filter(Number.isInteger),
      })))
    } else {
      setGrupos(distributeAutomatically(loadedEquipes, buildGroupNames(groupCount)))
    }
    setLoading(false)
  }

  async function loadArbitros() {
    const response = await fetch('/api/organizador/arbitros', { cache: 'no-store' })
    const payload = await response.json().catch(() => null)
    if (!response.ok) return
    setArbitros(((payload?.data ?? []) as Arbitro[]).filter((arbitro) => (
      String(arbitro.status || '').toUpperCase() === 'APROVADA' && Boolean(arbitro.arbitroId)
    )))
  }

  function changeGroupCount(nextCount: number) {
    const safeCount = Math.max(1, Math.min(12, nextCount))
    setQuantidadeGrupos(safeCount)
    setGrupos(distributeAutomatically(equipes, buildGroupNames(safeCount)))
  }

  function drawAgain() {
    if (equipes.length === 0) {
      setMessage('Nenhuma equipe aprovada está disponível para o sorteio.')
      return
    }

    const groupNames = normalizeCurrentGroupNames(grupos, quantidadeGrupos)
    setGrupos(distributeAutomatically(shuffleTeams(equipes), groupNames))
    setMetodo('AUTO')
    setMessage(`Sorteio concluído: ${equipes.length} equipe(s) distribuída(s) em ${groupNames.length} grupo(s). Revise o resultado antes de confirmar.`)
  }

  function startManualDistribution() {
    setMetodo('MANUAL')
    setGrupos(normalizeCurrentGroupNames(grupos, quantidadeGrupos).map((nome) => ({ nome, equipeIds: [] })))
    setMessage('Montagem manual iniciada. Distribua todas as equipes nos grupos antes de confirmar.')
  }

  function updateGroupName(index: number, value: string) {
    setGrupos((current) => current.map((grupo, groupIndex) => (
      groupIndex === index ? { ...grupo, nome: value || `Grupo ${String.fromCharCode(65 + index)}` } : grupo
    )))
  }

  function moveTeam(equipeId: number, groupIndex: number | null) {
    setMetodo('MANUAL')
    setGrupos((current) => current.map((grupo, index) => ({
      ...grupo,
      equipeIds: groupIndex !== null && index === groupIndex
        ? Array.from(new Set([...grupo.equipeIds, equipeId]))
        : grupo.equipeIds.filter((id) => id !== equipeId),
    })))
    setMessage('Distribuição manual alterada. Confirme a estrutura para salvar.')
  }

  async function saveStructure() {
    if (!ligaId || validation) return
    setSaving(true)
    setMessage('')
    const response = await fetch(`/api/organizador/ligas/${ligaId}/estrutura`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quantidadeGrupos,
        nomesGrupos: grupos.map((grupo) => grupo.nome),
        classificadosPorGrupo,
        metodoDistribuicao: metodo,
        grupos,
        turnoReturno,
        dataInicial,
        horarioPadrao,
        localPadrao,
      }),
    })
    const payload = await response.json()
    setSaving(false)
    if (!response.ok) {
      setMessage(payload.error || 'Erro ao salvar estrutura.')
      return
    }
    const partidasGeradas = Number(payload.data.partidasGeradas ?? 0)
    await loadEstrutura(ligaId)
    setMessage(`Estrutura salva com sucesso. ${partidasGeradas} confronto(s) gerado(s).`)
  }

  function updateCalendarDraft(partidaId: number, field: keyof CalendarDraft, value: string) {
    setCalendarDrafts((current) => ({
      ...current,
      [partidaId]: {
        ...current[partidaId],
        [field]: value,
      },
    }))
  }

  async function saveCalendar() {
    if (!ligaId || partidas.length === 0) return
    setCalendarSaving(true)
    setMessage('')
    const response = await fetch(`/api/organizador/ligas/${ligaId}/calendario`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        partidas: partidas.map((partida) => {
          const draft = calendarDrafts[partida.id]
          return {
            id: partida.id,
            data: draft?.data || null,
            horario: draft?.horario || null,
            localNome: draft?.localNome || '',
            mandanteId: Number(draft?.mandanteId || partida.equipeAId),
            arbitroId: draft?.arbitroId ? Number(draft.arbitroId) : null,
            status: draft?.status || partida.status,
          }
        }),
      }),
    })
    const payload = await response.json()
    setCalendarSaving(false)
    if (!response.ok) {
      setMessage(payload.error || 'Erro ao salvar calendário.')
      return
    }
    setMessage(`Calendário atualizado. ${payload.data.atualizadas} partida(s) revisada(s).`)
    await loadEstrutura(ligaId)
  }

  if (!ligaId) {
    return (
      <main className="luva-shell public-dashboard min-h-screen px-4 py-10 text-white">
        <section className="mx-auto max-w-3xl rounded-[2rem] border border-white/10 bg-white/5 p-8">
          <AlertTriangle className="text-luva-amber" />
          <h1 className="mt-4 font-display text-3xl font-black">Campeonato não informado</h1>
          <Link href="/painel" className="mt-6 inline-flex rounded-full bg-[#ffb331] px-5 py-3 text-sm font-black text-white">Voltar ao painel</Link>
        </section>
      </main>
    )
  }

  if (paymentRequired) {
    return (
      <main className="luva-shell public-dashboard min-h-screen px-4 py-10 text-white">
        <section className="mx-auto max-w-3xl rounded-[2rem] border border-white/10 bg-white/5 p-8">
          <AlertTriangle className="text-luva-amber" />
          <h1 className="mt-4 font-display text-3xl font-black">Pagamento pendente</h1>
          <p className="mt-2 text-sm font-semibold text-slate-300">
            A criação de grupos e do calendário só fica disponível depois que o pagamento da ativação deste campeonato é confirmado.
          </p>
          <Link
            href={`/painel/parametrizacao/previa?ligaId=${ligaId}`}
            className="mt-6 inline-flex rounded-full bg-[#ffb331] px-5 py-3 text-sm font-black text-white"
          >
            Ir para a Prévia
          </Link>
        </section>
      </main>
    )
  }

  return (
    <main className="luva-shell public-dashboard min-h-screen text-white">
      <section className="border-b border-white/10 bg-[#061426]/95 px-4 py-5">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/painel" className="inline-flex items-center gap-2 text-sm font-black text-luva-amber">
              <ArrowLeft size={18} />
              Voltar ao painel
            </Link>
            <p className="luva-kicker mt-5">Estrutura do campeonato</p>
            <h1 className="mt-2 font-display text-3xl font-black sm:text-5xl">{liga?.nome || 'Carregando...'}</h1>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-300">Confrontos previstos</p>
            <p className="mt-1 text-3xl font-black text-luva-amber">{confrontosPrevistos}</p>
          </div>
        </div>
      </section>

      {ligaId && liga?.nome && (
        <div className="mx-auto mt-6 max-w-7xl px-4">
          <LinksCategoria ligaId={Number(ligaId)} nome={liga.nome} />
        </div>
      )}

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 xl:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
        <aside className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-6">
          <p className="luva-kicker">Parâmetros</p>
          <div className="mt-5 grid gap-4">
            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-300">Quantidade de grupos</span>
              <input
                type="number"
                min={1}
                max={12}
                value={quantidadeGrupos}
                onChange={(event) => changeGroupCount(Number(event.target.value))}
                className="rounded-2xl border border-white/10 bg-[#102033] px-4 py-3 font-black text-white outline-none"
              />
            </label>
            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-300">Classificados por grupo</span>
              <input
                type="number"
                min={0}
                value={classificadosPorGrupo}
                onChange={(event) => setClassificadosPorGrupo(Number(event.target.value))}
                className="rounded-2xl border border-white/10 bg-[#102033] px-4 py-3 font-black text-white outline-none"
              />
            </label>
            {eliminatoryRequired > 0 && (
              <div className="rounded-2xl border border-[#ffb331]/25 bg-[#ffb331]/10 p-4">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-luva-amber">{formatEliminatoryPhase(liga?.faseEliminatoria)}</p>
                <p className="mt-2 text-sm font-bold leading-6 text-slate-100">
                  Exige {eliminatoryRequired} classificado(s). Esta estrutura gera {automaticClassified} automaticamente.
                </p>
                <p className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-slate-300">
                  {manualClassifiedNeeded > 0 ? `${manualClassifiedNeeded} vaga(s) para completar manualmente na tabela.` : 'Quantidade compatível com a eliminatória.'}
                </p>
              </div>
            )}
            <div className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-300">Método</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={drawAgain}
                  aria-pressed={metodo === 'AUTO'}
                  className={`rounded-2xl border px-4 py-3 text-sm font-black text-white transition ${metodo === 'AUTO' ? 'border-[#ffb331]/40 bg-[#ffb331]' : 'border-white/10 bg-white/5'}`}
                >
                  <Shuffle className="mx-auto mb-1" size={17} />
                  Sortear
                </button>
                <button
                  type="button"
                  onClick={startManualDistribution}
                  aria-pressed={metodo === 'MANUAL'}
                  className={`rounded-2xl border px-4 py-3 text-sm font-black text-white transition ${metodo === 'MANUAL' ? 'border-[#ffb331]/40 bg-[#ffb331]' : 'border-white/10 bg-white/5'}`}
                >
                  Manual
                </button>
              </div>
            </div>
            <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <span className="font-bold text-slate-100">Turno e returno</span>
              <input type="checkbox" checked={turnoReturno} onChange={(event) => setTurnoReturno(event.target.checked)} className="h-5 w-5 accent-[#ffb331]" />
            </label>
            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-300">Data inicial</span>
              <input
                type="date"
                value={dataInicial}
                onChange={(event) => setDataInicial(event.target.value)}
                className="rounded-2xl border border-white/10 bg-[#102033] px-4 py-3 font-black text-white outline-none"
              />
            </label>
            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-300">Horário padrão</span>
              <input
                type="time"
                value={horarioPadrao}
                onChange={(event) => setHorarioPadrao(event.target.value)}
                className="rounded-2xl border border-white/10 bg-[#102033] px-4 py-3 font-black text-white outline-none"
              />
            </label>
            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-300">Local padrão</span>
              <input
                value={localPadrao}
                onChange={(event) => setLocalPadrao(event.target.value)}
                placeholder="Ex: Ginásio Municipal"
                className="rounded-2xl border border-white/10 bg-[#102033] px-4 py-3 font-black text-white outline-none placeholder:text-slate-500"
              />
            </label>
          </div>
        </aside>

        <section className="grid min-w-0 gap-6">
          <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="luva-kicker">Equipes participantes</p>
                <h2 className="mt-2 font-display text-2xl font-black">{equipes.length} aprovada(s)</h2>
              </div>
              <button type="button" onClick={drawAgain} className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 px-4 py-3 text-sm font-black text-white">
                <RefreshCcw size={17} />
                Refazer sorteio
              </button>
            </div>
            {loading ? (
              <p className="mt-6 text-sm font-bold text-slate-300">Carregando estrutura...</p>
            ) : equipes.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
                <p className="font-black text-white">Nenhuma equipe aprovada para este campeonato.</p>
                <p className="mt-2 text-sm font-semibold text-slate-300">Revise as solicitações de inscrição antes de montar os grupos e realizar o sorteio.</p>
                <Link href={`/painel?ligaId=${ligaId}#inscricoes-equipes`} className="public-primary-action mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-black">
                  Revisar inscrições
                  <ArrowRight size={16} />
                </Link>
              </div>
            ) : (
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {equipes.map((equipe) => {
                  const currentGroup = grupos.findIndex((grupo) => grupo.equipeIds.includes(equipe.id))
                  return (
                    <div key={equipe.id} className="rounded-2xl border border-white/10 bg-[#07111f] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-black">{equipe.nome}</p>
                        <span className="whitespace-nowrap text-xs font-black text-luva-amber">
                          {equipe.quantidadeJogadores ?? 0} atleta(s)
                        </span>
                      </div>
                      <p className="mt-1 text-xs font-bold text-slate-400">{equipe.categoria || 'Categoria'} · {equipe.serie || 'Série'}</p>
                      <details className="mt-3 rounded-xl border border-white/10 bg-white/[0.03]">
                        <summary className="cursor-pointer px-3 py-2 text-xs font-black text-slate-200">
                          Conferir elenco sincronizado
                        </summary>
                        <ul className="grid gap-1 border-t border-white/10 px-3 py-2">
                          {equipe.jogadores?.some((jogador) => jogador.status !== 'INATIVO') ? (
                            equipe.jogadores
                              .filter((jogador) => jogador.status !== 'INATIVO')
                              .map((jogador) => (
                                <li key={jogador.id} className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                                  <span className="min-w-7 text-luva-amber">{jogador.numero ? `#${jogador.numero}` : 'S/N'}</span>
                                  <span>{jogador.nome}</span>
                                  {jogador.posicao ? <span className="text-slate-500">· {jogador.posicao}</span> : null}
                                </li>
                              ))
                          ) : (
                            <li className="text-xs font-semibold text-slate-400">Nenhum atleta ativo cadastrado.</li>
                          )}
                        </ul>
                      </details>
                      <select
                        value={currentGroup}
                        onChange={(event) => {
                          const nextGroup = Number(event.target.value)
                          moveTeam(equipe.id, nextGroup >= 0 ? nextGroup : null)
                        }}
                        className="mt-3 w-full rounded-xl border border-white/10 bg-[#102033] px-3 py-2 text-sm font-black text-white outline-none"
                      >
                        <option value={-1}>Não distribuída</option>
                        {grupos.map((grupo, index) => <option key={grupo.nome} value={index}>{grupo.nome}</option>)}
                      </select>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {metodo === 'MANUAL' && (
            <div className="rounded-[1.5rem] border border-dashed border-[#ffb331]/35 bg-[#ffb331]/[0.06] p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="luva-kicker">Montagem manual</p>
                  <h2 className="mt-2 font-display text-xl font-black">Equipes ainda não distribuídas</h2>
                </div>
                <span className="text-sm font-black text-luva-amber">{unassignedTeams.length} pendente(s)</span>
              </div>
              {unassignedTeams.length === 0 ? (
                <p className="mt-4 rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-100">
                  Todas as equipes estão alocadas. Revise o equilíbrio dos grupos antes de confirmar.
                </p>
              ) : (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {unassignedTeams.map((equipe) => (
                    <div key={equipe.id} className="rounded-xl border border-white/10 bg-[#07111f] p-4">
                      <p className="font-black">{equipe.nome}</p>
                      <p className="mt-1 text-xs font-bold text-slate-400">Selecione o grupo de destino</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {grupos.map((grupo, index) => (
                          <button
                            key={`${equipe.id}-${grupo.nome}`}
                            type="button"
                            onClick={() => moveTeam(equipe.id, index)}
                            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-white transition hover:border-[#ffb331]/50"
                          >
                            {grupo.nome}
                            <ArrowRight size={14} />
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            {grupos.map((grupo, index) => (
              <article key={`${grupo.nome}-${index}`} className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
                <label className="block">
                  <span className="text-xs font-black uppercase tracking-[0.14em] text-luva-amber">Grupo {index + 1}</span>
                  <input
                    value={grupo.nome}
                    onChange={(event) => updateGroupName(index, event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-[#102033] px-4 py-3 font-black text-white outline-none"
                  />
                </label>
                <div className="mt-4 grid gap-2">
                  {grupo.equipeIds.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm font-bold text-slate-400">Sem equipes neste grupo.</p>
                  ) : grupo.equipeIds.map((equipeId, teamIndex) => {
                    const equipe = equipeById.get(equipeId)
                    return (
                      <div key={equipeId} className="flex flex-col gap-3 rounded-xl border border-white/10 bg-[#07111f] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <span className="font-black">{teamIndex + 1}. {equipe?.nome || `Equipe ${equipeId}`}</span>
                          <span className="ml-2 text-xs font-black text-slate-400">{equipe?.categoria || 'Categoria'}</span>
                        </div>
                        {metodo === 'MANUAL' && (
                          <div className="flex flex-wrap gap-2">
                            {grupos.map((targetGroup, targetIndex) => targetIndex !== index ? (
                              <button
                                key={`${equipeId}-${targetGroup.nome}`}
                                type="button"
                                onClick={() => moveTeam(equipeId, targetIndex)}
                                className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-black text-slate-200 hover:border-[#ffb331]/50"
                              >
                                Mover para {targetGroup.nome}
                              </button>
                            ) : null)}
                            <button
                              type="button"
                              onClick={() => moveTeam(equipeId, null)}
                              className="rounded-full border border-red-400/25 px-3 py-1.5 text-xs font-black text-red-200 hover:bg-red-500/10"
                            >
                              Retirar
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </article>
            ))}
          </div>

          <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="luva-kicker">Revisão</p>
                <h2 className="mt-2 font-display text-2xl font-black">Confirmar estrutura e gerar jogos</h2>
                <p className="mt-2 text-sm font-semibold text-slate-300">
                  {hasGeneratedCalendar
                    ? `${partidas.length} jogo(s) já existem. Confirmar novamente recria os confrontos da fase de grupos e remove os jogos ainda não iniciados da configuração anterior, inclusive os da fase geral. Mata-mata e jogos já iniciados permanecem.`
                    : `${confrontosPrevistos} confronto(s) serão criados na fase de grupos.`}
                </p>
              </div>
              <ActionBar
                type="button"
                onClick={saveStructure}
                loading={saving}
                loadingLabel="Salvando"
                disabled={Boolean(validation) || equipes.length < 2}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#ffb331] px-6 py-4 text-sm font-black text-white transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save size={18} />
                {hasGeneratedCalendar ? 'Recriar confrontos de grupos' : 'Confirmar e gerar confrontos'}
              </ActionBar>
            </div>

            {validation && (
              <div className="mt-5 flex gap-3 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm font-bold text-red-100">
                <AlertTriangle className="mt-0.5 shrink-0" size={18} />
                {validation}
              </div>
            )}
            {hasGeneratedCalendar && !validation && (
              <div className="mt-5 flex gap-3 rounded-2xl border border-[#ffb331]/35 bg-[#ffb331]/10 p-4 text-sm font-bold text-amber-50">
                <AlertTriangle className="mt-0.5 shrink-0 text-[#ffb331]" size={18} />
                Alterar grupos depois de gerar calendário recria os jogos da fase de grupos e remove ou cancela os jogos não iniciados da fase geral que ficaram da configuração anterior. Partidas em andamento, encerradas ou com súmula bloqueiam esta operação.
              </div>
            )}
            {message && (
              <div className="mt-5 flex gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-100">
                <CheckCircle2 className="mt-0.5 shrink-0" size={18} />
                {message}
              </div>
            )}
          </div>

          {partidas.length > 0 && (
            <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="luva-kicker">Agenda dos confrontos</p>
                  <h2 className="mt-2 font-display text-2xl font-black">Definir datas, quadras e arbitragem</h2>
                  <p className="mt-2 max-w-2xl text-sm font-semibold text-slate-300">
                    Revise cada partida gerada automaticamente e publique uma agenda completa sem cadastrar jogos um por um.
                  </p>
                </div>
                <ActionBar
                  type="button"
                  onClick={saveCalendar}
                  loading={calendarSaving}
                  loadingLabel="Salvando"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#ffb331] px-6 py-4 text-sm font-black text-white transition disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Save size={18} />
                  Salvar calendário
                </ActionBar>
              </div>

              <div className="mt-6 grid gap-3">
                {partidas.map((partida) => {
                  const equipeA = equipeById.get(partida.equipeAId)
                  const equipeB = equipeById.get(partida.equipeBId)
                  const draft = calendarDrafts[partida.id] ?? buildCalendarDraft(partida)
                  const locked = ['EM_ANDAMENTO', 'ENCERRADA'].includes(String(partida.status).toUpperCase())

                  return (
                    <article key={partida.id} className="rounded-2xl border border-white/10 bg-[#07111f] p-4">
                      <div className="flex min-w-0 flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-luva-amber">
                            <span>Rodada {partida.rodada}</span>
                            <span className="text-slate-600">/</span>
                            <span>{grupoById.get(partida.id)}</span>
                            {locked && <span className="rounded-full border border-white/10 px-2 py-1 text-slate-200">bloqueada</span>}
                          </div>
                          <p className="mt-2 truncate text-lg font-black text-white">{equipeA?.nome || 'Equipe A'} x {equipeB?.nome || 'Equipe B'}</p>
                        </div>
                        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-[9.5rem_8rem_minmax(11rem,1fr)_10rem_12rem_10rem] 2xl:items-end">
                          <label className="grid gap-1">
                            <span className="flex items-center gap-1 text-[0.68rem] font-black uppercase tracking-[0.12em] text-slate-300">
                              <CalendarDays size={13} /> Data
                            </span>
                            <input
                              type="date"
                              value={draft.data}
                              disabled={locked}
                              onChange={(event) => updateCalendarDraft(partida.id, 'data', event.target.value)}
                              className="w-full rounded-xl border border-white/10 bg-[#102033] px-3 py-2 text-sm font-black text-white outline-none disabled:opacity-45"
                            />
                          </label>
                          <label className="grid gap-1">
                            <span className="flex items-center gap-1 text-[0.68rem] font-black uppercase tracking-[0.12em] text-slate-300">
                              <Clock size={13} /> Hora
                            </span>
                            <input
                              type="time"
                              value={draft.horario}
                              disabled={locked}
                              onChange={(event) => updateCalendarDraft(partida.id, 'horario', event.target.value)}
                              className="w-full rounded-xl border border-white/10 bg-[#102033] px-3 py-2 text-sm font-black text-white outline-none disabled:opacity-45"
                            />
                          </label>
                          <label className="grid gap-1">
                            <span className="flex items-center gap-1 text-[0.68rem] font-black uppercase tracking-[0.12em] text-slate-300">
                              <MapPin size={13} /> Quadra
                            </span>
                            <input
                              value={draft.localNome}
                              disabled={locked}
                              onChange={(event) => updateCalendarDraft(partida.id, 'localNome', event.target.value)}
                              placeholder="A definir"
                              className="w-full rounded-xl border border-white/10 bg-[#102033] px-3 py-2 text-sm font-black text-white outline-none placeholder:text-slate-500 disabled:opacity-45"
                            />
                          </label>
                          <label className="grid gap-1">
                            <span className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-slate-300">Mandante</span>
                            <select
                              value={draft.mandanteId}
                              disabled={locked}
                              onChange={(event) => updateCalendarDraft(partida.id, 'mandanteId', event.target.value)}
                              className="w-full rounded-xl border border-white/10 bg-[#102033] px-3 py-2 text-sm font-black text-white outline-none disabled:opacity-45"
                            >
                              <option value={partida.equipeAId}>{equipeA?.nome || 'Equipe A'}</option>
                              <option value={partida.equipeBId}>{equipeB?.nome || 'Equipe B'}</option>
                            </select>
                          </label>
                          <label className="grid gap-1">
                            <span className="flex items-center gap-1 text-[0.68rem] font-black uppercase tracking-[0.12em] text-slate-300">
                              <ShieldCheck size={13} /> Árbitro
                            </span>
                            <select
                              value={draft.arbitroId}
                              disabled={locked}
                              onChange={(event) => updateCalendarDraft(partida.id, 'arbitroId', event.target.value)}
                              className="w-full rounded-xl border border-white/10 bg-[#102033] px-3 py-2 text-sm font-black text-white outline-none disabled:opacity-45"
                            >
                              <option value="">A definir</option>
                              {arbitros.map((arbitro) => (
                                <option key={arbitro.id} value={arbitro.arbitroId || ''}>{arbitro.nome}</option>
                              ))}
                            </select>
                          </label>
                          <label className="grid gap-1">
                            <span className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-slate-300">Status</span>
                            <select
                              value={draft.status}
                              disabled={locked}
                              onChange={(event) => updateCalendarDraft(partida.id, 'status', event.target.value)}
                              className="w-full rounded-xl border border-white/10 bg-[#102033] px-3 py-2 text-sm font-black text-white outline-none disabled:opacity-45"
                            >
                              <option value="AGENDADA">Agendada</option>
                              <option value="PENDENTE_APROVACAO">Pendente</option>
                              <option value="CANCELADA">Cancelada</option>
                            </select>
                          </label>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            </div>
          )}
        </section>
      </section>
    </main>
  )
}

export default function EstruturaPage() {
  return (
    <Suspense fallback={<main className="luva-shell public-dashboard min-h-screen p-8 text-white">Carregando...</main>}>
      <EstruturaContent />
    </Suspense>
  )
}

function buildGroupNames(count: number) {
  return Array.from({ length: count }, (_, index) => `Grupo ${String.fromCharCode(65 + index)}`)
}

function distributeAutomatically(equipes: Equipe[], groupNames: string[]): GrupoState[] {
  if (groupNames.length === 0) return []
  return groupNames.map((nome, index) => ({
    nome,
    equipeIds: equipes.filter((_, equipeIndex) => equipeIndex % groupNames.length === index).map((equipe) => equipe.id),
  }))
}

function normalizeCurrentGroupNames(grupos: GrupoState[], count: number) {
  const defaults = buildGroupNames(count)
  return defaults.map((fallback, index) => grupos[index]?.nome.trim() || fallback)
}

function shuffleTeams(equipes: Equipe[]) {
  const shuffled = [...equipes]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1))
    ;[shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]]
  }
  return shuffled
}

function buildCalendarDrafts(partidas: Partida[]) {
  return Object.fromEntries(partidas.map((partida) => [partida.id, buildCalendarDraft(partida)]))
}

function buildCalendarDraft(partida: Partida): CalendarDraft {
  const date = partida.dataHora ? new Date(partida.dataHora) : null
  const escala = partida.escala?.[0]
  return {
    data: date && !Number.isNaN(date.getTime()) ? formatDateInputInSaoPaulo(date) : '',
    horario: date && !Number.isNaN(date.getTime()) ? formatTimeInputInSaoPaulo(date) : '',
    localNome: partida.localNome || '',
    mandanteId: String(partida.equipeAId),
    arbitroId: escala?.arbitroId ? String(escala.arbitroId) : '',
    status: String(partida.status || 'AGENDADA').toUpperCase(),
  }
}

function formatDateInputInSaoPaulo(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${byType.year}-${byType.month}-${byType.day}`
}

function formatTimeInputInSaoPaulo(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${byType.hour}:${byType.minute}`
}

function validateDistribution(grupos: GrupoState[], equipes: Equipe[], classificadosPorGrupo: number, eliminatoryRequired: number) {
  if (equipes.length === 0) return ''
  const seen = new Set<number>()
  for (const grupo of grupos) {
    if (!grupo.nome.trim()) return 'Todos os grupos precisam ter nome.'
    if (grupo.equipeIds.length === 0) return 'Todos os grupos precisam ter pelo menos uma equipe.'
    for (const equipeId of grupo.equipeIds) {
      if (seen.has(equipeId)) return 'A mesma equipe aparece em mais de um grupo.'
      seen.add(equipeId)
    }
  }
  if (seen.size !== equipes.length) return 'Distribua todas as equipes aprovadas antes de confirmar.'
  const sizes = grupos.map((grupo) => grupo.equipeIds.length)
  const min = Math.min(...sizes)
  const max = Math.max(...sizes)
  if (max - min > 1) return 'Os grupos precisam ficar equilibrados em quantidade de equipes.'
  if (classificadosPorGrupo > min) return 'Classificados por grupo não pode ser maior que o menor grupo.'
  const automaticClassified = grupos.reduce((total, grupo) => total + Math.min(classificadosPorGrupo, grupo.equipeIds.length), 0)
  if (eliminatoryRequired > 0 && automaticClassified > eliminatoryRequired) return `A fase eliminatoria escolhida exige ${eliminatoryRequired} equipes classificadas, mas os grupos avancariam ${automaticClassified}.`
  if (eliminatoryRequired > equipes.length) return `A fase eliminatoria escolhida exige ${eliminatoryRequired} equipes classificadas, mas existem apenas ${equipes.length} equipe(s) aprovadas.`
  return ''
}
