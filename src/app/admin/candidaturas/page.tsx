'use client'

import { useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { ActionBar } from '@/components/ui/action-bar'

type Tipo = 'arbitro' | 'quadra' | 'organizador'
type Status = 'PENDENTE' | 'APROVADA' | 'REJEITADA' | 'ATIVA' | 'TODAS'

const tipos: Array<{ value: Tipo; label: string }> = [
  { value: 'arbitro', label: 'Árbitros' },
  { value: 'quadra', label: 'Quadras' },
  { value: 'organizador', label: 'Organizadores' },
]

const statusList: Status[] = ['PENDENTE', 'APROVADA', 'ATIVA', 'REJEITADA', 'TODAS']

export default function CandidaturasPage() {
  const [tipo, setTipo] = useState<Tipo>('arbitro')
  const [status, setStatus] = useState<Status>('PENDENTE')
  const [candidaturas, setCandidaturas] = useState<any[]>([])
  const [selected, setSelected] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState<string | null>(null)
  const [actionKind, setActionKind] = useState<'aprovar' | 'rejeitar' | null>(null)
  const [msg, setMsg] = useState('')

  async function fetchCandidaturas() {
    setLoading(true)
    const res = await fetch(`/api/admin/candidaturas?tipo=${tipo}&status=${status}`, { cache: 'no-store' })
    const json = await res.json()
    setCandidaturas(json.data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchCandidaturas() }, [tipo, status])

  async function handleAprovar(id: string) {
    setActionId(id)
    setActionKind('aprovar')
    const res = await fetch(`/api/admin/candidaturas/${id}/aprovar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo }),
    })
    const json = await res.json()
    setActionId(null)
    setActionKind(null)
    setMsg(res.ok ? json.data?.mensagem ?? 'Cadastro aprovado.' : json.error ?? 'Erro ao aprovar.')
    if (res.ok) {
      setSelected(null)
      fetchCandidaturas()
    }
    setTimeout(() => setMsg(''), 4500)
  }

  async function handleRejeitar(id: string) {
    if (!confirm('Rejeitar esta candidatura?')) return
    setActionId(id)
    setActionKind('rejeitar')
    const res = await fetch(`/api/admin/candidaturas/${id}/rejeitar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo }),
    })
    const json = await res.json()
    setActionId(null)
    setActionKind(null)
    setMsg(res.ok ? 'Cadastro rejeitado.' : json.error ?? 'Erro ao rejeitar.')
    if (res.ok) {
      setSelected(null)
      fetchCandidaturas()
    }
    setTimeout(() => setMsg(''), 4500)
  }

  const statusVariant: Record<string, 'neutral' | 'warning' | 'success' | 'error' | 'info'> = {
    PENDENTE: 'warning',
    APROVADA: 'info',
    REJEITADA: 'error',
    ATIVA: 'success',
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-luva-amber">Administração</p>
          <h2 className="mt-2 font-display text-3xl font-black text-white">Candidaturas</h2>
          <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-200">
            Analise cadastros, confira documentos, fotos e aprove ou rejeite cada solicitação.
          </p>
        </div>
        {msg && <p className="rounded-2xl border border-luva-amber/30 bg-luva-amber/10 px-4 py-3 text-sm font-bold text-white">{msg}</p>}
      </header>

      <section className="rounded-[1.5rem] border border-white/10 bg-[#102033] p-4">
        <div className="flex flex-wrap gap-2">
          {tipos.map((item) => (
            <button
              key={item.value}
              onClick={() => setTipo(item.value)}
              className={`rounded-full px-4 py-2 text-sm font-black transition ${tipo === item.value ? 'bg-[#ffb331] text-white' : 'border border-white/15 bg-white/5 text-slate-100 hover:border-[#ffb331]/70'}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {statusList.map((item) => (
            <button
              key={item}
              onClick={() => setStatus(item)}
              className={`rounded-full px-3 py-1.5 text-xs font-black transition ${status === item ? 'bg-[#ffb331] text-white' : 'border border-white/15 bg-white/5 text-slate-100 hover:border-[#ffb331]/70'}`}
            >
              {formatStatus(item)}
            </button>
          ))}
        </div>
      </section>

      {false && (
        <div className="flex flex-wrap items-center gap-3 rounded-[1.25rem] border border-luva-amber/30 bg-luva-amber/10 p-4">
          <span className="text-sm font-bold text-slate-100">Valor da inscrição ao aprovar:</span>
          <label className="flex items-center gap-2 text-sm font-black text-luva-amber">
            R$
            <input
              type="number"
              min="0"
              step="0.01"
              className="w-28 rounded-xl border border-white/15 bg-[#071426] px-3 py-2 text-sm font-bold text-white outline-none focus:border-luva-amber"
              value=""
              readOnly
            />
          </label>
        </div>
      )}

      {loading ? (
        <p className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm font-bold text-slate-200">Carregando candidaturas...</p>
      ) : candidaturas.length === 0 ? (
        <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] py-16 text-center text-slate-200">
          Nenhuma candidatura encontrada para o filtro atual.
        </div>
      ) : (
        <div className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#102033]">
          <div className="grid grid-cols-[1.3fr_1fr_0.8fr_0.8fr] gap-4 border-b border-white/10 px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-slate-300 max-lg:hidden">
            <span>Candidato</span>
            <span>Resumo</span>
            <span>Status</span>
            <span>Ações</span>
          </div>
          {candidaturas.map((c) => (
            <article key={c.id} className="grid gap-4 border-b border-white/10 px-5 py-5 last:border-b-0 lg:grid-cols-[1.3fr_1fr_0.8fr_0.8fr] lg:items-center">
              <div className="min-w-0">
                <h3 className="truncate font-display text-xl font-black text-white">{c.nome}</h3>
                <p className="mt-1 truncate text-sm font-semibold text-slate-300">{c.email} · {c.telefone || 'telefone não informado'}</p>
                <p className="mt-2 text-xs font-bold text-slate-400">{formatDate(c.criadaEm)}</p>
              </div>
              <p className="text-sm font-semibold leading-6 text-slate-200">{summaryByType(tipo, c)}</p>
              <div>
                <Badge variant={statusVariant[c.status] ?? 'neutral'}>{formatStatus(c.status)}</Badge>
              </div>
              <div className="flex flex-wrap gap-2 lg:justify-end">
                <button onClick={() => setSelected(c)} className="rounded-full border border-white/15 px-4 py-2 text-xs font-black text-white hover:border-luva-amber">
                  Ver detalhe
                </button>
                {c.status === 'PENDENTE' && (
                  <>
                    <ActionBar
                      onClick={() => handleAprovar(c.id)}
                      loading={actionId === c.id && actionKind === 'aprovar'}
                      loadingLabel="Aprovando"
                      disabled={actionId === c.id}
                      className="rounded-full bg-[#ffb331] px-4 py-2 text-xs font-black text-white disabled:opacity-50"
                    >
                      Aprovar
                    </ActionBar>
                    <ActionBar
                      onClick={() => handleRejeitar(c.id)}
                      loading={actionId === c.id && actionKind === 'rejeitar'}
                      loadingLabel="Rejeitando"
                      disabled={actionId === c.id}
                      className="rounded-full border border-red-300/40 px-4 py-2 text-xs font-black text-red-100 hover:bg-red-500/10 disabled:opacity-50"
                    >
                      Rejeitar
                    </ActionBar>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {selected && (
        <DetailModal
          tipo={tipo}
          candidatura={selected}
          onClose={() => setSelected(null)}
          onApprove={selected.status === 'PENDENTE' ? () => handleAprovar(selected.id) : undefined}
          onReject={selected.status === 'PENDENTE' ? () => handleRejeitar(selected.id) : undefined}
          busy={actionId === selected.id}
          actionKind={actionKind}
        />
      )}
    </div>
  )
}

function DetailModal({ tipo, candidatura, onClose, onApprove, onReject, busy, actionKind }: {
  tipo: Tipo
  candidatura: any
  onClose: () => void
  onApprove?: () => void
  onReject?: () => void
  busy: boolean
  actionKind: 'aprovar' | 'rejeitar' | null
}) {
  const rows = useMemo(() => detailRows(tipo, candidatura), [tipo, candidatura])
  const files = fileLinks(tipo, candidatura)

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#020817]/80 p-4 backdrop-blur-xl">
      <div className="mx-auto my-8 max-w-5xl rounded-[2rem] border border-white/10 bg-[#13243a] p-5 shadow-2xl">
        <div className="flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-luva-amber">Detalhe da candidatura</p>
            <h3 className="mt-2 font-display text-4xl font-black text-white">{candidatura.nome}</h3>
            <p className="mt-2 text-sm font-bold text-slate-300">{labelTipo(tipo)} · {formatStatus(candidatura.status)}</p>
          </div>
          <button onClick={onClose} className="h-11 rounded-full border border-white/15 px-5 text-sm font-black text-white hover:border-luva-amber">
            Fechar
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {rows.map((row) => (
            <div key={row.label} className="rounded-2xl border border-white/10 bg-[#071426] p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{row.label}</p>
              <p className="mt-2 break-words text-sm font-bold leading-6 text-white">{row.value || 'Não informado'}</p>
            </div>
          ))}
        </div>

        {files.length > 0 && (
          <section className="mt-6">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-luva-amber">Arquivos enviados</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {files.map((file) => (
                <a key={file.url} href={file.url} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-2xl border border-white/10 bg-[#071426]">
                  {file.kind === 'image' ? (
                    <img src={file.url} alt={file.label} className="h-36 w-full object-cover transition group-hover:scale-105" />
                  ) : (
                    <div className="flex h-36 items-center justify-center bg-white/5 text-3xl font-black text-luva-amber">PDF</div>
                  )}
                  <p className="px-4 py-3 text-xs font-black uppercase tracking-wide text-white">{file.label}</p>
                </a>
              ))}
            </div>
          </section>
        )}

        {(onApprove || onReject) && (
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            {onReject && <ActionBar loading={busy && actionKind === 'rejeitar'} loadingLabel="Rejeitando" disabled={busy} onClick={onReject} className="rounded-full border border-red-300/40 px-5 py-3 text-sm font-black text-red-100 disabled:opacity-50">Rejeitar</ActionBar>}
            {onApprove && <ActionBar loading={busy && actionKind === 'aprovar'} loadingLabel="Aprovando" disabled={busy} onClick={onApprove} className="rounded-full bg-[#ffb331] px-5 py-3 text-sm font-black text-white disabled:opacity-50">Aprovar cadastro</ActionBar>}
          </div>
        )}
      </div>
    </div>
  )
}

function detailRows(tipo: Tipo, c: any) {
  const base = [
    { label: 'E-mail', value: c.email },
    { label: 'Telefone', value: c.telefone },
    { label: 'Criado em', value: formatDate(c.criadaEm) },
  ]

  if (false) {
    return [
      ...base,
      { label: 'Responsável', value: c.responsavel },
      { label: 'Categoria', value: c.categoria },
      { label: 'Série', value: c.serie },
      { label: 'Gênero', value: c.genero },
      { label: 'Categoria etária', value: labelCategoriaEtaria(c.categoriaEtaria) },
      { label: 'Nível', value: labelNivel(c.nivel) },
      { label: 'Treinos', value: formatHorariosTreino(c.horariosTreino) },
      { label: 'Dias disponíveis', value: parseJsonArray(c.diasDisponiveis).join(', ') },
      { label: 'Instagram', value: c.instagram ? `@${c.instagram}` : '' },
    ]
  }

  if (tipo === 'arbitro') {
    return [...base, { label: 'Registro/CREF', value: c.cref }, { label: 'Experiência', value: c.experiencia }]
  }

  if (tipo === 'quadra') {
    return [
      ...base,
      { label: 'Responsável', value: c.responsavel },
      { label: 'Endereço', value: c.endereco },
      { label: 'Bairro', value: c.bairro },
      { label: 'Disponibilidade', value: formatQuadraHorarios(c.horarios) },
      { label: 'Estrutura', value: c.estrutura },
      { label: 'Recursos', value: [c.cobertura && 'Cobertura', c.banheiro && 'Banheiro', c.estacionamento && 'Estacionamento'].filter(Boolean).join(', ') },
    ]
  }

  return [...base, { label: 'Organização', value: c.organizacao }, { label: 'Cidade/região', value: c.cidade }, { label: 'Acesso', value: labelPlanoOrganizador(c.plano) }]
}

function fileLinks(tipo: Tipo, c: any): Array<{ label: string; url: string; kind: 'image' | 'file' }> {
  const links: Array<{ label: string; url: string; kind: 'image' | 'file' }> = []
  if (tipo === 'arbitro' && c.diplomaUrl) links.push({ label: 'Certificado', url: c.diplomaUrl, kind: guessKind(c.diplomaUrl) })
  if (tipo === 'quadra') {
    parseJsonArray(c.fotosUrls ?? c.fotosQuadraUrls).forEach((url, index) => links.push({ label: `Foto ${index + 1}`, url: String(url), kind: 'image' }))
  }
  parseJsonArray(c.documentosUrls).forEach((url, index) => links.push({ label: `Documento ${index + 1}`, url: String(url), kind: guessKind(String(url)) }))
  if (c.fotoRostoUrl) links.push({ label: 'Foto de rosto', url: c.fotoRostoUrl, kind: 'image' })
  return links
}

function guessKind(url: string): 'image' | 'file' {
  return /\.(png|jpe?g|webp|gif)(\?|$)/i.test(url) ? 'image' : 'file'
}

function summaryByType(tipo: Tipo, c: any) {
  if (tipo === 'arbitro') return c.cref ? `Registro ${c.cref}` : 'Cadastro de arbitragem'
  if (tipo === 'quadra') return [c.endereco, formatQuadraHorarios(c.horarios)].filter(Boolean).join(' · ')
  return `${c.organizacao || 'Organização'} · acesso de criador`
}

function labelTipo(tipo: Tipo) {
  return { arbitro: 'Árbitro', quadra: 'Fornecedor de quadra', organizador: 'Criador de campeonatos' }[tipo]
}

function formatStatus(value: string) {
  const labels: Record<string, string> = {
    PENDENTE: 'Pendente',
    APROVADA: 'Aprovada',
    REJEITADA: 'Rejeitada',
    ATIVA: 'Ativa',
    TODAS: 'Todas',
    EM_BREVE: 'Em breve',
  }
  return labels[value] ?? value?.replace(/_/g, ' ') ?? ''
}

function formatDate(value: string) {
  if (!value) return ''
  return new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function parseJsonArray(value: unknown): any[] {
  if (Array.isArray(value)) return value
  if (typeof value !== 'string') return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return value.split(/[\n,;]/).map((item) => item.trim()).filter(Boolean)
  }
}

function parseJsonObject(value: unknown): Record<string, any> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>
  if (typeof value !== 'string') return {}
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function formatHorariosTreino(value: unknown) {
  const items = parseJsonArray(value)
  if (!items.length) return 'Não informado'
  return items.map((item) => typeof item === 'string' ? item : `${displayDay(String(item.diaSemana || ''))} ${item.horario || ''}`.trim()).filter(Boolean).join(', ')
}

function formatQuadraHorarios(value: unknown) {
  const parsed = parseJsonObject(value)
  if (typeof value === 'string' && !value.trim().startsWith('{')) return value || 'Não informado'

  if (Array.isArray(parsed.horariosDisponiveis)) {
    const formatted = parsed.horariosDisponiveis
      .map((item: any) => {
        const inicio = String(item.horaInicio || item.horario || '')
        const fim = String(item.horaFim || '')
        const faixa = inicio && fim ? `${inicio} às ${fim}` : inicio
        return `${displayDay(String(item.diaSemana || ''))} ${faixa}`.trim()
      })
      .filter(Boolean)
      .join(', ')
    if (formatted) return formatted
  }

  return 'Não informado'
}

function displayDay(day: string) {
  const labels: Record<string, string> = { Terca: 'Terça', Sabado: 'Sábado' }
  return labels[day] ?? day
}

function labelCategoriaEtaria(value: string) {
  const labels: Record<string, string> = { SUB15: 'Sub 15', SUB18: 'Sub 18', SUB21: 'Sub 21', ADULTO: 'Adulto (+22)', MASTER: 'Master (+38)' }
  return labels[value] ?? value
}

function labelNivel(value: string) {
  const labels: Record<string, string> = { INICIANTE: 'Iniciante', INTERMEDIARIO: 'Intermediário', AVANCADO: 'Avançado' }
  return labels[value] ?? value
}

function labelPlanoOrganizador(value: string) {
  const labels: Record<string, string> = { PADRAO: 'Padrão liberado', STARTER: 'Inicial', PRO: 'Profissional', ELITE: 'Liga Pro' }
  return labels[value] ?? value
}
