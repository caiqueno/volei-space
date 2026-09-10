'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarDays,
  CalendarPlus,
  ClipboardCheck,
  CheckCircle2,
  Equal,
  Gavel,
  LockKeyhole,
  LogOut,
  Mail,
  MapPin,
  MapPinned,
  Medal,
  Plus,
  Send,
  ShieldCheck,
  Trash2,
  Trophy,
  Unlock,
  UsersRound,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { CandidateEditForm, type CandidateEditSection } from '@/components/candidate/CandidateEditForm'
import { PartidasAbertasArbitro } from '@/components/arbitro/PartidasAbertasArbitro'
import { PartidaCard } from '@/components/partidas/PartidaCard'
import PageLoading from '@/components/ui/page-loading'
import { VolleyballActionButton } from '@/components/ui/volleyball-action-button'
import { formatEliminatoryPhase, getRequiredEliminatoryTeams } from '@/lib/eliminatorias'
import { isoToDateInput } from '@/lib/date-brazil'
import { formatLigaFormato, formatLigaStatusLabel, type LigaPanel } from '@/lib/liga-panel'

type Session = {
  tipo: string
  perfil?: string
  nome?: string
  email?: string
  candidaturaId?: string | null
  status?: string
}

type PanelCardData = {
  icon: LucideIcon
  title: string
  text: string
  status: string
  editSection?: CandidateEditSection
  editLabel?: string
}

type BibliotecaArbitroPanel = {
  id: string
  nome: string
  email?: string | null
  telefone?: string | null
  status?: string | null
  cref?: string | null
  diplomaUrl?: string | null
}

type BibliotecaQuadraPanel = {
  id: string
  nome: string
  responsavel?: string | null
  email?: string | null
  telefone?: string | null
  instagram?: string | null
  status?: string | null
  endereco?: string | null
  bairro?: string | null
  estrutura?: string | null
  fotosUrls?: string | string[] | null
}

type InscricaoPanel = {
  id: string
  status: string
  ligaId?: number | null
  liga?: LigaPanel
  equipe?: {
    id: number
    nome: string
    categoria?: string
    serie?: string
    criadoEm?: string
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
}

type ConviteEquipePanel = {
  id: string
  email: string
  nomeEquipe?: string | null
  status: string
  criadoEm?: string
  liga?: LigaPanel
}

type PartidaManualPanel = {
  id: number
  rodada?: number | null
  status: string
  dataHora?: string | null
  setsPorA?: number | null
  setsPorB?: number | null
  pontosPorA?: number | null
  pontosPorB?: number | null
  sets?: Array<{ numero: number; pontosA: number; pontosB: number }>
  liga?: LigaPanel
  equipeA?: { id: number; nome: string; slug?: string | null }
  equipeB?: { id: number; nome: string; slug?: string | null }
}

type ManualSetScore = {
  pontosA: string
  pontosB: string
}

type ManualScoreDraft = {
  sets: ManualSetScore[]
}

function getManualSetCount(partida: PartidaManualPanel) {
  const liga = Array.isArray(partida.liga) ? partida.liga[0] : partida.liga
  return Math.max(1, Number(liga?.setsPorPartida ?? 3))
}

function buildManualScoreDraft(partida: PartidaManualPanel): ManualScoreDraft {
  const totalSets = getManualSetCount(partida)
  const savedSets = Array.isArray(partida.sets)
    ? [...partida.sets].sort((a, b) => Number(a.numero) - Number(b.numero))
    : []

  return {
    sets: Array.from({ length: totalSets }, (_, index) => {
      const saved = savedSets.find((set) => Number(set.numero) === index + 1)
      return {
        pontosA: saved?.pontosA == null ? '' : String(saved.pontosA),
        pontosB: saved?.pontosB == null ? '' : String(saved.pontosB),
      }
    }),
  }
}

function normalizeManualScoreDraft(partida: PartidaManualPanel, draft?: ManualScoreDraft) {
  const totalSets = getManualSetCount(partida)
  const sets = draft?.sets ?? []
  return {
    sets: Array.from({ length: totalSets }, (_, index) => sets[index] ?? { pontosA: '', pontosB: '' }),
  }
}

const contentByType: Record<'arbitro' | 'quadra' | 'organizador', {
  kicker: string
  fallbackName: string
  title: string
  description: string
  statusTitle: string
  statusText: string
  cards: PanelCardData[]
  steps: string[]
}> = {
  arbitro: {
    kicker: 'Painel do árbitro',
    fallbackName: 'árbitro',
    title: 'Sua candidatura foi recebida.',
    description:
      'A organização vai validar seus dados, registro e disponibilidade antes de liberar escala, súmulas e partidas oficiais.',
    statusTitle: 'Em análise',
    statusText: 'Depois da aprovação, as escalas e jogos atribuídos aparecerão neste painel.',
    cards: [
      { icon: ClipboardCheck, title: 'Cadastro', text: 'Dados pessoais e contato enviados para análise.', status: 'Pendente', editSection: 'cadastro', editLabel: 'Editar dados' },
      { icon: BadgeCheck, title: 'Credenciais', text: 'Registro, certificado ou comprovação serão avaliados.', status: 'Em análise', editSection: 'credenciais', editLabel: 'Editar credenciais' },
      { icon: CalendarDays, title: 'Escalas', text: 'Partidas designadas serão exibidas após aprovação.', status: 'Em breve' },
      { icon: ShieldCheck, title: 'Súmulas', text: 'Acesso operacional para validar jogos oficiais.', status: 'Em breve' },
    ],
    steps: ['Aguardar validação da organização', 'Receber aprovação por e-mail', 'Acompanhar escalas oficiais', 'Acessar súmulas liberadas'],
  },
  quadra: {
    kicker: 'Painel do fornecedor',
    fallbackName: 'fornecedor',
    title: 'Sua quadra foi enviada para análise.',
    description:
      'A organização vai avaliar localização, estrutura, disponibilidade e operação antes de publicar ou usar o espaço na temporada.',
    statusTitle: 'Em análise',
    statusText: 'Após aprovação, a disponibilidade e os jogos vinculados ao local ficarão disponíveis aqui.',
    cards: [
      { icon: Building2, title: 'Arena', text: 'Dados do local e responsável recebidos.', status: 'Pendente', editSection: 'arena', editLabel: 'Editar arena' },
      { icon: MapPin, title: 'Localização', text: 'Endereço e bairro serão conferidos pela organização.', status: 'Em análise', editSection: 'localizacao', editLabel: 'Editar endereço' },
      { icon: CalendarDays, title: 'Disponibilidade', text: 'Horários informados serão usados no planejamento.', status: 'Em breve', editSection: 'disponibilidade', editLabel: 'Editar horários' },
      { icon: ShieldCheck, title: 'Estrutura', text: 'Recursos do local e operação serão revisados.', status: 'Em breve', editSection: 'estrutura', editLabel: 'Editar estrutura' },
    ],
    steps: ['Aguardar análise da estrutura', 'Confirmar disponibilidade com a organização', 'Receber aprovação por e-mail', 'Acompanhar jogos vinculados ao espaço'],
  },
  organizador: {
    kicker: 'Painel do criador',
    fallbackName: 'criador de campeonatos',
    title: 'Sua área de campeonatos está ativa.',
    description:
      'Seu acesso padrão foi criado para publicar campeonatos, abrir inscrições, acompanhar equipes e operar competições pela volei.space.',
    statusTitle: 'Ativo',
    statusText: 'Criação de campeonatos, inscrições, calendário e operação ficam disponíveis neste painel.',
    cards: [
      { icon: CalendarPlus, title: 'Campeonatos', text: 'Crie e gerencie competições da sua organização.', status: 'Liberado' },
      { icon: ClipboardCheck, title: 'Inscrições', text: 'Acompanhe equipes candidatas por campeonato.', status: 'Liberado' },
      { icon: CalendarDays, title: 'Calendário', text: 'Rodadas, locais e horários organizados por competição.', status: 'Liberado' },
      { icon: ShieldCheck, title: 'Operação', text: 'Equipes, súmulas e resultados em um painel dedicado.', status: 'Liberado' },
    ],
    steps: ['Criar o primeiro campeonato', 'Abrir inscrições para equipes', 'Validar participantes', 'Operar calendário e súmulas'],
  },
}

export default function PainelPage() {
  const [session, setSession] = useState<Session | null>(null)
  const [editSection, setEditSection] = useState<CandidateEditSection | null>(null)

  useEffect(() => {
    try {
      setSession(JSON.parse(window.localStorage.getItem('luva_session') ?? 'null'))
    } catch {
      setSession(null)
    }
  }, [])

  useEffect(() => {
    if (!session?.candidaturaId || !['arbitro', 'quadra'].includes(session.tipo)) return

    async function refreshPublicSession() {
      try {
        const tipoMap: Record<string, string> = {
          arbitro: 'arbitro',
          quadra: 'quadra',
        }
        const res = await fetch(`/api/candidaturas/${tipoMap[session!.tipo]}/${encodeURIComponent(session!.candidaturaId!)}`, { cache: 'no-store' })
        const json = await res.json().catch(() => ({}))
        const candidatura = json.data?.candidatura
        if (!res.ok || !candidatura) return

        setSession((current) => {
          if (!current) return current
          const updated = {
            ...current,
            nome: candidatura.nome || current.nome,
            email: candidatura.email || current.email,
            status: candidatura.status || current.status,
          }
          window.localStorage.setItem('luva_session', JSON.stringify(updated))
          return updated
        })
      } catch {
        // Mantém o painel com a sessão local se a sincronização falhar.
      }
    }

    refreshPublicSession()
  }, [session?.candidaturaId, session?.tipo])

  const content = useMemo(() => {
    if (session?.tipo === 'arbitro') return contentByType.arbitro
    if (session?.tipo === 'quadra') return contentByType.quadra
    if (session?.tipo === 'organizador') return contentByType.organizador
    return null
  }, [session])

  function logout() {
    window.localStorage.removeItem('luva_session')
    window.location.href = '/'
  }

  if (session?.tipo === 'organizador') {
    return <OrganizadorDashboard session={session} logout={logout} />
  }

  if (session?.tipo === 'equipe') {
    return (
      <main className="luva-shell public-dashboard min-h-screen px-4 py-12">
        <section className="public-panel mx-auto max-w-3xl rounded-[2rem] border p-8 text-center">
          <p className="luva-kicker">Painel da equipe</p>
          <h1 className="mt-3 font-display text-4xl font-black text-white">Use o painel da equipe.</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm font-semibold leading-6 text-slate-200">
            O acompanhamento de equipe, atletas e QR Codes fica em uma área dedicada.
          </p>
          <Link href="/capitao" className="public-primary-action mt-6 inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-black transition">
            Ir para o painel
            <ArrowRight size={17} />
          </Link>
        </section>
      </main>
    )
  }

  if (!session || !content) {
    return (
      <main className="luva-shell public-dashboard min-h-screen px-4 py-12">
        <section className="public-panel mx-auto max-w-3xl rounded-[2rem] border p-8 text-center">
          <p className="luva-kicker">Acesso restrito</p>
          <h1 className="mt-3 font-display text-4xl font-black text-white">Entre para acessar seu painel.</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm font-semibold leading-6 text-slate-200">
            Use o e-mail e a senha informados no cadastro para acompanhar o status da candidatura.
          </p>
          <Link href="/cadastro?modo=login" className="public-primary-action mt-6 inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-black transition">
            Entrar
            <ArrowRight size={17} />
          </Link>
        </section>
      </main>
    )
  }

  const released = isReleasedStatus(session.status)
  const statusTitle = released ? (session.tipo === 'quadra' ? 'Aprovada' : 'Aprovado') : content.statusTitle
  const statusText = released
    ? 'Perfil liberado. As áreas operacionais já podem ser utilizadas conforme os recursos disponíveis.'
    : content.statusText

  return (
    <main className="luva-shell public-dashboard min-h-screen overflow-hidden">
      <section className="public-hero">
        <div className={`mx-auto grid max-w-7xl gap-8 px-4 py-12 lg:items-center ${released ? 'lg:grid-cols-1' : 'lg:grid-cols-[1fr_390px]'}`}>
          <div className="motion-in">
            <p className="luva-kicker">{content.kicker}</p>
            <h1 className="mt-4 max-w-3xl font-display text-5xl font-black leading-tight text-white md:text-6xl">
              Bem-vindo, {session.nome || content.fallbackName}.
            </h1>
            <p className="mt-4 max-w-2xl text-base font-semibold leading-8 text-slate-200">
              {content.description}
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link href="/portal" className="public-primary-action inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-black transition">
                Ver portal
                <ArrowRight size={17} />
              </Link>
              <button onClick={logout} className="public-secondary-action inline-flex items-center justify-center gap-2 rounded-full border px-5 py-3 text-sm font-black transition">
                <LogOut size={17} />
                Sair
              </button>
            </div>
          </div>

          {!released && <aside className="public-panel motion-in-delay rounded-[2rem] border p-5 backdrop-blur-2xl">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-luva-amber">Status da candidatura</p>
            <div className="public-status-box mt-4 rounded-2xl border p-4">
              <p className="font-display text-2xl font-black text-white">{statusTitle}</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-200">{statusText}</p>
            </div>
            {session.email && <p className="mt-4 truncate text-sm font-bold text-slate-200">{session.email}</p>}
          </aside>}
        </div>
      </section>

      {!released && <section className="mx-auto grid max-w-7xl gap-4 px-4 py-10 md:grid-cols-2 lg:grid-cols-4">
        {content.cards.map((card) => (
          <PanelCard
            key={card.title}
            {...normalizeCardForStatus(card, released)}
            onEdit={!released && card.editSection ? () => setEditSection(card.editSection!) : undefined}
          />
        ))}
      </section>}

      {session.tipo === 'arbitro' && (
        <section className="mx-auto max-w-7xl px-4 pb-12">
          <PartidasAbertasArbitro compact />
        </section>
      )}

      {!released && (
        <section className="mx-auto grid max-w-7xl gap-6 px-4 pb-12 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="public-panel rounded-[1.5rem] border p-6">
            <p className="luva-kicker">Próximos passos</p>
            <h2 className="mt-3 font-display text-3xl font-black text-white">{content.title}</h2>
            <div className="mt-5 space-y-3">
              {content.steps.map((item, index) => (
                <div key={item} className="public-step-item flex items-center gap-3 rounded-2xl border p-3">
                  <span className="public-step-number flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black">{index + 1}</span>
                  <p className="text-sm font-black text-slate-100">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="public-panel rounded-[1.5rem] border p-6">
            <p className="luva-kicker">Comunicação</p>
            <h2 className="mt-3 font-display text-3xl font-black text-white">Acompanhe seu e-mail.</h2>
            <p className="mt-3 text-sm font-semibold leading-7 text-slate-200">
              O cadastro recebido, a aprovação e próximos avisos são enviados para o mesmo e-mail informado no formulário.
              Enquanto isso, este painel mantém o status inicial e prepara os módulos que serão liberados.
            </p>
            <div className="public-note mt-5 rounded-2xl border p-4 text-sm font-bold leading-7">
              Candidatura registrada como {session.status || 'PENDENTE'}. Você pode editar os dados permitidos nos cards acima enquanto a candidatura estiver pendente.
            </div>
          </div>
        </section>
      )}

      {(session.tipo === 'arbitro' || session.tipo === 'quadra') && (
        <CandidateEditForm
          tipo={session.tipo}
          session={session}
          section={editSection}
          open={Boolean(editSection)}
          onClose={() => setEditSection(null)}
          onSessionUpdate={setSession}
        />
      )}
    </main>
  )
}

function OrganizadorDashboard({ session, logout }: { session: Session; logout: () => void }) {
  const router = useRouter()
  const [criandoLiga, setCriandoLiga] = useState(false)
  const [ligas, setLigas] = useState<LigaPanel[]>([])
  const [inscricoes, setInscricoes] = useState<InscricaoPanel[]>([])
  const [convites, setConvites] = useState<ConviteEquipePanel[]>([])
  const [partidasManuais, setPartidasManuais] = useState<PartidaManualPanel[]>([])
  const [meusJogos, setMeusJogos] = useState<any[]>([])
  const [arbitrosBiblioteca, setArbitrosBiblioteca] = useState<BibliotecaArbitroPanel[]>([])
  const [quadrasBiblioteca, setQuadrasBiblioteca] = useState<BibliotecaQuadraPanel[]>([])
  const [manualScore, setManualScore] = useState<Record<number, ManualScoreDraft>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [inscricaoLigaFilter, setInscricaoLigaFilter] = useState('all')
  const [inscricaoStatusFilter, setInscricaoStatusFilter] = useState('SOLICITADA')
  const [editingLiga, setEditingLiga] = useState<LigaPanel | null>(null)
  const [ligaModalOpen, setLigaModalOpen] = useState(false)
  const [draftSlugCode, setDraftSlugCode] = useState(() => Date.now().toString(36))
  const [form, setForm] = useState({
    nome: '',
    subtitulo: '',
    descricao: '',
    regulamento: '',
    premiacao: '',
    dataInicio: '',
    dataFim: '',
    prazoAlteracaoElencoDias: '7',
    quantidadeEquipes: '8',
    formato: 'PONTOS_CORRIDOS',
    setsPorPartida: '3',
    pontosPorSet: '21',
    tieBreakUltimoSet: false,
    pontosUltimoSet: '15',
    quantidadeGrupos: '1',
    nomesGrupos: ['Grupo A'],
    criteriosClassificacao: ['PONTOS', 'VITORIAS', 'SALDO_SETS', 'SALDO_PONTOS'],
    faseEliminatoria: 'SEMIFINAL',
    classificadosPorGrupo: '2',
    rebaixados: '0',
    podioDestaques: ['1', '2', '3'],
    status: 'EM_BREVE',
    inscricoesAbertas: true,
    categoriasConfig: [DEFAULT_CATEGORIA_SERIE],
  })
  const [inviteForm, setInviteForm] = useState({
    ligaId: '',
    email: '',
    nomeEquipe: '',
    mensagem: '',
  })

  const organizadorId = session.candidaturaId

  useEffect(() => {
    if (!organizadorId) return
    loadOrganizerData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizadorId])

  async function loadOrganizerData() {
    if (!organizadorId) return
    setLoading(true)
    setFeedback(null)
    try {
      const [ligasRes, inscricoesRes, convitesRes, partidasManuaisRes, arbitrosRes, quadrasRes, meusJogosRes] = await Promise.all([
        fetch(`/api/ligas?organizadorId=${encodeURIComponent(organizadorId)}`, { cache: 'no-store' }),
        fetch(`/api/inscricoes-campeonato?organizadorId=${encodeURIComponent(organizadorId)}`, { cache: 'no-store' }),
        fetch('/api/convites-equipe', { cache: 'no-store' }),
        fetch('/api/resultados-manuais', { cache: 'no-store' }),
        fetch('/api/organizador/arbitros', { cache: 'no-store' }),
        fetch('/api/organizador/quadras', { cache: 'no-store' }),
        fetch('/api/organizador/partidas', { cache: 'no-store' }),
      ])
      const ligasJson = await ligasRes.json()
      const inscricoesJson = await inscricoesRes.json()
      const convitesJson = await convitesRes.json()
      const partidasJson = await partidasManuaisRes.json()
      const arbitrosJson = await arbitrosRes.json().catch(() => ({}))
      const quadrasJson = await quadrasRes.json().catch(() => ({}))
      const meusJogosJson = await meusJogosRes.json().catch(() => ({}))
      const failedResponse = !ligasRes.ok && !inscricoesRes.ok
        ? [ligasRes, ligasJson]
        : null

      if (failedResponse) {
        const [, payload] = failedResponse as [Response, { error?: string }]
        throw new Error(payload.error ?? 'Não foi possível carregar os dados do painel.')
      }
      const ligasDiretas: LigaPanel[] = ligasRes.ok && Array.isArray(ligasJson.data) ? ligasJson.data : []
      const ligasDasInscricoes: LigaPanel[] = inscricoesRes.ok && Array.isArray(inscricoesJson.data?.campeonatos)
        ? inscricoesJson.data.campeonatos
        : []
      const ligasDisponiveis = Array.from(
        new Map([...ligasDiretas, ...ligasDasInscricoes].map((liga) => [String(liga.id), liga])).values(),
      )
      setLigas(ligasDisponiveis)
      setInviteForm((current) => (
        current.ligaId && !ligasDisponiveis.some((liga) => String(liga.id) === current.ligaId)
          ? { ...current, ligaId: '' }
          : current
      ))
      setInscricaoLigaFilter((current) => (
        current !== 'all' && !ligasDisponiveis.some((liga) => String(liga.id) === current)
          ? 'all'
          : current
      ))
      setInscricoes(inscricoesRes.ok ? (inscricoesJson.data?.inscricoes ?? []) : [])
      setConvites(convitesRes.ok ? (convitesJson.data ?? []) : [])
      setArbitrosBiblioteca(arbitrosRes.ok ? (arbitrosJson.data ?? []) : [])
      setQuadrasBiblioteca(quadrasRes.ok ? (quadrasJson.data ?? []) : [])
      setMeusJogos(meusJogosRes.ok ? (meusJogosJson.data ?? []) : [])
      const partidas = partidasManuaisRes.ok ? (partidasJson.data ?? []) : []
      setPartidasManuais(partidas)
      setManualScore((current) => {
        const next = { ...current }
        partidas.forEach((partida: PartidaManualPanel) => {
          if (next[partida.id]) return
          next[partida.id] = buildManualScoreDraft(partida)
        })
        return next
      })
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Não foi possível carregar os dados do painel.')
    } finally {
      setLoading(false)
    }
  }

  function slugify(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 54)
  }

  async function createLiga(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!organizadorId || !form.nome.trim()) return
    setSaving(true)
    setFeedback(null)

    const payload = {
      organizadorId,
      nome: form.nome.trim(),
      slug: `${slugify(form.nome)}-c${draftSlugCode}`,
      subtitulo: form.subtitulo.trim() || undefined,
      descricao: form.descricao.trim() || undefined,
      regulamento: form.regulamento.trim() || undefined,
      premiacao: form.premiacao.trim() || undefined,
      dataInicio: form.dataInicio ? new Date(`${form.dataInicio}T00:00:00`).toISOString() : undefined,
      dataFim: form.dataFim ? new Date(`${form.dataFim}T23:59:59`).toISOString() : undefined,
      prazoAlteracaoElencoDias: Number(form.prazoAlteracaoElencoDias || 7),
      quantidadeEquipes: Number(form.quantidadeEquipes),
      formato: form.formato,
      setsPorPartida: Number(form.setsPorPartida || 3),
      pontosPorSet: Number(form.pontosPorSet || 21),
      tieBreakUltimoSet: form.tieBreakUltimoSet,
      pontosUltimoSet: form.tieBreakUltimoSet ? Number(form.pontosUltimoSet || 15) : null,
      quantidadeGrupos: Number(form.quantidadeGrupos || 1),
      nomesGrupos: JSON.stringify(normalizeGroupNames(form.nomesGrupos, Number(form.quantidadeGrupos || 1))),
      criteriosClassificacao: JSON.stringify(form.criteriosClassificacao),
      faseEliminatoria: form.formato === 'PONTOS_CORRIDOS' ? 'NENHUMA' : form.faseEliminatoria,
      classificadosPorGrupo: Number(form.classificadosPorGrupo || 2),
      rebaixados: Number(form.rebaixados || 0),
      podioDestaques: JSON.stringify(form.podioDestaques),
      status: form.status,
      inscricoesAbertas: form.inscricoesAbertas,
      categoriasConfig: JSON.stringify(form.categoriasConfig),
      corTematica: '#0F2C52',
    }

    try {
      const response = await fetch('/api/ligas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error ?? 'Erro ao criar campeonato')
      setForm(defaultLigaForm())
      setDraftSlugCode(Date.now().toString(36))
      setFeedback('Campeonato criado e vinculado ao seu painel.')
      setLigaModalOpen(false)
      await loadOrganizerData()
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Erro ao criar campeonato')
    } finally {
      setSaving(false)
    }
  }

  function toggleCategoriaSerie(key: string) {
    setForm((current) => {
      const exists = current.categoriasConfig.includes(key)
      const next = exists ? current.categoriasConfig.filter((item) => item !== key) : [...current.categoriasConfig, key]
      return { ...current, categoriasConfig: next.length ? next : current.categoriasConfig }
    })
  }

  function toggleCriterioClassificacao(key: string) {
    setForm((current) => {
      const exists = current.criteriosClassificacao.includes(key)
      const next = exists ? current.criteriosClassificacao.filter((item) => item !== key) : [...current.criteriosClassificacao, key]
      return { ...current, criteriosClassificacao: next.length ? next : current.criteriosClassificacao }
    })
  }

  function togglePodioDestaque(key: string) {
    setForm((current) => {
      const exists = current.podioDestaques.includes(key)
      const next = exists ? current.podioDestaques.filter((item) => item !== key) : [...current.podioDestaques, key]
      return { ...current, podioDestaques: next.length ? next : current.podioDestaques }
    })
  }

  function updateQuantidadeGrupos(value: string) {
    const amount = Math.max(1, Math.min(32, Number(value || 1)))
    setForm((current) => ({
      ...current,
      quantidadeGrupos: String(amount),
      nomesGrupos: normalizeGroupNames(current.nomesGrupos, amount),
    }))
  }

  function updateNomeGrupo(index: number, value: string) {
    setForm((current) => {
      const grupos = normalizeGroupNames(current.nomesGrupos, Number(current.quantidadeGrupos || 1))
      grupos[index] = value
      return { ...current, nomesGrupos: grupos }
    })
  }

  function startEditingLiga(liga: LigaPanel) {
    setFeedback(null)
    setEditingLiga(liga)
    setLigaModalOpen(true)
    setForm({
      nome: liga.nome,
      subtitulo: liga.subtitulo ?? '',
      descricao: liga.descricao ?? '',
      regulamento: liga.regulamento ?? '',
      premiacao: liga.premiacao ?? '',
      dataInicio: toDateInputValue(liga.dataInicio),
      dataFim: toDateInputValue(liga.dataFim),
      prazoAlteracaoElencoDias: String(liga.prazoAlteracaoElencoDias ?? 7),
      quantidadeEquipes: String(liga.quantidadeEquipes ?? 8),
      formato: liga.formato ?? 'PONTOS_CORRIDOS',
      setsPorPartida: String(liga.setsPorPartida ?? 3),
      pontosPorSet: String(liga.pontosPorSet ?? 21),
      tieBreakUltimoSet: Boolean(liga.tieBreakUltimoSet),
      pontosUltimoSet: String(liga.pontosUltimoSet ?? 15),
      quantidadeGrupos: String(liga.quantidadeGrupos ?? 1),
      nomesGrupos: parseStringArray(liga.nomesGrupos, ['Grupo A']),
      criteriosClassificacao: parseStringArray(liga.criteriosClassificacao, ['PONTOS', 'VITORIAS', 'SALDO_SETS', 'SALDO_PONTOS']),
      faseEliminatoria: liga.faseEliminatoria ?? (liga.formato === 'PONTOS_CORRIDOS' ? 'NENHUMA' : 'SEMIFINAL'),
      classificadosPorGrupo: String(liga.classificadosPorGrupo ?? 2),
      rebaixados: String(liga.rebaixados ?? 0),
      podioDestaques: parseStringArray(liga.podioDestaques, ['1', '2', '3']),
      status: liga.status ?? 'EM_BREVE',
      inscricoesAbertas: liga.inscricoesAbertas !== false,
      categoriasConfig: parseCategoriasConfig(liga.categoriasConfig),
    })
  }

  function cancelEditingLiga() {
    setEditingLiga(null)
    setForm(defaultLigaForm())
    setLigaModalOpen(false)
  }

  function openNewLigaModal() {
    setFeedback(null)
    setEditingLiga(null)
    setForm(defaultLigaForm())
    setDraftSlugCode(Date.now().toString(36))
    setLigaModalOpen(true)
  }

  async function criarCampeonatoMinimo() {
    if (!organizadorId || criandoLiga) return
    setCriandoLiga(true)
    setFeedback(null)
    try {
      const nome = 'Novo campeonato'
      const slug = `${slugify(nome)}-c${Date.now().toString(36)}`
      const response = await fetch('/api/ligas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizadorId, nome, slug }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error ?? 'Erro ao criar campeonato')
      router.push(`/painel/parametrizacao?ligaId=${json.data.id}`)
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Erro ao criar campeonato')
      setCriandoLiga(false)
    }
  }

  async function saveLiga(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editingLiga || !organizadorId) return
    setSaving(true)
    setFeedback(null)

    const payload = {
      organizadorId,
      nome: form.nome.trim(),
      slug: editingLiga.slug,
      subtitulo: form.subtitulo.trim() || undefined,
      descricao: form.descricao.trim() || undefined,
      regulamento: form.regulamento.trim() || undefined,
      premiacao: form.premiacao.trim() || undefined,
      dataInicio: form.dataInicio ? new Date(`${form.dataInicio}T00:00:00`).toISOString() : undefined,
      dataFim: form.dataFim ? new Date(`${form.dataFim}T23:59:59`).toISOString() : undefined,
      prazoAlteracaoElencoDias: Number(form.prazoAlteracaoElencoDias || 7),
      quantidadeEquipes: Number(form.quantidadeEquipes),
      formato: form.formato,
      setsPorPartida: Number(form.setsPorPartida || 3),
      pontosPorSet: Number(form.pontosPorSet || 21),
      tieBreakUltimoSet: form.tieBreakUltimoSet,
      pontosUltimoSet: form.tieBreakUltimoSet ? Number(form.pontosUltimoSet || 15) : null,
      quantidadeGrupos: Number(form.quantidadeGrupos || 1),
      nomesGrupos: JSON.stringify(normalizeGroupNames(form.nomesGrupos, Number(form.quantidadeGrupos || 1))),
      criteriosClassificacao: JSON.stringify(form.criteriosClassificacao),
      faseEliminatoria: form.formato === 'PONTOS_CORRIDOS' ? 'NENHUMA' : form.faseEliminatoria,
      classificadosPorGrupo: Number(form.classificadosPorGrupo || 2),
      rebaixados: Number(form.rebaixados || 0),
      podioDestaques: JSON.stringify(form.podioDestaques),
      status: form.status,
      inscricoesAbertas: form.inscricoesAbertas,
      categoriasConfig: JSON.stringify(form.categoriasConfig),
      corTematica: '#0F2C52',
    }

    try {
      const response = await fetch(`/api/ligas/${editingLiga.slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error ?? 'Erro ao salvar campeonato')
      setFeedback('Campeonato atualizado com sucesso.')
      setEditingLiga(null)
      setForm(defaultLigaForm())
      setLigaModalOpen(false)
      await loadOrganizerData()
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Erro ao salvar campeonato')
    } finally {
      setSaving(false)
    }
  }

  async function updateInscricao(id: string, status: 'APROVADA' | 'REJEITADA') {
    setFeedback(null)
    const response = await fetch('/api/inscricoes-campeonato', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    const json = await response.json()
    if (!response.ok) {
      setFeedback(json.error ?? 'Erro ao atualizar inscrição')
      return
    }
    setFeedback(status === 'APROVADA' ? 'Equipe aprovada no campeonato.' : 'Inscrição rejeitada.')
    await loadOrganizerData()
  }

  async function updateBiblioteca(tipo: 'arbitros' | 'quadras', id: string, action: 'APROVAR' | 'REMOVER') {
    setFeedback(null)
    const response = await fetch(`/api/organizador/${tipo}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action }),
    })
    const json = await response.json().catch(() => ({}))
    if (!response.ok) {
      setFeedback(json.error ?? 'Erro ao atualizar biblioteca.')
      return
    }
    setFeedback(action === 'APROVAR' ? 'Cadastro aprovado para a biblioteca.' : 'Cadastro removido da biblioteca.')
    await loadOrganizerData()
  }

  async function sendInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!inviteForm.ligaId || !inviteForm.email.trim()) {
      setFeedback('Selecione o campeonato e informe o e-mail da equipe.')
      return
    }

    setSaving(true)
    setFeedback(null)
    try {
      const response = await fetch('/api/convites-equipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ligaId: Number(inviteForm.ligaId),
          email: inviteForm.email.trim(),
          nomeEquipe: inviteForm.nomeEquipe.trim() || undefined,
          mensagem: inviteForm.mensagem.trim() || undefined,
        }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error ?? 'Erro ao enviar convite')
      setInviteForm({ ligaId: '', email: '', nomeEquipe: '', mensagem: '' })
      setFeedback('Convite enviado para a equipe.')
      await loadOrganizerData()
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Erro ao enviar convite')
    } finally {
      setSaving(false)
    }
  }

  async function saveManualResult(partida: PartidaManualPanel) {
    const score = normalizeManualScoreDraft(partida, manualScore[partida.id])
    const filledSets = score.sets
      .map((set, index) => ({
        numero: index + 1,
        pontosA: set.pontosA.trim(),
        pontosB: set.pontosB.trim(),
      }))
      .filter((set) => set.pontosA !== '' || set.pontosB !== '')

    if (filledSets.length === 0) {
      setFeedback('Informe o placar de pelo menos um set.')
      return
    }
    if (filledSets.some((set) => set.pontosA === '' || set.pontosB === '')) {
      setFeedback('Preencha os dois lados de cada set informado.')
      return
    }

    setSaving(true)
    setFeedback(null)
    try {
      const response = await fetch('/api/resultados-manuais', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partidaId: partida.id,
          sets: filledSets.map((set) => ({
            numero: set.numero,
            pontosA: Number(set.pontosA),
            pontosB: Number(set.pontosB),
          })),
        }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error ?? 'Erro ao lançar resultado')
      setFeedback('Resultado manual lançado e classificação recalculada.')
      await loadOrganizerData()
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Erro ao lançar resultado')
    } finally {
      setSaving(false)
    }
  }

  const inscricoesPendentes = inscricoes.filter((item) => item.status === 'SOLICITADA')
  const inscricoesAprovadasPorLiga = useMemo(() => {
    const count = new Map<number, number>()
    inscricoes.forEach((item) => {
      if (item.status !== 'APROVADA') return
      const ligaId = item.ligaId ?? item.liga?.id
      if (!ligaId) return
      count.set(ligaId, (count.get(ligaId) ?? 0) + 1)
    })
    return count
  }, [inscricoes])
  const inscricoesPendentesPorLiga = useMemo(() => {
    const count = new Map<number, number>()
    inscricoes.forEach((item) => {
      if (item.status !== 'SOLICITADA') return
      const ligaId = item.ligaId ?? item.liga?.id
      if (!ligaId) return
      count.set(ligaId, (count.get(ligaId) ?? 0) + 1)
    })
    return count
  }, [inscricoes])
  const inscricoesFiltradas = useMemo(() => inscricoes.filter((item) => {
    const ligaId = item.ligaId ?? item.liga?.id
    const matchesLiga = inscricaoLigaFilter === 'all' || String(ligaId) === inscricaoLigaFilter
    const matchesStatus = inscricaoStatusFilter === 'TODAS' || item.status === inscricaoStatusFilter
    return matchesLiga && matchesStatus
  }), [inscricaoLigaFilter, inscricaoStatusFilter, inscricoes])

  useEffect(() => {
    if (window.location.hash !== '#inscricoes-equipes') return

    const ligaId = new URLSearchParams(window.location.search).get('ligaId')
    setInscricaoLigaFilter(ligaId || 'all')
    setInscricaoStatusFilter('SOLICITADA')
    window.setTimeout(() => {
      document.getElementById('inscricoes-equipes')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
  }, [])

  function openInscricoes(ligaId?: number) {
    setInscricaoLigaFilter(ligaId ? String(ligaId) : 'all')
    setInscricaoStatusFilter('SOLICITADA')
    window.setTimeout(() => {
      document.getElementById('inscricoes-equipes')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 0)
  }
  const previewSlugBase = slugify(form.nome) || 'nome-do-campeonato'
  const previewSlug = editingLiga?.slug ?? `${previewSlugBase}-c${draftSlugCode}`
  const publicLinkPreview = `ligaunicadevolei.com.br/campeonatos/${previewSlug}`
  const ligaJaIniciada = editingLiga ? editingLiga.status !== 'EM_BREVE' : false
  const showCreatorOnboarding = !loading && ligas.length === 0
  const showInitialLoading = loading && ligas.length === 0

  return (
    <main className="luva-shell public-dashboard creator-dashboard flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-10">
      {showInitialLoading && <PageLoading label="Carregando campeonatos..." />}
      <section className="mx-auto flex w-full max-w-2xl flex-col items-center gap-8 px-4 text-center">
        <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-12">
          <VolleyballActionButton
            title={criandoLiga ? 'Criando...' : '+ Novo'}
            subtitle={criandoLiga ? undefined : 'Campeonato'}
            onClick={criarCampeonatoMinimo}
            disabled={criandoLiga}
            aria-label="Criar novo campeonato"
          />
          <VolleyballActionButton title="Meus" subtitle="Campeonatos" href="/painel/campeonatos" aria-label="Ver meus campeonatos" />
        </div>

        {feedback && <p className="text-sm font-bold">{feedback}</p>}

        <button type="button" onClick={logout} className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400 transition hover:text-white">
          Sair
        </button>
      </section>

      {false && (
      <>
      <section className="public-hero">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 lg:grid-cols-[1fr_420px] lg:items-end">
          <div>
            <p className="luva-kicker">Painel do criador</p>
            <h1 className="mt-4 max-w-4xl font-display text-5xl font-black leading-tight text-white md:text-6xl">
              Gestão dos seus campeonatos.
            </h1>
            <p className="mt-4 max-w-2xl text-base font-semibold leading-8 text-slate-200">
              Crie competições, acompanhe inscrições de equipes e mantenha o portal público filtrado apenas pelos campeonatos da sua conta.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link href={organizadorId ? `/portal?organizador=${encodeURIComponent(organizadorId!)}` : '/portal'} className="public-primary-action inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-black transition">
                Abrir portal do criador
                <ArrowRight size={17} />
              </Link>
              <button onClick={logout} className="public-secondary-action inline-flex items-center justify-center gap-2 rounded-full border px-5 py-3 text-sm font-black transition">
                <LogOut size={17} />
                Sair
              </button>
              <button type="button" onClick={() => openInscricoes()} className="public-secondary-action inline-flex items-center justify-center gap-2 rounded-full border px-5 py-3 text-sm font-black transition">
                <ClipboardCheck size={17} />
                Revisar inscrições
                {inscricoesPendentes.length > 0 && <span className="rounded-full bg-luva-amber px-2 py-0.5 text-xs text-[#07111f]">{inscricoesPendentes.length}</span>}
              </button>
            </div>
          </div>

          <aside className="creator-stats-grid grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <CreatorStat icon={Trophy} label="Campeonatos" value={ligas.length} />
            <CreatorStat icon={UsersRound} label="Inscrições pendentes" value={inscricoesPendentes.length} />
            <CreatorStat icon={CheckCircle2} label="Equipes aprovadas" value={inscricoes.filter((item) => item.status === 'APROVADA').length} />
          </aside>
        </div>
      </section>

      {showCreatorOnboarding && (
        <section className="mx-auto max-w-7xl px-4 pt-10">
          <div className="creator-management-card rounded-[1.75rem] border p-6 md:p-8">
            <div className="grid gap-7 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
              <div>
                <p className="luva-kicker">Primeiros passos</p>
                <h2 className="mt-3 max-w-3xl font-display text-3xl font-black leading-tight text-white md:text-4xl">
                  Crie seu primeiro campeonato.
                </h2>
                <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-slate-200">
                  Comece pela competição principal. Depois disso o painel libera inscrições, página pública, calendário, equipes e acompanhamento da operação.
                </p>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <button type="button" onClick={openNewLigaModal} className="public-primary-action inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-black transition">
                    <CalendarPlus size={18} />
                    Criar campeonato
                  </button>
                  <Link href="/campeonatos" className="public-secondary-action inline-flex items-center justify-center gap-2 rounded-full border px-5 py-3 text-sm font-black transition">
                    Ver campeonatos públicos
                    <ArrowRight size={17} />
                  </Link>
                </div>
              </div>

              <div className="grid gap-3">
                {[
                  ['1', 'Definir competição', 'Nome, status, formato, número de equipes e categorias.'],
                  ['2', 'Abrir inscrições', 'Equipes encontram o campeonato e solicitam participação.'],
                  ['3', 'Operar a temporada', 'Aprovações, partidas, árbitros, quadras e portal público ficam no painel.'],
                ].map(([index, title, description]) => (
                  <div key={index} className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
                    <div className="flex gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#ffb331] text-sm font-black text-white">
                        {index}
                      </span>
                      <div>
                        <p className="font-display text-lg font-black text-white">{title}</p>
                        <p className="mt-1 text-sm font-semibold leading-6 text-slate-300">{description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-10 lg:grid-cols-[0.78fr_1.22fr]">
        <div className="creator-management-card creator-new-competition-card rounded-[1.75rem] border p-6">
          <button type="button" onClick={openNewLigaModal} className="public-primary-action inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-black transition">
            <CalendarPlus size={18} />
            Adicionar nova competição
          </button>
          {feedback && <p className="creator-feedback mt-4 rounded-2xl border px-4 py-3 text-sm font-bold">{feedback}</p>}
        </div>

        <div className="creator-management-card rounded-[1.75rem] border p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="luva-kicker">Campeonatos criados</p>
              <h2 className="mt-2 font-display text-3xl font-black text-white">Operação</h2>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-slate-100">{loading ? 'Carregando' : `${ligas.length} campeonato(s)`}</span>
          </div>

          <div className="mt-5 grid gap-3">
            {ligas.length === 0 ? (
              <div className="creator-empty-mini rounded-2xl border p-5">
                <p className="font-black text-white">Nenhum campeonato criado ainda.</p>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-200">Crie o primeiro campeonato para liberar filtros no portal, classificação, jogos, rankings e galeria.</p>
              </div>
            ) : ligas.map((liga) => {
              const equipesAprovadas = inscricoesAprovadasPorLiga.get(liga.id) ?? 0
              const equipesPendentes = inscricoesPendentesPorLiga.get(liga.id) ?? 0
              const limiteEquipes = liga.quantidadeEquipes ?? '-'
              return (
              <article key={liga.id} className="creator-league-card rounded-2xl border p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-display text-xl font-black text-white">{liga.nome}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-200">
                      {liga.subtitulo || 'Campeonato sem subtítulo'} · {equipesAprovadas}/{limiteEquipes} equipes · {formatLigaFormato(liga.formato)}
                    </p>
                    <p className="mt-2 text-xs font-bold text-slate-300">
                      {liga.inscricoesAbertas === false ? 'Inscrições fechadas' : 'Inscrições abertas'} · {parseCategoriasConfig(liga.categoriasConfig).map(formatCategoriaSerie).join(', ')}
                    </p>
                  </div>
                  <span className="w-fit rounded-full border px-3 py-1 text-xs font-black tracking-[0.04em] text-luva-amber">{formatLigaStatusLabel(liga.status)}</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" onClick={() => startEditingLiga(liga)} className="creator-mini-action">Editar</button>
                  <button type="button" onClick={() => openInscricoes(liga.id)} className="creator-mini-action inline-flex items-center gap-2">
                    Inscrições
                    {equipesPendentes > 0 && <span className="rounded-full bg-luva-amber px-2 py-0.5 text-[10px] text-[#07111f]">{equipesPendentes}</span>}
                  </button>
                  <Link href={`/portal?organizador=${encodeURIComponent(organizadorId ?? '')}&ligaId=${liga.id}`} className="creator-mini-action">Portal</Link>
                  <Link href={`/painel/estrutura?ligaId=${liga.id}`} className="creator-mini-action">Estrutura ({equipesAprovadas})</Link>
                  <Link href={`/classificacao?organizador=${encodeURIComponent(organizadorId ?? '')}&ligaId=${liga.id}`} className="creator-mini-action">Classificação</Link>
                  <Link href={`/jogos?organizador=${encodeURIComponent(organizadorId ?? '')}&ligaId=${liga.id}`} className="creator-mini-action">Jogos</Link>
                  <Link href={`/campeonatos/${liga.slug}`} className="creator-mini-action">Link público</Link>
                </div>
              </article>
              )
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-6">
        <div className="creator-management-card rounded-[1.75rem] border p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="luva-kicker">Meus jogos</p>
              <h2 className="mt-2 font-display text-3xl font-black text-white">Súmulas das minhas partidas</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-200">
                Acesso à súmula digital só aparece aqui, autenticado como organizador — não é mais exibido nas páginas públicas de portal/jogos.
              </p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-slate-100">
              {meusJogos.length} partida(s)
            </span>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {meusJogos.length === 0 ? (
              <div className="creator-empty-mini rounded-2xl border p-5 sm:col-span-2 lg:col-span-3">
                <p className="font-black text-white">Nenhuma partida encontrada.</p>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-200">As partidas dos seus campeonatos aparecerão aqui assim que o calendário for montado.</p>
              </div>
            ) : meusJogos.map((partida) => <PartidaCard key={partida.id} partida={partida} showSumulaLink />)}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-12">
        <div className="creator-management-card rounded-[1.75rem] border p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="luva-kicker">Resultado manual</p>
              <h2 className="mt-2 font-display text-3xl font-black text-white">Alimentar placar</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-200">
                Use quando a partida foi registrada fora da súmula digital. O resultado recalcula a classificação do campeonato.
              </p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-slate-100">
              {partidasManuais.length} partida(s)
            </span>
          </div>

          <div className="mt-6 grid gap-3">
            {partidasManuais.length === 0 ? (
              <div className="creator-empty-mini rounded-2xl border p-5">
                <p className="font-black text-white">Nenhuma partida encontrada.</p>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-200">Crie jogos nos campeonatos para lançar resultados manuais quando necessário.</p>
              </div>
            ) : partidasManuais.slice(0, 12).map((partida) => {
              const equipeA = Array.isArray(partida.equipeA) ? partida.equipeA[0] : partida.equipeA
              const equipeB = Array.isArray(partida.equipeB) ? partida.equipeB[0] : partida.equipeB
              const liga = Array.isArray(partida.liga) ? partida.liga[0] : partida.liga
              const score = normalizeManualScoreDraft(partida, manualScore[partida.id])

              return (
                <article key={partida.id} className="creator-registration-card creator-manual-result-card rounded-2xl border p-4">
                  <div className="creator-manual-result-row grid gap-5">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-luva-amber">
                        {liga?.nome ?? 'Campeonato'} {partida.rodada ? `· Rodada ${partida.rodada}` : ''}
                      </p>
                      <h3 className="mt-2 font-display text-xl font-black text-white">
                        {equipeA?.nome ?? 'Equipe A'} x {equipeB?.nome ?? 'Equipe B'}
                      </h3>
                      <p className="mt-1 text-sm font-semibold text-slate-300">
                        {formatPainelDate(partida.dataHora)} · {formatLigaStatusLabel(partida.status)}
                      </p>
                    </div>
                    <div className="creator-manual-set-score rounded-2xl border border-white/10 bg-slate-950/30 p-4">
                      <div className="grid grid-cols-[70px_1fr_28px_1fr] items-end gap-3 px-1 text-center text-xs font-black uppercase tracking-[0.14em] text-slate-300">
                        <span />
                        <span>{equipeA?.nome ?? 'Equipe A'}</span>
                        <span>x</span>
                        <span>{equipeB?.nome ?? 'Equipe B'}</span>
                      </div>
                      <div className="mt-3 grid gap-2">
                        {score.sets.map((set, index) => (
                          <div key={index} className="grid grid-cols-[70px_1fr_28px_1fr] items-center gap-3">
                            <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-300">Set {index + 1}</span>
                            <ManualScoreInput
                              label={`Pontos ${equipeA?.nome ?? 'A'} no set ${index + 1}`}
                              value={set.pontosA}
                              onChange={(value) => setManualScore((current) => {
                                const next = normalizeManualScoreDraft(partida, current[partida.id])
                                next.sets[index] = { ...next.sets[index], pontosA: value }
                                return { ...current, [partida.id]: next }
                              })}
                              hideLabel
                            />
                            <span className="text-center text-base font-black text-white">x</span>
                            <ManualScoreInput
                              label={`Pontos ${equipeB?.nome ?? 'B'} no set ${index + 1}`}
                              value={set.pontosB}
                              onChange={(value) => setManualScore((current) => {
                                const next = normalizeManualScoreDraft(partida, current[partida.id])
                                next.sets[index] = { ...next.sets[index], pontosB: value }
                                return { ...current, [partida.id]: next }
                              })}
                              hideLabel
                            />
                          </div>
                        ))}
                      </div>
                      <button type="button" onClick={() => saveManualResult(partida)} disabled={saving} className="public-primary-action rounded-full px-8 py-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-60">
                        Lançar
                      </button>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-12">
        <div className="creator-management-card rounded-[1.75rem] border p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="luva-kicker">Convite manual</p>
              <h2 className="mt-2 font-display text-3xl font-black text-white">Convidar equipe</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-200">
                Envie um link direto para uma equipe se cadastrar já vinculada ao campeonato escolhido.
              </p>
            </div>
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-slate-100">
              <Mail size={14} />
              {convites.length} convite(s)
            </span>
          </div>

          <form onSubmit={sendInvite} className="mt-6 grid gap-3 lg:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-200">Campeonato</span>
              <select
                value={inviteForm.ligaId}
                onChange={(event) => setInviteForm((current) => ({ ...current, ligaId: event.target.value }))}
                className="creator-input rounded-2xl border px-4 py-3 font-bold"
                required
              >
                <option value="">Selecione o campeonato</option>
                {ligas.map((liga) => (
                  <option key={liga.id} value={liga.id}>{liga.nome}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-200">E-mail da equipe</span>
              <input
                type="email"
                value={inviteForm.email}
                onChange={(event) => setInviteForm((current) => ({ ...current, email: event.target.value }))}
                placeholder="equipe@email.com"
                className="creator-input rounded-2xl border px-4 py-3 font-bold"
                required
              />
            </label>
            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-200">Nome da equipe</span>
              <input
                value={inviteForm.nomeEquipe}
                onChange={(event) => setInviteForm((current) => ({ ...current, nomeEquipe: event.target.value }))}
                placeholder="Opcional"
                className="creator-input rounded-2xl border px-4 py-3 font-bold"
              />
            </label>
            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-200">Mensagem</span>
              <textarea
                value={inviteForm.mensagem}
                onChange={(event) => setInviteForm((current) => ({ ...current, mensagem: event.target.value }))}
                placeholder="Opcional"
                className="creator-input min-h-24 rounded-2xl border px-4 py-3 font-bold"
              />
            </label>
            <button
              type="submit"
              disabled={saving || ligas.length === 0}
              className="public-primary-action inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60 lg:col-span-2"
            >
              <Send size={17} />
              Enviar convite
            </button>
          </form>

          <div className="mt-6 grid gap-2">
            {convites.length === 0 ? (
              <div className="creator-empty-mini rounded-2xl border p-4">
                <p className="text-sm font-bold text-slate-200">Nenhum convite enviado ainda.</p>
              </div>
            ) : convites.slice(0, 8).map((convite) => {
              const conviteAceito = convite.status === 'ACEITO'
              return (
                <div key={convite.id} className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm font-bold text-slate-100 md:grid-cols-[1.2fr_1fr_auto] md:items-center">
                  <div className="min-w-0">
                    <p className="truncate">{convite.nomeEquipe || convite.email}</p>
                    {conviteAceito ? (
                      <p className="mt-1 text-xs font-semibold text-slate-300">Cadastro concluído; a entrada no campeonato ainda precisa da sua aprovação.</p>
                    ) : null}
                  </div>
                  <span className="truncate text-slate-300">{convite.liga?.nome || 'Campeonato'}</span>
                  {conviteAceito ? (
                    <button
                      type="button"
                      onClick={() => openInscricoes(convite.liga?.id)}
                      className="creator-approve-btn w-fit rounded-full px-4 py-2 text-xs font-black"
                    >
                      Revisar inscrição
                    </button>
                  ) : (
                    <span className="w-fit rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-luva-amber">
                      {convite.status.replace(/_/g, ' ')}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section id="inscricoes-equipes" className="mx-auto max-w-7xl scroll-mt-28 px-4 pb-12">
        <div className="creator-management-card rounded-[1.75rem] border p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="luva-kicker">Inscrições de equipes</p>
              <h2 className="mt-2 font-display text-3xl font-black text-white">Aprovar equipes</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-200">Revise as solicitações. Equipes aprovadas ficam disponíveis imediatamente na estrutura e no sorteio do campeonato.</p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-slate-100">{inscricoes.length} inscrição(ões)</span>
          </div>

          <div className="mt-6 grid gap-3 rounded-2xl border border-white/10 bg-[#07111f]/70 p-4 lg:grid-cols-[minmax(220px,1fr)_auto] lg:items-end">
            <label className="grid gap-2 text-xs font-black uppercase tracking-[0.12em] text-slate-300">
              Campeonato
              <select value={inscricaoLigaFilter} onChange={(event) => setInscricaoLigaFilter(event.target.value)} className="rounded-xl border border-white/15 bg-[#101d30] px-4 py-3 text-sm font-bold normal-case tracking-normal text-white outline-none focus:border-luva-amber">
                <option value="all">Todos os campeonatos</option>
                {ligas.map((liga) => <option key={liga.id} value={liga.id}>{liga.nome}</option>)}
              </select>
            </label>
            <div className="flex flex-wrap gap-2" aria-label="Filtrar inscrições por status">
              {[
                ['SOLICITADA', `Pendentes (${inscricoesPendentes.length})`],
                ['APROVADA', 'Aprovadas'],
                ['REJEITADA', 'Rejeitadas'],
                ['TODAS', 'Todas'],
              ].map(([status, label]) => (
                <button key={status} type="button" onClick={() => setInscricaoStatusFilter(status)} className={`creator-status-filter ${inscricaoStatusFilter === status ? 'is-active' : ''}`} aria-pressed={inscricaoStatusFilter === status}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 grid gap-3">
            {inscricoesFiltradas.length === 0 ? (
              <div className="creator-empty-mini rounded-2xl border p-5">
                <p className="font-black text-white">Nenhuma inscrição encontrada neste filtro.</p>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-200">Novas solicitações aparecerão em Pendentes para sua revisão.</p>
              </div>
            ) : inscricoesFiltradas.map((inscricao) => (
              <article key={inscricao.id} className="creator-registration-card rounded-2xl border p-4">
                <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-xl font-black text-white">{inscricao.equipe?.nome ?? 'Equipe sem nome'}</h3>
                      <span className="rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-luva-amber">{inscricao.status}</span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-slate-200">{inscricao.liga?.nome ?? 'Campeonato'} · {inscricao.equipe?.categoria ?? 'Categoria'} · {inscricao.equipe?.serie ?? 'Série'}</p>
                    <div className="mt-4 rounded-xl border border-white/10 bg-[#07111f] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-black text-white">
                          Elenco atual: {inscricao.equipe?.quantidadeJogadores ?? 0} atleta(s)
                        </p>
                        {inscricao.equipe?.elencoAtualizadoEm ? (
                          <time className="text-xs font-bold text-slate-400" dateTime={inscricao.equipe.elencoAtualizadoEm}>
                            Atualizado em {new Date(inscricao.equipe.elencoAtualizadoEm).toLocaleString('pt-BR')}
                          </time>
                        ) : null}
                      </div>
                      {inscricao.equipe?.jogadores?.some((jogador) => jogador.status !== 'INATIVO') ? (
                        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                          {inscricao.equipe.jogadores
                            .filter((jogador) => jogador.status !== 'INATIVO')
                            .map((jogador) => (
                              <li key={jogador.id} className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                                <span className="min-w-8 text-luva-amber">
                                  {jogador.numero ? `#${jogador.numero}` : 'S/N'}
                                </span>
                                <span>{jogador.nome}</span>
                                {jogador.posicao ? <span className="text-xs text-slate-400">· {jogador.posicao}</span> : null}
                              </li>
                            ))}
                        </ul>
                      ) : (
                        <p className="mt-3 text-sm font-semibold text-slate-400">Nenhum atleta ativo cadastrado.</p>
                      )}
                    </div>
                  </div>
                  {inscricao.status === 'SOLICITADA' ? (
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button onClick={() => updateInscricao(inscricao.id, 'APROVADA')} className="creator-approve-btn rounded-full px-4 py-2 text-sm font-black">Aprovar equipe</button>
                      <button onClick={() => updateInscricao(inscricao.id, 'REJEITADA')} className="creator-reject-btn rounded-full border px-4 py-2 text-sm font-black">Rejeitar</button>
                    </div>
                  ) : (
                    <p className="text-sm font-bold text-slate-300">Decisão registrada</p>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 pb-12 lg:grid-cols-2">
        <div className="creator-management-card rounded-[1.75rem] border p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="luva-kicker">Quadro de arbitragem</p>
              <h2 className="mt-2 font-display text-3xl font-black text-white">Árbitros disponíveis</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-200">
                Aprove ou remova árbitros da biblioteca usada para escalar partidas dos seus campeonatos.
              </p>
            </div>
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-slate-100">
              <Gavel size={14} />
              {arbitrosBiblioteca.length} árbitro(s)
            </span>
          </div>

          <div className="mt-6 grid gap-3">
            {arbitrosBiblioteca.length === 0 ? (
              <div className="creator-empty-mini rounded-2xl border p-5">
                <p className="font-black text-white">Nenhum árbitro cadastrado ainda.</p>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-200">Quando árbitros se cadastrarem, a gestão aparecerá aqui.</p>
              </div>
            ) : arbitrosBiblioteca.map((arbitro) => (
              <article key={arbitro.id} className="creator-registration-card rounded-2xl border p-4">
                <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-xl font-black text-white">{arbitro.nome}</h3>
                      <span className="rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-luva-amber">{formatLigaStatusLabel(arbitro.status)}</span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-slate-200">{arbitro.email || 'E-mail não informado'} · {arbitro.telefone || 'Telefone não informado'}</p>
                    {arbitro.cref && <p className="mt-1 text-xs font-bold text-slate-300">Registro: {arbitro.cref}</p>}
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button type="button" onClick={() => updateBiblioteca('arbitros', arbitro.id, 'APROVAR')} className="creator-approve-btn rounded-full px-4 py-2 text-sm font-black">Aprovar</button>
                    <button type="button" onClick={() => updateBiblioteca('arbitros', arbitro.id, 'REMOVER')} className="creator-reject-btn inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-black">
                      <Trash2 size={15} />
                      Remover
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="creator-management-card rounded-[1.75rem] border p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="luva-kicker">Biblioteca de quadras</p>
              <h2 className="mt-2 font-display text-3xl font-black text-white">Quadras parceiras</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-200">
                Aprove quadras e revise fotos, endereço e estrutura antes de vincular aos campeonatos.
              </p>
            </div>
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-slate-100">
              <MapPinned size={14} />
              {quadrasBiblioteca.length} quadra(s)
            </span>
          </div>

          <div className="mt-6 grid gap-3">
            {quadrasBiblioteca.length === 0 ? (
              <div className="creator-empty-mini rounded-2xl border p-5">
                <p className="font-black text-white">Nenhuma quadra cadastrada ainda.</p>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-200">Fornecedores aprovados ficarão disponíveis para seleção de partidas.</p>
              </div>
            ) : quadrasBiblioteca.map((quadra) => {
              const photos = parsePhotoUrls(quadra.fotosUrls)
              return (
                <article key={quadra.id} className="creator-registration-card rounded-2xl border p-4">
                  <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-xl font-black text-white">{quadra.nome}</h3>
                        <span className="rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-luva-amber">{formatLigaStatusLabel(quadra.status)}</span>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-slate-200">{quadra.endereco || 'Endereço não informado'} · {quadra.bairro || 'Bairro não informado'}</p>
                      <p className="mt-1 text-xs font-bold text-slate-300">{quadra.responsavel || 'Responsável não informado'} · {quadra.telefone || 'Telefone não informado'}</p>
                      {photos.length > 0 && (
                        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                          {photos.slice(0, 4).map((photo, index) => (
                            <a key={photo} href={photo} target="_blank" rel="noreferrer" className="block h-16 w-20 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/5">
                              <img src={photo} alt={`Foto da quadra ${index + 1}`} className="h-full w-full object-cover" />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button type="button" onClick={() => updateBiblioteca('quadras', quadra.id, 'APROVAR')} className="creator-approve-btn rounded-full px-4 py-2 text-sm font-black">Aprovar</button>
                      <button type="button" onClick={() => updateBiblioteca('quadras', quadra.id, 'REMOVER')} className="creator-reject-btn inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-black">
                        <Trash2 size={15} />
                        Remover
                      </button>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      </section>
      </>
      )}

      {ligaModalOpen && (
        <div className="creator-modal-backdrop" role="dialog" aria-modal="true" aria-label={editingLiga ? 'Editar campeonato' : 'Criar campeonato'}>
          <form onSubmit={editingLiga ? saveLiga : createLiga} className="creator-modal">
            <div className="creator-modal-head">
              <div>
                <p className="luva-kicker">{editingLiga ? 'Editar campeonato' : 'Novo campeonato'}</p>
                <h2 className="mt-2 font-display text-4xl font-black text-white md:text-5xl">{editingLiga ? 'Editar competição' : 'Adicionar competição'}</h2>
                <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-200">Defina o formato, inscrições e categorias do campeonato.</p>
                {ligaJaIniciada && (
                  <p className="mt-3 max-w-2xl rounded-2xl border border-luva-amber/40 bg-luva-amber/10 px-4 py-3 text-xs font-black uppercase tracking-[0.08em] text-luva-amber">
                    Campeonato já em andamento — apenas data de término e regra de pontuação podem ser alteradas.
                  </p>
                )}
              </div>
              <button type="button" onClick={cancelEditingLiga} className="creator-modal-close" aria-label="Fechar formulário">×</button>
            </div>

            <div className="creator-modal-grid mt-7">
              <div className="grid gap-4">
                <fieldset disabled={ligaJaIniciada} className="contents">
                <label className="grid gap-2">
                  <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-200">Nome do campeonato</span>
                  <input value={form.nome} onChange={(event) => setForm((current) => ({ ...current, nome: event.target.value }))} required placeholder="Ex: Copa LUV Verão" className="creator-input rounded-2xl border px-4 py-3 font-bold" />
                </label>
                <label className="grid gap-2">
                  <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-200">Subtítulo</span>
                  <input value={form.subtitulo} onChange={(event) => setForm((current) => ({ ...current, subtitulo: event.target.value }))} placeholder="Ex: Temporada 2026" className="creator-input rounded-2xl border px-4 py-3 font-bold" />
                </label>
                <label className="grid gap-2">
                  <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-200">Descrição pública</span>
                  <textarea value={form.descricao} onChange={(event) => setForm((current) => ({ ...current, descricao: event.target.value }))} placeholder="Resumo que aparecerá no portal do campeonato." className="creator-input min-h-28 rounded-2xl border px-4 py-3 font-bold" />
                </label>
                </fieldset>
                <div className="creator-modal-section rounded-2xl border p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-200">Partidas</p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-2">
                      <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-200">Sets por partida</span>
                      <input
                        type="number"
                        min={1}
                        max={5}
                        value={form.setsPorPartida}
                        onChange={(event) => setForm((current) => ({ ...current, setsPorPartida: event.target.value }))}
                        className="creator-input rounded-2xl border px-4 py-3 font-bold"
                      />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-200">Pontos por set</span>
                      <input
                        type="number"
                        min={11}
                        max={35}
                        value={form.pontosPorSet}
                        onChange={(event) => setForm((current) => ({ ...current, pontosPorSet: event.target.value }))}
                        className="creator-input rounded-2xl border px-4 py-3 font-bold"
                      />
                    </label>
                  </div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-2">
                      <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-200">Data de término</span>
                      <input
                        type="date"
                        value={form.dataFim}
                        onChange={(event) => setForm((current) => ({ ...current, dataFim: event.target.value }))}
                        className="creator-input rounded-2xl border px-4 py-3 font-bold"
                      />
                    </label>
                    <div className="grid gap-2">
                      <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-200">Último set</span>
                      <div className="creator-registration-toggle">
                        <button type="button" onClick={() => setForm((current) => ({ ...current, tieBreakUltimoSet: true }))} className={form.tieBreakUltimoSet ? 'is-selected' : ''}>
                          <span className="creator-registration-icon"><Zap size={18} /></span>
                          <strong>Tie break</strong>
                          <span>Set decisivo com pontuação própria.</span>
                        </button>
                        <button type="button" onClick={() => setForm((current) => ({ ...current, tieBreakUltimoSet: false }))} className={!form.tieBreakUltimoSet ? 'is-selected' : ''}>
                          <span className="creator-registration-icon"><Equal size={18} /></span>
                          <strong>Padrão</strong>
                          <span>Mesma pontuação dos demais sets.</span>
                        </button>
                      </div>
                    </div>
                  </div>
                  {form.tieBreakUltimoSet && (
                    <label className="mt-4 grid gap-2">
                      <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-200">Pontos do set decisivo</span>
                      <input
                        type="number"
                        min={1}
                        max={35}
                        value={form.pontosUltimoSet}
                        onChange={(event) => setForm((current) => ({ ...current, pontosUltimoSet: event.target.value }))}
                        className="creator-input rounded-2xl border px-4 py-3 font-bold"
                      />
                    </label>
                  )}
                </div>
                <fieldset disabled={ligaJaIniciada} className="contents">

                <div className="creator-modal-section rounded-2xl border p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-200">Grupos</p>
                  <label className="mt-4 grid gap-2">
                    <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-200">Quantidade de grupos</span>
                    <input
                      type="number"
                      min={1}
                      max={32}
                      value={form.quantidadeGrupos}
                      onChange={(event) => updateQuantidadeGrupos(event.target.value)}
                      className="creator-input rounded-2xl border px-4 py-3 font-bold"
                    />
                  </label>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {normalizeGroupNames(form.nomesGrupos, Number(form.quantidadeGrupos || 1)).map((grupo, index) => (
                      <label key={index} className="grid gap-2">
                        <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-200">Nome do grupo {index + 1}</span>
                        <input
                          value={grupo}
                          onChange={(event) => updateNomeGrupo(index, event.target.value)}
                          className="creator-input rounded-2xl border px-4 py-3 font-bold"
                        />
                      </label>
                    ))}
                  </div>
                </div>

                <div className="creator-modal-section rounded-2xl border p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-200">Classificação</p>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {classificacaoCriteriaOptions.map((option) => {
                      const selected = form.criteriosClassificacao.includes(option.key)
                      return (
                        <button
                          key={option.key}
                          type="button"
                          onClick={() => toggleCriterioClassificacao(option.key)}
                          className={`creator-category-option ${selected ? 'is-selected' : ''}`}
                        >
                          {option.label}
                        </button>
                      )
                    })}
                  </div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-2">
                      <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-200">Classificados por grupo</span>
                      <input
                        type="number"
                        min={1}
                        max={16}
                        value={form.classificadosPorGrupo}
                        onChange={(event) => setForm((current) => ({ ...current, classificadosPorGrupo: event.target.value }))}
                        className="creator-input rounded-2xl border px-4 py-3 font-bold"
                      />
                    </label>
                    {form.formato === 'PONTOS_CORRIDOS' && (
                      <label className="grid gap-2">
                        <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-200">Rebaixados</span>
                        <input
                          type="number"
                          min={0}
                          max={16}
                          value={form.rebaixados}
                          onChange={(event) => setForm((current) => ({ ...current, rebaixados: event.target.value }))}
                          className="creator-input rounded-2xl border px-4 py-3 font-bold"
                        />
                      </label>
                    )}
                  </div>
                </div>

                <div className="creator-modal-section rounded-2xl border p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-200">Pódio e destaques</p>
                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    {podioOptions.map((option) => {
                      const selected = form.podioDestaques.includes(option.key)
                      return (
                        <button
                          key={option.key}
                          type="button"
                          onClick={() => togglePodioDestaque(option.key)}
                          className={`creator-category-option ${selected ? 'is-selected' : ''}`}
                        >
                          {option.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <label className="grid gap-2">
                  <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-200">Regulamento</span>
                  <textarea value={form.regulamento} onChange={(event) => setForm((current) => ({ ...current, regulamento: event.target.value }))} placeholder="Regras principais, critérios de desempate e orientações do campeonato." className="creator-input min-h-24 rounded-2xl border px-4 py-3 font-bold" />
                </label>
                <label className="grid gap-2">
                  <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-200">Premiação</span>
                  <textarea value={form.premiacao} onChange={(event) => setForm((current) => ({ ...current, premiacao: event.target.value }))} placeholder="Troféus, medalhas, destaques individuais ou premiação em dinheiro." className="creator-input min-h-24 rounded-2xl border px-4 py-3 font-bold" />
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-200">Quantidade de equipes</span>
                    <input type="number" min={2} max={64} value={form.quantidadeEquipes} onChange={(event) => setForm((current) => ({ ...current, quantidadeEquipes: event.target.value }))} required className="creator-input rounded-2xl border px-4 py-3 font-bold" />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-200">Formato</span>
                    <select value={form.formato} onChange={(event) => setForm((current) => ({ ...current, formato: event.target.value, faseEliminatoria: event.target.value === 'PONTOS_CORRIDOS' ? 'NENHUMA' : current.faseEliminatoria === 'NENHUMA' ? 'SEMIFINAL' : current.faseEliminatoria }))} className="creator-input rounded-2xl border px-4 py-3 font-bold">
                      <option value="PONTOS_CORRIDOS">Pontos corridos</option>
                      <option value="GRUPOS_MATA_MATA">Grupos + mata-mata</option>
                      <option value="MATA_MATA">Mata-mata</option>
                    </select>
                  </label>
                </div>
                {form.formato !== 'PONTOS_CORRIDOS' && (
                  <div className="creator-modal-section rounded-2xl border p-4">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-200">Fase eliminatória</p>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      {eliminatoryPhaseOptions.map((option) => {
                        const selected = form.faseEliminatoria === option.key
                        const required = getRequiredEliminatoryTeams(option.key)
                        return (
                          <button
                            key={option.key}
                            type="button"
                            onClick={() => setForm((current) => ({ ...current, faseEliminatoria: option.key }))}
                            className={`creator-category-option ${selected ? 'is-selected' : ''}`}
                          >
                            {option.label}
                            <span>{required} classificados</span>
                          </button>
                        )
                      })}
                    </div>
                    <p className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-bold leading-5 text-slate-200">
                      {formatEliminatoryPhase(form.faseEliminatoria)} exige {getRequiredEliminatoryTeams(form.faseEliminatoria)} equipe(s) classificadas. Se o automático dos grupos não completar, a tabela libera classificação manual antes do chaveamento.
                    </p>
                  </div>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-200">Data de início</span>
                    <input
                      type="date"
                      value={form.dataInicio}
                      onChange={(event) => setForm((current) => ({ ...current, dataInicio: event.target.value }))}
                      className="creator-input rounded-2xl border px-4 py-3 font-bold"
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-200">Prazo para alterar elenco</span>
                    <input
                      type="number"
                      min={0}
                      max={365}
                      value={form.prazoAlteracaoElencoDias}
                      onChange={(event) => setForm((current) => ({ ...current, prazoAlteracaoElencoDias: event.target.value }))}
                      className="creator-input rounded-2xl border px-4 py-3 font-bold"
                    />
                  </label>
                </div>
                <p className="text-xs font-bold leading-6 text-slate-300">
                  Equipes poderão incluir ou remover atletas até essa quantidade de dias após o início do campeonato.
                </p>
                <label className="grid gap-2">
                  <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-200">Status inicial</span>
                  <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))} className="creator-input rounded-2xl border px-4 py-3 font-bold">
                    <option value="EM_BREVE">Em breve</option>
                    <option value="ATIVA">Ativa</option>
                  </select>
                </label>
                </fieldset>
              </div>

              <aside className="grid gap-4">
                <div className="creator-link-preview rounded-2xl border p-4">
                  <strong>Prévia de Link: {publicLinkPreview}</strong>
                </div>

                <fieldset disabled={ligaJaIniciada} className="contents">
                <div className="creator-modal-section rounded-2xl border p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-200">Inscrições</p>
	                  <div className="creator-registration-toggle mt-3">
	                    <button type="button" onClick={() => setForm((current) => ({ ...current, inscricoesAbertas: true }))} className={form.inscricoesAbertas ? 'is-selected' : ''}>
                        <span className="creator-registration-icon"><Unlock size={18} /></span>
	                      <strong>Abrir agora</strong>
	                      <span>Equipes podem solicitar vaga.</span>
	                    </button>
	                    <button type="button" onClick={() => setForm((current) => ({ ...current, inscricoesAbertas: false }))} className={!form.inscricoesAbertas ? 'is-selected' : ''}>
                        <span className="creator-registration-icon"><LockKeyhole size={18} /></span>
	                      <strong>Manter fechadas</strong>
	                      <span>Você libera quando quiser.</span>
                    </button>
                  </div>
                </div>

                <div className="creator-modal-section rounded-2xl border p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-200">Categorias</p>
                  <div className="mt-4 space-y-4">
                    {categoriaSerieGroups.map((group) => (
                      <section key={group.title} className="creator-category-group">
                        <div className="creator-category-group-title">
                          <span>{group.title}</span>
                          <small>{group.options.length} opções</small>
                        </div>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          {group.options.map((option) => {
                            const checked = form.categoriasConfig.includes(option.key)
                            return (
                              <button
                                key={option.key}
                                type="button"
                                onClick={() => toggleCategoriaSerie(option.key)}
                                className={`creator-category-option ${checked ? 'is-selected' : ''}`}
                              >
                                {option.label}
                              </button>
                            )
                          })}
                        </div>
                      </section>
                    ))}
                  </div>
                </div>
                </fieldset>
              </aside>
            </div>

            <div className="creator-modal-actions">
              <button type="button" onClick={cancelEditingLiga} className="creator-reject-btn inline-flex items-center justify-center rounded-full border px-5 py-3 text-sm font-black">
                Cancelar
              </button>
              <button disabled={saving} className="public-primary-action inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-black transition disabled:opacity-70">
                <CalendarPlus size={18} />
                {saving ? 'Salvando...' : editingLiga ? 'Salvar campeonato' : 'Criar campeonato'}
              </button>
            </div>
            {feedback && <p className="creator-feedback mt-4 rounded-2xl border px-4 py-3 text-sm font-bold">{feedback}</p>}
          </form>
        </div>
      )}
    </main>
  )
}

function CreatorStat({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) {
  return (
    <div className="creator-stat-card rounded-[1.25rem] border p-4">
      <Icon size={22} />
      <p className="mt-3 text-3xl font-black text-white">{value}</p>
      <p className="mt-1 text-xs font-black uppercase tracking-[0.14em] text-slate-200">{label}</p>
    </div>
  )
}

function ManualScoreInput({ label, value, onChange, hideLabel = false }: { label: string; value: string; onChange: (value: string) => void; hideLabel?: boolean }) {
  return (
    <label className="grid gap-1">
      <span className={`${hideLabel ? 'sr-only' : ''} text-[10px] font-black uppercase tracking-[0.12em] text-slate-300`}>{label}</span>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="creator-input rounded-2xl border px-3 py-3 text-center font-black"
      />
    </label>
  )
}

function toDateInputValue(value?: string | null) {
  // Projetar em UTC (toISOString) em vez do fuso de São Paulo empurra a data
  // +1 dia sempre que o horário salvo cai entre 21h e 23h59 local — é
  // exatamente o caso de dataFim, gravada como "T23:59:59" horário local
  // (ver saveLiga/createLiga abaixo). Cada ciclo editar-salvar avançava a
  // data final em um dia. isoToDateInput usa o fuso correto.
  return isoToDateInput(value)
}

function formatPainelDate(value?: string | null) {
  if (!value) return 'Data a definir'
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value))
  } catch {
    return value
  }
}


const DEFAULT_CATEGORIA_SERIE = 'MASCULINO:LIVRE'

const categoriaSerieGroups = [
  {
    title: 'Masculino',
    options: [
      { key: 'MASCULINO:LIVRE', label: 'Masculino Livre' },
      { key: 'MASCULINO:INICIANTE', label: 'Masculino Iniciante' },
      { key: 'MASCULINO:MASTER_40', label: 'Masculino Master (40+)' },
    ],
  },
  {
    title: 'Feminino',
    options: [
      { key: 'FEMININO:ADULTO_LIVRE', label: 'Feminino Adulto Livre' },
      { key: 'FEMININO:MASTER_E_30', label: 'Feminino Master E (30+)' },
      { key: 'FEMININO:MASTER_E1_30', label: 'Feminino Master E1 (30+)' },
      { key: 'FEMININO:E2_LIVRE', label: 'Feminino E2 Livre' },
    ],
  },
  {
    title: 'Misto',
    options: [
      { key: 'MISTO:AVANCADO', label: 'Misto Avançado' },
      { key: 'MISTO:INTERMEDIARIO', label: 'Misto Intermediário' },
      { key: 'MISTO:INICIANTE', label: 'Misto Iniciante' },
      { key: 'SUB14:MISTO', label: 'Sub14 Misto' },
    ],
  },
  {
    title: 'Categorias de base',
    options: [
      { key: 'SUB13:FEMININO', label: 'Sub13 Feminino' },
      { key: 'SUB15:FEMININO', label: 'Sub15 Feminino' },
      { key: 'SUB17:FEMININO', label: 'Sub17 Feminino' },
      { key: 'SUB15:MASCULINO', label: 'Sub15 Masculino' },
      { key: 'SUB17:MASCULINO', label: 'Sub17 Masculino' },
    ],
  },
]

const categoriaSerieOptions = categoriaSerieGroups.flatMap((group) => group.options)

function defaultLigaForm() {
  return {
    nome: '',
    subtitulo: '',
    descricao: '',
    regulamento: '',
    premiacao: '',
    dataInicio: '',
    dataFim: '',
    prazoAlteracaoElencoDias: '7',
    quantidadeEquipes: '8',
    formato: 'PONTOS_CORRIDOS',
    status: 'EM_BREVE',
    inscricoesAbertas: true,
    categoriasConfig: [DEFAULT_CATEGORIA_SERIE],
    setsPorPartida: '3',
    pontosPorSet: '21',
    tieBreakUltimoSet: false,
    pontosUltimoSet: '15',
    quantidadeGrupos: '1',
    nomesGrupos: ['Grupo A'],
    criteriosClassificacao: ['PONTOS', 'VITORIAS', 'SALDO_SETS', 'SALDO_PONTOS'],
    faseEliminatoria: 'SEMIFINAL',
    classificadosPorGrupo: '2',
    rebaixados: '0',
    podioDestaques: ['1', '2', '3'],
  }
}

const classificacaoCriteriaOptions = [
  { key: 'PONTOS', label: 'Pontos' },
  { key: 'VITORIAS', label: 'Vitórias' },
  { key: 'SALDO_SETS', label: 'Saldo de sets' },
  { key: 'SALDO_PONTOS', label: 'Saldo de pontos' },
  { key: 'CONFRONTO_DIRETO', label: 'Confronto direto' },
]

const eliminatoryPhaseOptions = [
  { key: 'FINAL', label: 'Final' },
  { key: 'SEMIFINAL', label: 'Semifinal' },
  { key: 'QUARTAS', label: 'Quartas de final' },
  { key: 'OITAVAS', label: 'Oitavas de final' },
]

const podioOptions = [
  { key: '1', label: 'Campeão' },
  { key: '2', label: 'Vice-campeão' },
  { key: '3', label: '3º lugar' },
  { key: '4', label: '4º lugar' },
  { key: 'MVP', label: 'MVP' },
  { key: 'ATAQUE', label: 'Melhor ataque' },
  { key: 'DEFESA', label: 'Melhor defesa' },
]

function parseStringArray(value: unknown, fallback: string[]) {
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) return value
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) return parsed
    } catch {
      // Mantém compatibilidade com valores antigos separados por vírgula.
    }
    if (value.trim()) return value.split(',').map((item) => item.trim()).filter(Boolean)
  }
  return fallback
}

function normalizeGroupNames(value: unknown, amount: number) {
  const safeAmount = Math.max(1, Math.min(32, Number(amount || 1)))
  const current = parseStringArray(value, [])
  return Array.from({ length: safeAmount }, (_, index) => current[index]?.trim() || `Grupo ${String.fromCharCode(65 + index)}`)
}

function parsePhotoUrls(value: unknown) {
  return parseStringArray(value, [])
}

function parseCategoriasConfig(value?: string | null) {
  if (!value) return [DEFAULT_CATEGORIA_SERIE]
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) return parsed
  } catch {
    return [DEFAULT_CATEGORIA_SERIE]
  }
  return [DEFAULT_CATEGORIA_SERIE]
}

function formatCategoriaSerie(value: string) {
  const option = categoriaSerieOptions.find((item) => item.key === value)
  if (option) return option.label

  const [categoria, serie] = value.split(':')
  const labels: Record<string, string> = {
    MASCULINO: 'Masculino',
    FEMININO: 'Feminino',
    MISTO: 'Misto',
    SUB13: 'Sub13',
    SUB14: 'Sub14',
    SUB15: 'Sub15',
    SUB17: 'Sub17',
    OURO: 'Ouro',
    PRATA: 'Prata',
    LIVRE: 'Livre',
    INICIANTE: 'Iniciante',
    INTERMEDIARIO: 'Intermediário',
    AVANCADO: 'Avançado',
    ADULTO_LIVRE: 'Adulto Livre',
    MASTER_40: 'Master (40+)',
    MASTER_E_30: 'Master E (30+)',
    MASTER_E1_30: 'Master E1 (30+)',
    E2_LIVRE: 'E2 Livre',
  }
  return `${labels[categoria] ?? categoria} ${labels[serie] ?? serie}`
}

function PanelCard({
  icon: Icon,
  title,
  text,
  status,
  editLabel,
  onEdit,
}: PanelCardData & { onEdit?: () => void }) {
  return (
    <article className="public-panel public-card rounded-[1.5rem] border p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="public-card-icon flex h-11 w-11 items-center justify-center rounded-2xl">
          <Icon size={22} />
        </span>
        <span className="public-card-status rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em]">{status}</span>
      </div>
      <h2 className="mt-5 font-display text-xl font-black text-white">{title}</h2>
      <p className="mt-2 text-sm font-semibold leading-6 text-slate-200">{text}</p>
      {onEdit && (
        <button type="button" onClick={onEdit} className="candidate-card-edit mt-5 inline-flex items-center justify-center rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.12em] transition">
          {editLabel || 'Editar'}
        </button>
      )}
    </article>
  )
}

function isReleasedStatus(status?: string | null) {
  return ['APROVADA', 'APROVADO', 'ATIVA', 'ATIVO'].includes(String(status ?? '').trim().toUpperCase())
}

function normalizeCardForStatus(card: PanelCardData, released: boolean): PanelCardData {
  if (!released) return card
  const lockedStatuses = ['Pendente', 'Em análise', 'Em breve']
  return {
    ...card,
    status: lockedStatuses.includes(card.status) ? 'Liberado' : card.status,
  }
}
