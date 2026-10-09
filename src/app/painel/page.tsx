'use client'

import Link from 'next/link'
import { Suspense, useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarDays,
  CalendarPlus,
  ClipboardCheck,
  LogOut,
  MapPin,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'
import { CandidateEditForm, type CandidateEditSection } from '@/components/candidate/CandidateEditForm'
import { OrganizadorHome } from '@/components/painel/organizador/OrganizadorHome'
import { encerrarSessaoPublica, lerSessaoPublica } from '@/lib/sessao-publica'

type Session = {
  tipo: string
  perfil?: string
  nome?: string
  email?: string
  candidaturaId?: string | null
  status?: string
  trocarSenha?: boolean
}

type PanelCardData = {
  icon: LucideIcon
  title: string
  text: string
  status: string
  editSection?: CandidateEditSection
  editLabel?: string
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
      { icon: ClipboardCheck, title: 'Inscrições', text: 'Acompanhe as equipes inscritas em cada campeonato.', status: 'Liberado' },
      { icon: CalendarDays, title: 'Calendário', text: 'Rodadas, locais e horários organizados por competição.', status: 'Liberado' },
      { icon: ShieldCheck, title: 'Operação', text: 'Equipes, súmulas e resultados em um painel dedicado.', status: 'Liberado' },
    ],
    steps: ['Criar o campeonato', 'Enviar o link de inscrição para as equipes', 'Acompanhar as equipes inscritas', 'Operar calendário e súmulas'],
  },
}

export default function PainelPage() {
  const [session, setSession] = useState<Session | null>(null)
  const [sessaoPronta, setSessaoPronta] = useState(false)
  const [editSection, setEditSection] = useState<CandidateEditSection | null>(null)

  useEffect(() => {
    const stored = lerSessaoPublica() as Session | null
    if ((stored?.tipo === 'organizador' || stored?.tipo === 'arbitro') && stored.trocarSenha) {
      window.location.replace('/trocar-senha')
      return
    }
    setSession(stored)
    setSessaoPronta(true)
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
    void encerrarSessaoPublica()
  }

  if (!sessaoPronta) {
    return (
      <main className="luva-shell public-dashboard min-h-screen px-4 py-12">
        <p className="text-center text-sm font-semibold text-slate-300">Abrindo o painel...</p>
      </main>
    )
  }

  if (session?.tipo === 'publico') {
    return (
      <main className="luva-shell public-dashboard min-h-screen px-4 py-12">
        <section className="public-panel mx-auto max-w-3xl rounded-[2rem] border p-8 text-center">
          <p className="luva-kicker">Acompanhamento</p>
          <h1 className="type-page-title mt-3">Sua conta é só para visualizar</h1>
          <p className="type-lead mx-auto mt-3 max-w-xl">
            O público acompanha campeonatos, jogos e tabela. O gerenciamento do evento fica com o organizador.
          </p>
          <Link href="/portal" className="public-primary-action mt-6 inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-black transition">
            Ir para o portal
            <ArrowRight size={17} />
          </Link>
        </section>
      </main>
    )
  }

  if (session?.tipo === 'organizador') {
    return (
      <Suspense fallback={<main className="luva-shell public-dashboard min-h-screen px-4 py-12"><p className="text-center text-sm font-semibold text-slate-300">Abrindo o painel...</p></main>}>
        <OrganizadorHome session={session} />
      </Suspense>
    )
  }

  if (session?.tipo === 'equipe') {
    return (
      <main className="luva-shell public-dashboard min-h-screen px-4 py-12">
        <section className="public-panel mx-auto max-w-3xl rounded-[2rem] border p-8 text-center">
          <p className="luva-kicker">Painel da equipe</p>
          <h1 className="type-page-title mt-3">O painel da equipe fica em outra página</h1>
          <p className="type-lead mx-auto mt-3 max-w-xl">
            Elenco, dados da equipe e jogos ficam na área da equipe.
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
          <h1 className="type-page-title mt-3">Entre para acessar o painel</h1>
          <p className="type-lead mx-auto mt-3 max-w-xl">
            Use o e-mail e a senha do cadastro.
          </p>
          <Link href="/login" className="public-primary-action mt-6 inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-black transition">
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
              {session.tipo === 'arbitro' && released
                ? 'O organizador envia o link do jogo. Abra esse endereço, informe o código e a partida abre direto.'
                : content.description}
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
