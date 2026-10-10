'use client'
import { useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { flushWizardChanges } from './wizard/useSectionWizard'
import { categoriaParaAbrir, chaveCategoriaAtiva } from '@/lib/categoria-ativa'
import type { ReplicationPreview, ReplicationSection } from '@/lib/category-replication'

export interface SetupCategory { id: string; nome: string; codigo: string; statusConfiguracao: string }
export const CATEGORY_STATUS: Record<string, string> = {
  NAO_INICIADA: 'Pendente',
  EM_ANDAMENTO: 'Em andamento',
  COPIADA_REVISAR: 'Copiada — revisar',
  CONCLUIDA: 'Parametrizada',
  ATENCAO_NECESSARIA: 'Atenção necessária',
}

const SECTIONS: ReplicationSection[] = ['estrutura', 'regras', 'classificacao', 'eliminatorias', 'calendario', 'inscricoes', 'recursos']

export function CategoryNavigation({
  ligaId,
  replicate = true,
  ativaId,
  onSelect,
  aoSemCategoria,
  categorias: categoriasRecebidas,
}: {
  ligaId: number
  replicate?: boolean
  ativaId?: string | null
  onSelect?: (id: string) => void | Promise<void>
  aoSemCategoria?: () => void
  categorias?: SetupCategory[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const daUrl = params.get('categoriaCampeonatoId')
  const activeId = onSelect ? (ativaId ?? null) : daUrl
  const [categories, setCategories] = useState<SetupCategory[]>([])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1)
    window.addEventListener('categories-updated', refresh)
    return () => window.removeEventListener('categories-updated', refresh)
  }, [])

  const recebidas = categoriasRecebidas !== undefined

  useEffect(() => {
    if (recebidas) setCategories(categoriasRecebidas)
  }, [recebidas, categoriasRecebidas])

  useEffect(() => {
    if (recebidas) return
    let active = true
    fetch(`/api/organizador/ligas/${ligaId}/categorias`, { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || 'Não foi possível carregar categorias.')
        if (active) setCategories(payload.data ?? [])
      })
      .catch((cause) => {
        if (active) setMessage(cause instanceof Error ? cause.message : 'Não foi possível carregar categorias.')
      })
    return () => { active = false }
  }, [ligaId, revision, recebidas])

  useEffect(() => {
    if (onSelect || !categories.length || daUrl) return
    const ultima = window.sessionStorage.getItem(chaveCategoriaAtiva(ligaId))
    const escolhida = categoriaParaAbrir(categories, ultima)
    if (!escolhida) return
    const next = new URLSearchParams(params.toString())
    next.set('categoriaCampeonatoId', escolhida)
    window.sessionStorage.setItem(chaveCategoriaAtiva(ligaId), escolhida)
    router.replace(`${pathname}?${next}`)
  }, [categories, daUrl, ligaId, onSelect, params, pathname, router])

  async function select(id: string) {
    setBusy(true)
    setMessage('')
    if (!await flushWizardChanges()) {
      setMessage('Não foi possível salvar as alterações. Resolva o erro antes de trocar de categoria.')
      setBusy(false)
      return
    }
    window.sessionStorage.setItem(chaveCategoriaAtiva(ligaId), id)
    if (onSelect) {
      await onSelect(id)
      setBusy(false)
      return
    }
    const next = new URLSearchParams(params.toString())
    next.set('categoriaCampeonatoId', id)
    router.push(`${pathname}?${next}`)
    setBusy(false)
  }

  const ativa = categories.find((category) => category.id === activeId)

  return (
    <section aria-label="Categoria em parametrização" className="mx-auto max-w-6xl px-4 pt-4">
      <label className="block max-w-md">
        <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Parametrizando</span>
        <select
          value={activeId ?? ''}
          disabled={busy || !categories.length}
          onChange={(event) => { if (event.target.value) void select(event.target.value) }}
          className="mt-2 w-full rounded-2xl border border-white/15 bg-[#061426] px-4 py-3 text-sm font-black text-white outline-none focus:border-amber-300"
        >
          <option value="" disabled>{categories.length ? 'Escolha a categoria' : 'Nenhuma categoria'}</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>{category.nome}</option>
          ))}
        </select>
      </label>
      {ativa && (
        <p className="mt-2 text-sm font-bold text-amber-100">
          {ativa.nome} · {CATEGORY_STATUS[ativa.statusConfiguracao] ?? 'Em andamento'}
        </p>
      )}
      <ul className="mt-3 flex flex-wrap gap-2">
        {categories.map((category) => {
          const concluida = category.statusConfiguracao === 'CONCLUIDA'
          return (
            <li key={category.id} className={`rounded-full border px-3 py-1 text-xs font-bold ${category.id === activeId ? 'border-amber-300 text-amber-100' : 'border-white/15 text-slate-300'}`}>
              {concluida ? '✓' : '⚠'} {category.nome} · {CATEGORY_STATUS[category.statusConfiguracao] ?? 'Em andamento'}
            </li>
          )
        })}
      </ul>
      {!categories.length && (aoSemCategoria ? (
        <button type="button" onClick={aoSemCategoria} className="mt-2 text-sm text-amber-200 underline">
          Selecione as categorias do campeonato.
        </button>
      ) : (
        <Link href={`/painel/parametrizacao/informacoes?ligaId=${ligaId}&etapa=categorias`} className="mt-2 inline-block text-sm text-amber-200 underline">
          Selecione as categorias do campeonato.
        </Link>
      ))}
      <p role="alert" className="mt-2 text-sm text-red-300">{message}</p>
      {replicate && categories.length > 1 && activeId && (
        <ReplicationDialog
          key={activeId}
          ligaId={ligaId}
          categories={categories}
          sourceId={activeId}
          onCopied={() => {
            setRevision((value) => value + 1)
            window.dispatchEvent(new Event('categories-updated'))
          }}
        />
      )}
    </section>
  )
}

function ReplicationDialog({
  ligaId,
  categories,
  sourceId: origemInicial,
  onCopied,
}: {
  ligaId: number
  categories: SetupCategory[]
  sourceId: string
  onCopied: () => void
}) {
  const [aberto, setAberto] = useState(false)
  const [sourceId, setSourceId] = useState(origemInicial)
  const [targetId, setTargetId] = useState('')
  const [preview, setPreview] = useState<ReplicationPreview | null>(null)
  const [token, setToken] = useState('')
  const [confirmar, setConfirmar] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const origem = categories.find((category) => category.id === sourceId)
  const destino = categories.find((category) => category.id === targetId)
  const alvo = preview?.targets[0]
  const linhas = alvo ? linhasDaComparacao(preview!, alvo.id) : []

  function fechar() {
    setAberto(false)
    setPreview(null)
    setToken('')
    setConfirmar(false)
    setMessage('')
    setTargetId('')
    setSourceId(origemInicial)
  }

  async function comparar() {
    setBusy(true)
    setMessage('')
    setConfirmar(false)
    try {
      if (!await flushWizardChanges()) throw new Error('Salve as alterações da origem antes de replicar.')
      const response = await fetch(`/api/organizador/ligas/${ligaId}/categorias/replicar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId, targetIds: [targetId], sections: SECTIONS, mode: 'replace-sections' }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || 'Não foi possível comparar as categorias.')
      setPreview(payload.data.preview)
      setToken(payload.data.confirmationToken)
    } catch (cause) {
      setPreview(null)
      setToken('')
      setMessage(cause instanceof Error ? cause.message : 'Falha de rede.')
    } finally {
      setBusy(false)
    }
  }

  async function copiar() {
    setBusy(true)
    setMessage('')
    try {
      const response = await fetch(`/api/organizador/ligas/${ligaId}/categorias/replicar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmationToken: token }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || 'Não foi possível replicar. Compare de novo.')
      setMessage('Configuração replicada com sucesso.')
      setPreview(null)
      setToken('')
      setConfirmar(false)
      onCopied()
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Falha de rede.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button type="button" onClick={() => setAberto(true)} className="public-secondary-action mt-3 rounded-full px-4 py-2 text-sm font-bold">
        Replicar configuração
      </button>
      {aberto && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="replication-title">
          <div className="max-h-[85vh] w-full max-w-3xl overflow-auto rounded-2xl border border-white/15 bg-slate-950 p-6 text-white">
            <h2 id="replication-title" className="text-xl font-bold">Comparar configurações</h2>
            {!confirmar ? (
              <>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm font-bold">
                    Replicar de
                    <select value={sourceId} disabled={busy || Boolean(preview)} onChange={(event) => { setSourceId(event.target.value); setTargetId(''); setPreview(null); setToken('') }} className="mt-2 w-full rounded-xl border border-white/20 bg-slate-900 p-3">
                      {categories.map((category) => <option key={category.id} value={category.id}>{category.nome}</option>)}
                    </select>
                  </label>
                  <label className="block text-sm font-bold">
                    Replicar para
                    <select value={targetId} disabled={busy || Boolean(preview)} onChange={(event) => { setTargetId(event.target.value); setPreview(null); setToken('') }} className="mt-2 w-full rounded-xl border border-white/20 bg-slate-900 p-3">
                      <option value="">Escolha o destino</option>
                      {categories.filter((category) => category.id !== sourceId).map((category) => <option key={category.id} value={category.id}>{category.nome}</option>)}
                    </select>
                  </label>
                </div>
                {alvo && (
                  <div className="mt-4">
                    <p className="text-sm text-slate-300">Origem: {origem?.nome}. Destino: {destino?.nome}.</p>
                    {alvo.blockedReasons.map((reason) => <p key={reason} className="mt-2 text-sm text-red-300">{reason}</p>)}
                    {alvo.issues.map((issue, index) => <p key={index} className="mt-1 text-sm text-amber-200">{issue.message}</p>)}
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr>
                            <th className="p-2">Configuração</th>
                            <th className="p-2">Origem</th>
                            <th className="p-2">Destino</th>
                            <th className="p-2"> </th>
                          </tr>
                        </thead>
                        <tbody>
                          {linhas.map((linha) => (
                            <tr key={`${linha.section}-${linha.field}`} className="border-t border-white/10">
                              <td className="p-2">{FIELD_LABELS[linha.field] ?? linha.field}</td>
                              <td className="max-w-48 break-words p-2">{describeValue(linha.origem)}</td>
                              <td className="max-w-48 break-words p-2">{describeValue(linha.destino)}</td>
                              <td className="p-2">{linha.igual ? '✓ Igual' : '⚠ Diferente'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="mt-4">
                <p className="text-sm leading-6 text-slate-200">
                  Você está copiando a configuração de {origem?.nome} para {destino?.nome}. As configurações atuais de {destino?.nome} serão substituídas. Times, jogadores, jogos, súmulas e resultados não entram nessa cópia.
                </p>
              </div>
            )}
            <p role="status" className="mt-3 text-sm text-amber-200">{message}</p>
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button type="button" disabled={busy} onClick={fechar} className="rounded-full border border-white/20 px-4 py-2">Cancelar</button>
              {preview && !confirmar && (
                <button type="button" disabled={busy} onClick={() => { setPreview(null); setToken(''); setConfirmar(false) }} className="rounded-full border border-white/20 px-4 py-2">Voltar</button>
              )}
              {!preview && !confirmar && (
                <button type="button" disabled={busy || !targetId} onClick={() => void comparar()} className="rounded-full bg-amber-300 px-4 py-2 font-bold text-slate-950 disabled:opacity-40">
                  {busy ? 'Aguarde...' : 'Comparar'}
                </button>
              )}
              {preview && !confirmar && (
                <button type="button" disabled={busy || alvo?.status === 'blocked'} onClick={() => setConfirmar(true)} className="rounded-full bg-amber-300 px-4 py-2 font-bold text-slate-950 disabled:opacity-40">
                  Copiar configuração
                </button>
              )}
              {confirmar && (
                <button type="button" disabled={busy} onClick={() => void copiar()} className="rounded-full bg-amber-300 px-4 py-2 font-bold text-slate-950 disabled:opacity-40">
                  {busy ? 'Aguarde...' : 'Confirmar replicação'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function linhasDaComparacao(preview: ReplicationPreview, targetId: string) {
  const target = preview.targets.find((item) => item.id === targetId)
  if (!target) return []
  const linhas: Array<{ section: string; field: string; origem: unknown; destino: unknown; igual: boolean }> = []
  for (const [section, fields] of Object.entries(preview.snapshot)) {
    for (const [field, origem] of Object.entries(fields as Record<string, unknown>)) {
      const diff = target.differences.find((item) => item.section === section && item.field === field)
      linhas.push({ section, field, origem, destino: diff ? diff.before : origem, igual: !diff })
    }
  }
  return linhas
}

const FIELD_LABELS: Record<string, string> = {
  quantidadeEquipes: 'Quantidade de equipes', quantidadeEquipesMinima: 'Mínimo de equipes', quantidadeEquipesMaxima: 'Máximo de equipes', formato: 'Formato', quantidadeGrupos: 'Quantidade de grupos', turnoReturno: 'Turno e returno', setsFormato: 'Formato dos sets', setsPorPartida: 'Sets por partida', pontosPorSet: 'Pontos dos sets normais', tieBreakUltimoSet: 'Último set decisivo', pontosUltimoSet: 'Pontos do último set', terceiroSetObrigatorio: 'Terceiro set obrigatório', criteriosClassificacao: 'Critérios de classificação', classificadosPorGrupo: 'Classificados por grupo', melhoresClassificadosGerais: 'Vagas adicionais', pontosVencedorMargem1: 'Vencedor — margem de 1 set', pontosPerdedorMargem1: 'Perdedor — margem de 1 set', pontosVencedorMargem2: 'Vencedor — margem de 2+ sets', pontosPerdedorMargem2: 'Perdedor — margem de 2+ sets', faseEliminatoria: 'Fase eliminatória', metodoChaveamento: 'Chaveamento', eliminatoriaIdaVolta: 'Eliminatória ida e volta', disputaTerceiroLugar: 'Terceiro lugar', goldenSet: 'Golden set', setsPorPartidaFinal: 'Sets da final', setsPorPartidaSemifinal: 'Sets da semifinal', setsPorPartidaTerceiroLugar: 'Sets do 3º lugar', dataInicio: 'Data inicial', dataFim: 'Data final', inscricoesAberturaEm: 'Abertura dos cadastros', inscricoesEncerramentoEm: 'Encerramento dos cadastros', inscricaoPermiteEdicaoAposEnvio: 'Edição após envio', inscricaoPrazoEdicaoDias: 'Prazo de edição', elencoQuantidadeMinima: 'Mínimo de atletas', elencoQuantidadeMaxima: 'Máximo de atletas', elencoCadastroDuranteInscricao: 'Cadastro de atletas durante inscrição', prazoAlteracaoElencoDias: 'Prazo de alteração do elenco', formularioInscricaoConfig: 'Campos do formulário', sumulaScoutsEnabled: 'Súmula + Scouts', qrCodeEnabled: 'QR Code', equipe: 'Equipe', lider: 'Responsável', atleta: 'Atleta', nomeCompleto: 'Nome completo', nome: 'Nome', nomeAbreviado: 'Nome abreviado', foto: 'Foto', numeroCamisa: 'Número da camisa', dataNascimento: 'Nascimento', posicao: 'Posição', telefoneEmergencia: 'Contato de emergência',
}

function describeValue(value: unknown): string {
  if (value == null) return 'Não definido'
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não'
  if (Array.isArray(value)) return value.map(describeValue).join(', ')
  if (typeof value === 'object') return Object.entries(value).map(([key, item]) => `${FIELD_LABELS[key] ?? key}: ${describeValue(item)}`).join('; ')
  const labels: Record<string, string> = { required: 'Obrigatório', optional: 'Opcional', disabled: 'Desativado', MELHOR_DE: 'Melhor de', QUANTIDADE_FIXA: 'Quantidade fixa', PONTOS_CORRIDOS: 'Pontos corridos', GRUPOS_MATA_MATA: 'Grupos + mata-mata', MATA_MATA: 'Mata-mata', NENHUMA: 'Nenhuma', FINAL: 'Final', SEMIFINAL: 'Semifinal', QUARTAS: 'Quartas de final', OITAVAS: 'Oitavas de final', DEZESSEIS_AVOS: 'Dezesseis avos', RANKING_GERAL: 'Ranking geral', CRUZAMENTO_GRUPOS: 'Cruzamento de grupos', SORTEIO: 'Sorteio', MANUAL: 'Manual' }
  return labels[String(value)] ?? String(value)
}

export function scopedSetupHref(href: string, categoryId: string | null, section: string) {
  const url = new URL(href, 'https://local.invalid')
  if (categoryId && section !== 'informacoes') url.searchParams.set('categoriaCampeonatoId', categoryId)
  else url.searchParams.delete('categoriaCampeonatoId')
  return `${url.pathname}${url.search}${url.hash}`
}
