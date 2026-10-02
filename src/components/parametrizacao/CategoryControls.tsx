'use client'
import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { flushWizardChanges } from './wizard/useSectionWizard'
import type { ReplicationPreview, ReplicationSection } from '@/lib/category-replication'
export interface SetupCategory { id: string; nome: string; codigo: string; statusConfiguracao: string; configuracao?: Record<string, unknown>; secoes?: Array<{ secao: string; status: string }> }
export const CATEGORY_STATUS: Record<string, string> = { NAO_INICIADA: 'Não iniciada', EM_ANDAMENTO: 'Em andamento', COPIADA_REVISAR: 'Copiada — revisar', CONCLUIDA: 'Concluída', ATENCAO_NECESSARIA: 'Atenção necessária' }
export function CategoryNavigation({ ligaId, replicate = true }: { ligaId: number; replicate?: boolean }) {
  const router = useRouter(); const pathname = usePathname(); const params = useSearchParams()
  const activeId = params.get('categoriaCampeonatoId')
  const [categories, setCategories] = useState<SetupCategory[]>([])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(0)
  useEffect(() => { const refresh = () => setRevision(value => value + 1); window.addEventListener('categories-updated', refresh); return () => window.removeEventListener('categories-updated', refresh) }, [])
  useEffect(() => { let active = true; fetch(`/api/organizador/ligas/${ligaId}/categorias`, { cache: 'no-store' }).then(async response => { const payload = await response.json(); if (!response.ok) throw new Error(payload.error || 'Não foi possível carregar categorias.'); if (active) setCategories(payload.data ?? []) }).catch(cause => { if (active) setMessage(cause.message) }); return () => { active = false } }, [ligaId, revision, activeId])
  async function select(id: string) {
    setBusy(true); setMessage('')
    if (!await flushWizardChanges()) { setMessage('Não foi possível salvar as alterações. Resolva o erro antes de trocar de categoria.'); setBusy(false); return }
    const next = new URLSearchParams(params.toString()); next.set('categoriaCampeonatoId', id)
    router.push(`${pathname}?${next}`); setBusy(false)
  }
  return <section aria-label="Categorias do campeonato" className="mx-auto max-w-6xl px-4 pt-6"><div className="flex flex-wrap gap-2">{categories.map(category => <button type="button" key={category.id} aria-pressed={activeId === category.id} disabled={busy} onClick={() => select(category.id)} className={`rounded-2xl border px-4 py-2 text-left text-sm ${activeId === category.id ? 'border-amber-400 bg-amber-400/10 text-amber-200' : 'border-white/15 text-slate-300'}`}><strong className="block">{category.nome}</strong><small>{CATEGORY_STATUS[category.statusConfiguracao] ?? 'Em andamento'}</small></button>)}</div>{!categories.length && <Link href={`/painel/parametrizacao/informacoes?ligaId=${ligaId}&etapa=categorias`} className="text-sm text-amber-200 underline">Selecione as categorias do campeonato.</Link>}<p role="alert" className="mt-2 text-sm text-red-300">{message}</p>{replicate && categories.length > 1 && activeId && <ReplicationDialog key={activeId} ligaId={ligaId} categories={categories} sourceId={activeId} onCopied={() => { setRevision(value => value + 1); window.dispatchEvent(new Event('categories-updated')) }} />}</section>
}
const SECTIONS: Array<{ key: ReplicationSection; label: string }> = [{ key: 'estrutura', label: 'Estrutura e grupos' }, { key: 'regras', label: 'Regras das partidas' }, { key: 'classificacao', label: 'Classificação' }, { key: 'eliminatorias', label: 'Eliminatórias' }, { key: 'calendario', label: 'Calendário' }, { key: 'inscricoes', label: 'Regras de cadastro' }, { key: 'recursos', label: 'Recursos contratados' }]
function ReplicationDialog({ ligaId, categories, sourceId, onCopied }: { ligaId: number; categories: SetupCategory[]; sourceId: string; onCopied: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [targets, setTargets] = useState<string[]>([])
  const [sections, setSections] = useState<ReplicationSection[]>(SECTIONS.map(section => section.key))
  const [mode, setMode] = useState<'empty-only' | 'replace-sections'>('empty-only')
  const [preview, setPreview] = useState<ReplicationPreview | null>(null)
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  async function request(confirm: boolean) {
    setBusy(true); setMessage('')
    try {
      if (!await flushWizardChanges()) throw new Error('Salve as alterações da origem antes de replicar.')
      const response = await fetch(`/api/organizador/ligas/${ligaId}/categorias/replicar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(confirm ? { confirmationToken: token } : { sourceId, targetIds: targets, sections, mode }) })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || 'Não foi possível replicar. Atualize a comparação.')
      if (confirm) { setMessage('Configuração copiada. Abra cada destino para revisar e concluir.'); setPreview(null); setToken(''); onCopied() }
      else { setPreview(payload.data.preview); setToken(payload.data.confirmationToken) }
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Falha de rede.'); if (confirm) { setPreview(null); setToken('') } } finally { setBusy(false) }
  }
  return <><button type="button" onClick={() => { setPreview(null); setMessage(''); setTargets([]); dialog.current?.showModal() }} className="public-secondary-action mt-3 rounded-full px-4 py-2 text-sm font-bold">Replicar configuração</button><dialog ref={dialog} aria-labelledby="replication-title" className="max-h-[85vh] w-[min(95vw,48rem)] overflow-auto rounded-2xl border border-white/15 bg-slate-950 p-6 text-white backdrop:bg-black/70"><h2 id="replication-title" className="text-xl font-bold">Replicar configuração de {categories.find(category => category.id === sourceId)?.nome}</h2><p className="mt-2 text-sm text-slate-300">Cada destino recebe uma cópia independente para revisão.</p>{!preview ? <><fieldset disabled={busy} className="mt-4"><legend className="font-bold">Categorias de destino</legend>{categories.filter(category => category.id !== sourceId).map(category => <label key={category.id} className="mt-2 flex gap-2"><input type="checkbox" checked={targets.includes(category.id)} onChange={event => setTargets(current => event.target.checked ? [...current, category.id] : current.filter(id => id !== category.id))} />{category.nome}</label>)}</fieldset><fieldset disabled={busy} className="mt-4"><legend className="font-bold">Seções copiadas</legend>{SECTIONS.map(section => <label key={section.key} className="mt-2 flex gap-2"><input type="checkbox" checked={sections.includes(section.key)} onChange={event => setSections(current => event.target.checked ? [...current, section.key] : current.filter(key => key !== section.key))} />{section.label}</label>)}</fieldset><label className="mt-4 block text-sm">Configuração existente<select value={mode} disabled={busy} onChange={event => setMode(event.target.value as typeof mode)} className="mt-2 block w-full rounded-lg border border-white/20 bg-slate-900 p-3"><option value="empty-only">Copiar somente para categorias vazias</option><option value="replace-sections">Substituir somente as seções selecionadas</option></select></label></> : <div className="mt-4 space-y-4">{preview.targets.map(target => <section key={target.id} className="rounded-xl border border-white/15 p-3"><h3 className="font-bold">{categories.find(category => category.id === target.id)?.nome}</h3>{target.blockedReasons.map(reason => <p key={reason} className="mt-1 text-sm text-red-300">{reason}</p>)}{target.issues.map((issue, index) => <p key={index} className="mt-1 text-sm text-amber-200">{issue.message}</p>)}<div className="overflow-x-auto"><table className="mt-2 w-full text-left text-xs"><thead><tr><th className="p-2">Parâmetro</th><th className="p-2">Atual</th><th className="p-2">Novo</th></tr></thead><tbody>{target.differences.map(diff => <tr key={diff.field} className="border-t border-white/10"><td className="p-2">{FIELD_LABELS[diff.field] ?? diff.field}</td><td className="max-w-48 break-words p-2">{describeValue(diff.before)}</td><td className="max-w-48 break-words p-2">{describeValue(diff.after)}</td></tr>)}</tbody></table></div>{!target.differences.length && <p className="text-sm text-slate-400">Sem diferenças.</p>}</section>)}</div>}<p role="status" className="mt-3 text-sm text-amber-200">{message}</p><div className="mt-5 flex flex-wrap justify-end gap-3"><button type="button" disabled={busy} onClick={() => dialog.current?.close()} className="rounded-full border border-white/20 px-4 py-2">Fechar</button>{preview && <button type="button" disabled={busy} onClick={() => { setPreview(null); setToken('') }} className="rounded-full border border-white/20 px-4 py-2">Voltar</button>}<button type="button" disabled={busy || !targets.length || !sections.length || Boolean(preview?.targets.some(target => target.status === 'blocked'))} onClick={() => request(Boolean(preview))} className="public-primary-action rounded-full px-4 py-2 font-bold disabled:opacity-40">{busy ? 'Aguarde...' : preview ? 'Confirmar substituição' : 'Comparar antes de copiar'}</button></div></dialog></>
}

const FIELD_LABELS: Record<string, string> = {
 quantidadeEquipes: 'Quantidade de equipes', quantidadeEquipesMinima: 'Mínimo de equipes', quantidadeEquipesMaxima: 'Máximo de equipes', formato: 'Formato', quantidadeGrupos: 'Quantidade de grupos', turnoReturno: 'Turno e returno', setsFormato: 'Formato dos sets', setsPorPartida: 'Sets por partida', pontosPorSet: 'Pontos dos sets normais', tieBreakUltimoSet: 'Último set decisivo', pontosUltimoSet: 'Pontos do último set', terceiroSetObrigatorio: 'Terceiro set obrigatório', criteriosClassificacao: 'Critérios de classificação', classificadosPorGrupo: 'Classificados por grupo', melhoresClassificadosGerais: 'Vagas adicionais', pontosVencedorMargem1: 'Vencedor — margem de 1 set', pontosPerdedorMargem1: 'Perdedor — margem de 1 set', pontosVencedorMargem2: 'Vencedor — margem de 2+ sets', pontosPerdedorMargem2: 'Perdedor — margem de 2+ sets', faseEliminatoria: 'Fase eliminatória', metodoChaveamento: 'Chaveamento', eliminatoriaIdaVolta: 'Eliminatória ida e volta', disputaTerceiroLugar: 'Terceiro lugar', goldenSet: 'Golden set', dataInicio: 'Data inicial', dataFim: 'Data final', inscricoesAberturaEm: 'Abertura dos cadastros', inscricoesEncerramentoEm: 'Encerramento dos cadastros', inscricaoPermiteEdicaoAposEnvio: 'Edição após envio', inscricaoPrazoEdicaoDias: 'Prazo de edição', elencoQuantidadeMinima: 'Mínimo de atletas', elencoQuantidadeMaxima: 'Máximo de atletas', elencoCadastroDuranteInscricao: 'Cadastro de atletas durante inscrição', prazoAlteracaoElencoDias: 'Prazo de alteração do elenco', formularioInscricaoConfig: 'Campos do formulário', sumulaScoutsEnabled: 'Súmula + Scouts', qrCodeEnabled: 'QR Code', equipe: 'Equipe', lider: 'Responsável', atleta: 'Atleta', nomeCompleto: 'Nome completo', nome: 'Nome', nomeAbreviado: 'Nome abreviado', foto: 'Foto', numeroCamisa: 'Número da camisa', dataNascimento: 'Nascimento', posicao: 'Posição', telefoneEmergencia: 'Contato de emergência',
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
