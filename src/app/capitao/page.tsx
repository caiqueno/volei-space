'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowRight, CalendarDays, Camera, ChevronDown, ClipboardCheck, LogOut, MapPin, QrCode, Save, Trash2, Trophy, Upload, UsersRound } from 'lucide-react'
import { ActionBar, LoadingTrack } from '@/components/ui/action-bar'
import { CandidateEditForm, type CandidateEditSection } from '@/components/candidate/CandidateEditForm'
import { formatBytes, imageUploadRules, optimizeImageFile } from '@/lib/client-image-upload'
import { supabase } from '@/lib/supabase'

type Session = {
  tipo: string
  perfil?: string
  nome?: string
  email?: string
  candidaturaId?: string | null
  status?: string
}

type CardAction = {
  label: string
  section: CandidateEditSection
}

type JogadorElenco = {
  id: number
  nome: string
  numero?: number | null
  posicao?: string | null
  isLibero?: boolean
  banido?: boolean
  cpf?: string | null
  documentoTipo?: string | null
  documentoNumero?: string | null
  dataNascimento?: string | null
  telefone?: string | null
  telefoneEmergencia?: string | null
  fotoRostoUrl?: string | null
  documentosUrls?: string[]
  qrCodeToken?: string | null
}

type EquipeIdentidade = {
  id: number
  nome: string
  logoUrl?: string | null
  corHex?: string | null
  categoria?: string | null
  serie?: string | null
}

const emptyPlayerForm = {
  id: undefined as number | undefined,
  nome: '',
  numero: '',
  posicao: '',
  cpf: '',
  documentoTipo: 'CPF',
  documentoNumero: '',
  dataNascimento: '',
  telefone: '',
  telefoneEmergencia: '',
  fotoRostoUrl: '',
  documentosUrls: [] as string[],
}

const PLAYER_POSITIONS = [
  { value: 'LV', label: 'Levantador (LV)', description: 'Organiza as jogadas e distribui o ataque.' },
  { value: 'PT', label: 'Ponteiro (PT)', description: 'Atua na recepção, defesa e ataque pelas pontas.' },
  { value: 'OP', label: 'Oposto (OP)', description: 'Referência ofensiva, normalmente no lado oposto ao levantador.' },
  { value: 'CT', label: 'Central (CT)', description: 'Foco em bloqueio e ataques rápidos pelo meio.' },
  { value: 'LB', label: 'Líbero (LB)', description: 'Especialista em defesa e recepção.' },
] as const

const DOCUMENT_TYPES = [
  { value: 'CPF', label: 'CPF' },
  { value: 'CIN', label: 'CIN' },
  { value: 'CTPS', label: 'Carteira Profissional' },
  { value: 'RG', label: 'RG' },
  { value: 'PASSAPORTE', label: 'Passaporte' },
  { value: 'OUTRO', label: 'Outro' },
] as const

function getPositionLabel(value?: string | null) {
  return PLAYER_POSITIONS.find((item) => item.value === value)?.label ?? 'Atleta'
}

export default function CapitaoPage() {
  const [session, setSession] = useState<Session | null>(null)
  const [editSection, setEditSection] = useState<CandidateEditSection | null>(null)
  const [campeonatos, setCampeonatos] = useState<any[]>([])
  const [campeonatosLoading, setCampeonatosLoading] = useState(false)
  const [campeonatoMsg, setCampeonatoMsg] = useState('')
  const [jogadores, setJogadores] = useState<JogadorElenco[]>([])
  const [rosterLoading, setRosterLoading] = useState(false)
  const [rosterSaving, setRosterSaving] = useState(false)
  const [rosterMsg, setRosterMsg] = useState('')
  const [teamIdentity, setTeamIdentity] = useState<EquipeIdentidade | null>(null)
  const [teamForm, setTeamForm] = useState({ nome: '', logoUrl: '' })
  const [teamSaving, setTeamSaving] = useState(false)
  const [teamUploading, setTeamUploading] = useState(false)
  const [teamMsg, setTeamMsg] = useState('')
  const [playerForm, setPlayerForm] = useState(emptyPlayerForm)
  const [positionModalOpen, setPositionModalOpen] = useState(false)

  useEffect(() => {
    try {
      setSession(JSON.parse(window.localStorage.getItem('luva_session') ?? 'null'))
    } catch {
      setSession(null)
    }
  }, [])

  useEffect(() => {
    if (!session?.candidaturaId || session.tipo !== 'equipe') return
    refreshCandidatura(session.candidaturaId)
    fetchCampeonatos(session.candidaturaId)
    fetchElenco()
  }, [session?.candidaturaId, session?.tipo])

  async function refreshCandidatura(candidaturaId: string) {
    try {
      const res = await fetch(`/api/candidaturas/equipe/${encodeURIComponent(candidaturaId)}`, { cache: 'no-store' })
      const json = await res.json().catch(() => ({}))
      const candidatura = json.data?.candidatura
      if (!res.ok || !candidatura) return

      setSession((current) => {
        if (!current) return current
        const updated = {
          ...current,
          nome: candidatura.responsavel || candidatura.nome || current.nome,
          email: candidatura.email || current.email,
          status: candidatura.status || current.status,
        }
        window.localStorage.setItem('luva_session', JSON.stringify(updated))
        return updated
      })
    } catch {
      // Mantém a sessão local caso a atualização falhe.
    }
  }

  async function fetchCampeonatos(candidaturaId: string) {
    setCampeonatosLoading(true)
    const res = await fetch(`/api/inscricoes-campeonato?candidaturaId=${encodeURIComponent(candidaturaId)}`)
    const json = await res.json()
    setCampeonatos(json.data?.campeonatos ?? [])
    setCampeonatosLoading(false)
  }

  async function solicitarInscricao(ligaId: number) {
    if (!session?.candidaturaId) return
    setCampeonatoMsg('')
    const res = await fetch('/api/inscricoes-campeonato', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ candidaturaId: session.candidaturaId, ligaId }),
    })
    const json = await res.json()
    if (!res.ok) {
      setCampeonatoMsg(json.error ?? 'Não foi possível solicitar inscrição.')
      return
    }
    setCampeonatoMsg('Inscrição enviada para análise da organização.')
    fetchCampeonatos(session.candidaturaId)
  }

  async function fetchElenco() {
    setRosterLoading(true)
    setRosterMsg('')
    const res = await fetch('/api/capitao/jogadores', { cache: 'no-store' })
    const json = await res.json().catch(() => ({}))
    if (res.ok) {
      if (json.data?.equipe) {
        setTeamIdentity(json.data.equipe)
        setTeamForm({
          nome: json.data.equipe.nome ?? '',
          logoUrl: json.data.equipe.logoUrl ?? '',
        })
      }
      setJogadores(json.data?.jogadores ?? [])
    } else {
      setJogadores([])
      setRosterMsg(json.error ?? 'Elenco liberado apenas para equipes aprovadas e vinculadas.')
    }
    setRosterLoading(false)
  }

  async function saveTeamIdentity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setTeamMsg('')
    const nome = teamForm.nome.trim()
    if (nome.length < 2) {
      setTeamMsg('Informe o nome da equipe.')
      return
    }

    setTeamSaving(true)
    const res = await fetch('/api/capitao/equipe', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, logoUrl: teamForm.logoUrl || null }),
    })
    const json = await res.json().catch(() => ({}))
    setTeamSaving(false)

    if (!res.ok) {
      setTeamMsg(json.error ?? 'Nao foi possivel atualizar a equipe.')
      return
    }

    setTeamIdentity(json.data)
    setTeamForm({ nome: json.data.nome ?? nome, logoUrl: json.data.logoUrl ?? '' })
    setTeamMsg('Identidade da equipe atualizada.')
  }

  async function uploadTeamLogo(file: File | null) {
    if (!file) return
    setTeamMsg('')
    setTeamUploading(true)
    try {
      const optimized = await optimizeImageFile(file, 'logo-equipe')
      const safeName = optimized.file.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9.]+/g, '-')
      const path = `${session?.candidaturaId ?? 'equipe'}/identidade/${Date.now()}-${safeName}`
      const { error: uploadError } = await supabase.storage.from('equipe-emblemas').upload(path, optimized.file, {
        cacheControl: '3600',
        upsert: false,
        contentType: optimized.file.type || 'image/webp',
      })

      if (uploadError) {
        setTeamMsg('Nao foi possivel enviar a logo. Verifique o bucket equipe-emblemas no Supabase.')
        return
      }

      const { data } = supabase.storage.from('equipe-emblemas').getPublicUrl(path)
      if (data.publicUrl) {
        setTeamForm((current) => ({ ...current, logoUrl: data.publicUrl }))
        setTeamMsg(`Logo enviada (${formatBytes(optimized.file.size)}). Salve para aplicar na equipe.`)
      }
    } catch (err) {
      setTeamMsg(err instanceof Error ? err.message : 'Nao foi possivel processar a imagem.')
    } finally {
      setTeamUploading(false)
    }
  }

  async function savePlayer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setRosterMsg('')
    const numeroAtleta = playerForm.numero ? Number(playerForm.numero) : null
    if (numeroAtleta !== null) {
      const duplicatedNumber = jogadores.some((jogador) => {
        if (playerForm.id && jogador.id === playerForm.id) return false
        if (jogador.banido) return false
        return Number(jogador.numero) === numeroAtleta
      })
      if (duplicatedNumber) {
        setRosterMsg('Este número já está sendo utilizado por outro atleta desta equipe.')
        return
      }
    }
    setRosterSaving(true)
    const payload = {
      id: playerForm.id,
      nome: playerForm.nome,
      numero: numeroAtleta,
      posicao: playerForm.posicao || null,
      cpf: playerForm.cpf || null,
      documentoTipo: playerForm.documentoTipo || 'CPF',
      documentoNumero: playerForm.documentoNumero || playerForm.cpf || null,
      dataNascimento: playerForm.dataNascimento || null,
      telefone: playerForm.telefone || null,
      telefoneEmergencia: playerForm.telefoneEmergencia || null,
      fotoRostoUrl: playerForm.fotoRostoUrl || null,
      documentosUrls: playerForm.documentosUrls,
    }
    const res = await fetch('/api/capitao/jogadores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json().catch(() => ({}))
    setRosterSaving(false)
    if (!res.ok) {
      setRosterMsg(json.error ?? 'Não foi possível salvar atleta.')
      return
    }
    setRosterMsg(playerForm.id ? 'Atleta atualizado.' : 'Atleta cadastrado no elenco.')
    setPlayerForm(emptyPlayerForm)
    fetchElenco()
  }

  async function removePlayer(id: number) {
    if (!window.confirm('Remover este atleta do elenco?')) return
    const res = await fetch(`/api/capitao/jogadores?id=${id}`, { method: 'DELETE' })
    if (res.ok) {
      setRosterMsg('Atleta removido.')
      fetchElenco()
    }
  }

  function editPlayer(jogador: JogadorElenco) {
    setPlayerForm({
      id: jogador.id,
      nome: jogador.nome ?? '',
      numero: jogador.numero ? String(jogador.numero) : '',
      posicao: jogador.posicao ?? '',
      cpf: jogador.cpf ?? '',
      documentoTipo: jogador.documentoTipo ?? (jogador.cpf ? 'CPF' : 'CPF'),
      documentoNumero: jogador.documentoNumero ?? jogador.cpf ?? '',
      dataNascimento: jogador.dataNascimento ? String(jogador.dataNascimento).slice(0, 10) : '',
      telefone: jogador.telefone ?? '',
      telefoneEmergencia: jogador.telefoneEmergencia ?? '',
      fotoRostoUrl: jogador.fotoRostoUrl ?? '',
      documentosUrls: jogador.documentosUrls ?? [],
    })
  }

  async function uploadAtletaFiles(files: FileList | null, kind: 'foto' | 'documento') {
    if (!files?.length) return
    setRosterMsg('')
    const uploaded: string[] = []
    for (const file of Array.from(files).slice(0, kind === 'foto' ? 1 : 8)) {
      const max = kind === 'foto' ? 4 : 8
      if (file.size > max * 1024 * 1024) {
        setRosterMsg(`Arquivo acima de ${max} MB.`)
        return
      }
      const safeName = file.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9.]+/g, '-')
      const path = `${session?.candidaturaId ?? 'capitao'}/${kind}/${Date.now()}-${safeName}`
      const { error: uploadError } = await supabase.storage.from('atleta-arquivos').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      })
      if (uploadError) {
        setRosterMsg('Não foi possível enviar o arquivo. Verifique o bucket atleta-arquivos no Supabase.')
        return
      }
      const { data } = supabase.storage.from('atleta-arquivos').getPublicUrl(path)
      if (data.publicUrl) uploaded.push(data.publicUrl)
    }
    if (kind === 'foto' && uploaded[0]) setPlayerForm((current) => ({ ...current, fotoRostoUrl: uploaded[0] }))
    if (kind === 'documento') setPlayerForm((current) => ({ ...current, documentosUrls: [...current.documentosUrls, ...uploaded].slice(0, 8) }))
  }

  function logout() {
    window.localStorage.removeItem('luva_session')
    window.location.href = '/'
  }

  if (!session || session.tipo !== 'equipe') {
    return (
      <main className="luva-shell capitain-dashboard min-h-screen px-4 py-12">
        <section className="capitain-panel mx-auto max-w-3xl rounded-[2rem] border p-8 text-center">
          <p className="luva-kicker">Área da equipe</p>
          <h1 className="type-page-title mt-3">Entre com a conta da equipe</h1>
          <p className="type-lead mx-auto mt-3 max-w-xl">
            Use o e-mail e a senha do cadastro para ver o elenco e os dados da equipe.
          </p>
          <Link href="/cadastro?modo=cadastro" className="capitain-primary-action mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-luva-amber px-5 py-3 text-sm font-black text-slate-950 transition hover:-translate-y-0.5 hover:bg-amber-300">
            Criar cadastro
            <ArrowRight size={17} />
          </Link>
        </section>
      </main>
    )
  }

  const statusInfo = getCapitaoStatus(session.status)
  const approved = statusInfo.approved

  return (
    <main className="luva-shell capitain-dashboard min-h-screen overflow-hidden">
      <section className="capitain-hero orange-wave">
        <div className={`mx-auto grid max-w-7xl gap-8 px-4 py-12 lg:items-center ${approved ? 'lg:grid-cols-1' : 'lg:grid-cols-[1fr_380px]'}`}>
          <div className="motion-in">
            <p className="luva-kicker">Painel da equipe</p>
            <h1 className="type-page-title mt-3 max-w-3xl">
              Olá, {session.nome || 'equipe'}
            </h1>
            <p className="type-lead mt-4 max-w-2xl">
              {approved
                ? 'Sua equipe está no campeonato. Aqui você atualiza o elenco, os dados da equipe e acompanha os jogos.'
                : 'A organização ainda está conferindo o cadastro. Enquanto isso, você pode revisar os dados da equipe.'}
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link href="/" className="capitain-primary-action inline-flex items-center justify-center gap-2 rounded-full bg-luva-amber px-5 py-3 text-sm font-black text-slate-950 transition hover:-translate-y-0.5 hover:bg-amber-300">
                Ver página inicial
                <ArrowRight size={17} />
              </Link>
              <button onClick={logout} className="capitain-secondary-action inline-flex items-center justify-center gap-2 rounded-full border px-5 py-3 text-sm font-black transition hover:border-luva-amber/70">
                <LogOut size={17} />
                Sair
              </button>
            </div>
          </div>

          {!approved && <aside className="capitain-panel motion-in-delay rounded-[2rem] border p-5 backdrop-blur-2xl">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-luva-amber">Status da candidatura</p>
            <div className="capitain-status-box mt-4 rounded-2xl border p-4">
              <p className="font-display text-2xl font-black text-white">{statusInfo.label}</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-200">
                {statusInfo.description}
              </p>
            </div>
            {session.email && <p className="mt-4 truncate text-sm font-bold text-slate-200">{session.email}</p>}
          </aside>}
        </div>
      </section>

      {!approved && <section className="mx-auto grid max-w-7xl gap-4 px-4 py-10 md:grid-cols-2 xl:grid-cols-5">
        <PanelCard icon={<ClipboardCheck size={22} />} title="Cadastro" text={approved ? 'Cadastro da equipe concluído.' : 'Dados de contato enviados para análise.'} status={approved ? 'Ativa' : 'Pendente'} action={!approved ? { label: 'Editar contato', section: 'cadastro' } : undefined} onEdit={setEditSection} />
        <PanelCard icon={<MapPin size={22} />} title="Quadra" text={approved ? 'Estrutura registrada para operação da equipe.' : 'Endereço, piso e estrutura cedida pela equipe.'} status={approved ? 'Validada' : 'Pendente'} action={!approved ? { label: 'Editar quadra', section: 'quadra' } : undefined} onEdit={setEditSection} />
        <PanelCard icon={<UsersRound size={22} />} title="Elenco" text={approved ? 'Área liberada para cadastrar atletas, fotos e documentos.' : 'Área de atletas será liberada após aprovação.'} status={approved ? 'Liberado' : 'Em breve'} />
        <PanelCard icon={<QrCode size={22} />} title="QR Codes" text={approved ? 'Credenciais serão geradas a partir dos atletas cadastrados.' : 'Validação individual dos jogadores ficará aqui.'} status={approved ? 'Liberado' : 'Em breve'} />
        <PanelCard icon={<CalendarDays size={22} />} title="Agenda" text={approved ? 'Dias e períodos ficam disponíveis para organização de jogos.' : 'Dias e períodos disponíveis para jogos.'} status={approved ? 'Ativa' : 'Em breve'} action={!approved ? { label: 'Editar agenda', section: 'disponibilidade' } : undefined} onEdit={setEditSection} />
      </section>}

      {!approved && (
        <section className="mx-auto grid max-w-7xl gap-6 px-4 pb-12 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="luva-card rounded-[1.5rem] p-6">
            <p className="luva-kicker">Próximos passos</p>
            <h2 className="mt-3 font-display text-3xl font-black text-white">Preparação da equipe</h2>
            <div className="mt-5 space-y-3">
              {['Aguardar aprovação da organização', 'Cadastrar atletas e documentos', 'Gerar QR Codes de validação', 'Acompanhar calendário oficial'].map((item, index) => (
                <div key={item} className="capitain-step-item flex items-center gap-3 rounded-2xl border p-3">
                  <span className="capitain-step-number flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black">{index + 1}</span>
                  <p className="text-sm font-black text-slate-100">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="luva-card rounded-[1.5rem] p-6">
            <p className="luva-kicker">Operação</p>
            <h2 className="mt-3 font-display text-3xl font-black text-white">Módulos da equipe</h2>
            <p className="mt-3 text-sm font-semibold leading-7 text-slate-200">
              Esta área será conectada ao Supabase para editar a equipe, gerenciar atletas, acompanhar pagamentos, validar inscrições e visualizar jogos atribuídos à equipe.
            </p>
            <div className="capitain-note mt-5 rounded-2xl border p-4 text-sm font-bold leading-7">
              Você pode revisar os dados permitidos nos cards acima enquanto a candidatura estiver pendente.
            </div>
          </div>
        </section>
      )}

      {approved && (
        <section className="mx-auto max-w-7xl px-4 pb-12">
          <div className="luva-card rounded-[1.5rem] p-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="luva-kicker">Perfil da equipe</p>
                <h2 className="mt-3 font-display text-3xl font-black text-white">Identidade da equipe</h2>
                <p className="mt-3 max-w-3xl text-sm font-semibold leading-7 text-slate-200">
                  Atualize o nome e a logo que aparecem no portal, nos jogos, na tabela e nos cards públicos da competição.
                </p>
              </div>
              <span className="inline-flex w-fit items-center gap-2 rounded-2xl border border-luva-amber/35 bg-luva-amber/10 px-4 py-3 text-sm font-black text-luva-amber">
                <Upload size={17} />
                Dados públicos
              </span>
            </div>

            {teamMsg && <p className="mt-5 rounded-2xl border border-luva-amber/35 bg-luva-amber/10 px-4 py-3 text-sm font-bold text-white">{teamMsg}</p>}

            <form onSubmit={saveTeamIdentity} className="mt-6 grid gap-5 lg:grid-cols-[280px_1fr]">
              <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-5">
                <div className="mx-auto flex h-36 w-36 items-center justify-center overflow-hidden rounded-[1.25rem] border border-white/10 bg-white/[0.045]">
                  {teamForm.logoUrl ? (
                    <img src={teamForm.logoUrl} alt={teamForm.nome || 'Logo da equipe'} className="h-full w-full object-contain p-3" />
                  ) : (
                    <span className="font-display text-4xl font-black text-luva-amber">{(teamForm.nome || session.nome || 'EQ').slice(0, 2).toUpperCase()}</span>
                  )}
                </div>
                {teamUploading ? <LoadingTrack label="Enviando" className="mt-4 w-full rounded-2xl" /> : (
                <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-center text-sm font-black text-white transition hover:border-luva-amber/50">
                  <Camera size={18} className="text-luva-amber" />
                  Trocar logo
                  <input className="sr-only" type="file" accept={imageUploadRules.allowedTypes.join(',')} onChange={(event) => uploadTeamLogo(event.target.files?.[0] || null)} />
                </label>
                )}
                <p className="mt-3 text-center text-xs font-semibold leading-5 text-slate-300">
                  PNG, JPG ou WebP. A imagem será otimizada antes do envio.
                </p>
              </div>

              <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-5">
                <Input label="Nome da equipe" value={teamForm.nome} onChange={(value) => setTeamForm((current) => ({ ...current, nome: value }))} required />
                <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/30 px-4 py-3">
                  <span className="block text-[10px] font-black uppercase tracking-[0.16em] text-luva-amber">Logo</span>
                  <strong className="mt-1 block text-sm font-black text-white">{teamForm.logoUrl ? 'Imagem carregada' : 'Nenhuma imagem enviada'}</strong>
                  <p className="mt-1 text-xs font-semibold leading-5 text-slate-300">Use o botão “Trocar logo” para enviar uma imagem da equipe.</p>
                </div>
                {teamIdentity && (
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <InfoPill label="Categoria" value={teamIdentity.categoria || 'A definir'} />
                    <InfoPill label="Série" value={teamIdentity.serie || 'A definir'} />
                    <InfoPill label="ID" value={String(teamIdentity.id)} />
                  </div>
                )}
                <ActionBar disabled={teamUploading} loading={teamSaving} loadingLabel="Salvando" className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-luva-amber px-5 py-4 text-sm font-black text-slate-950 transition hover:bg-amber-300 disabled:opacity-60">
                  <Save size={18} />
                  Salvar identidade da equipe
                </ActionBar>
              </div>
            </form>
          </div>
        </section>
      )}

      <section id="elenco" className="mx-auto max-w-7xl px-4 pb-12">
        <div className="luva-card rounded-[1.5rem] p-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="luva-kicker">Elenco</p>
              <h2 className="type-section-title mt-2">Atletas, fotos e documentos</h2>
              <p className="type-lead mt-3 max-w-3xl">
                Mantenha nome, número, posição e foto de cada atleta. Esses dados aparecem na página da equipe e na súmula.
              </p>
            </div>
            <span className="inline-flex w-fit items-center gap-2 rounded-2xl border border-luva-amber/35 bg-luva-amber/10 px-4 py-3 text-sm font-black text-luva-amber">
              <UsersRound size={17} />
              {jogadores.length} atleta(s)
            </span>
          </div>

          {rosterMsg && <p className="mt-5 rounded-2xl border border-luva-amber/35 bg-luva-amber/10 px-4 py-3 text-sm font-bold text-white">{rosterMsg}</p>}

          {!approved ? (
            <div className="mt-6 rounded-[1.5rem] border border-luva-amber/35 bg-luva-amber/10 p-5">
              <p className="font-display text-2xl font-black text-white">Elenco aguardando aprovação.</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-200">
                A equipe precisa estar aprovada e vinculada antes de cadastrar atletas, fotos, documentos e QR Codes.
              </p>
            </div>
          ) : (
          <div className="mt-6 grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
            <form onSubmit={savePlayer} className="rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-display text-2xl font-black text-white">{playerForm.id ? 'Editar atleta' : 'Adicionar atleta'}</h3>
                <button type="button" onClick={() => setPlayerForm(emptyPlayerForm)} className="rounded-full border border-white/10 px-3 py-2 text-xs font-black text-slate-100">Limpar</button>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Input label="Nome completo" value={playerForm.nome} onChange={(value) => setPlayerForm((current) => ({ ...current, nome: value }))} required />
                <Input label="Número" value={playerForm.numero} onChange={(value) => setPlayerForm((current) => ({ ...current, numero: value }))} type="number" />
                <label className="grid gap-2">
                  <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-200">Posição</span>
                  <button
                    type="button"
                    onClick={() => setPositionModalOpen(true)}
                    className="flex min-h-[50px] items-center justify-between rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3 text-left font-bold text-white transition hover:border-luva-amber/60"
                  >
                    <span>{playerForm.posicao ? getPositionLabel(playerForm.posicao) : 'Selecionar posição'}</span>
                    <ChevronDown size={18} className="text-luva-amber" />
                  </button>
                </label>
                <label className="grid gap-2">
                  <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-200">Tipo de documento</span>
                  <select
                    value={playerForm.documentoTipo}
                    onChange={(event) => setPlayerForm((current) => ({ ...current, documentoTipo: event.target.value }))}
                    className="min-h-[50px] rounded-2xl border border-white/10 bg-[#07101d] px-4 py-3 font-bold text-white outline-none transition focus:border-luva-amber"
                  >
                    {DOCUMENT_TYPES.map((documentType) => (
                      <option key={documentType.value} value={documentType.value}>{documentType.label}</option>
                    ))}
                  </select>
                </label>
                <Input label="Documento" value={playerForm.documentoNumero} onChange={(value) => setPlayerForm((current) => ({ ...current, documentoNumero: value, cpf: current.documentoTipo === 'CPF' ? value : current.cpf }))} />
                <Input label="Nascimento" value={playerForm.dataNascimento} onChange={(value) => setPlayerForm((current) => ({ ...current, dataNascimento: value }))} type="date" />
                <Input label="Telefone" value={playerForm.telefone} onChange={(value) => setPlayerForm((current) => ({ ...current, telefone: value }))} />
                <Input label="Emergência" value={playerForm.telefoneEmergencia} onChange={(value) => setPlayerForm((current) => ({ ...current, telefoneEmergencia: value }))} />
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-center transition hover:border-luva-amber/50">
                  <Camera size={22} className="text-luva-amber" />
                  <span className="mt-2 text-sm font-black text-white">Foto do atleta</span>
                  <span className="mt-1 text-xs font-semibold text-slate-300">Imagem até 4 MB</span>
                  <input className="sr-only" type="file" accept="image/*" capture="environment" onChange={(event) => uploadAtletaFiles(event.target.files, 'foto')} />
                </label>
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-center transition hover:border-luva-amber/50">
                  <Upload size={22} className="text-luva-amber" />
                  <span className="mt-2 text-sm font-black text-white">Documentos</span>
                  <span className="mt-1 text-xs font-semibold text-slate-300">PDF ou imagem até 8 MB</span>
                  <input className="sr-only" type="file" accept="image/*,.pdf" multiple onChange={(event) => uploadAtletaFiles(event.target.files, 'documento')} />
                </label>
              </div>

              {(playerForm.fotoRostoUrl || playerForm.documentosUrls.length > 0) && (
                <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  {playerForm.fotoRostoUrl && <p className="text-xs font-bold text-slate-200">Foto enviada.</p>}
                  {playerForm.documentosUrls.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {playerForm.documentosUrls.map((url, index) => (
                        <button key={url} type="button" onClick={() => setPlayerForm((current) => ({ ...current, documentosUrls: current.documentosUrls.filter((item) => item !== url) }))} className="rounded-full border border-white/10 px-3 py-1 text-xs font-black text-slate-100">
                          Doc {index + 1} · remover
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <ActionBar loading={rosterSaving} loadingLabel="Salvando" className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-luva-amber px-5 py-4 text-sm font-black text-slate-950 transition hover:bg-amber-300 disabled:opacity-60">
                <Save size={18} />
                Salvar atleta
              </ActionBar>
            </form>

            <div className="grid gap-3">
              {rosterLoading ? (
                <p className="rounded-2xl border border-white/10 bg-white/[0.045] p-4 text-sm font-bold text-slate-200">Carregando elenco...</p>
              ) : jogadores.length === 0 ? (
                <p className="rounded-2xl border border-white/10 bg-white/[0.045] p-4 text-sm font-bold text-slate-200">Nenhum atleta cadastrado ainda.</p>
              ) : jogadores.map((jogador) => (
                <article key={jogador.id} className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.045] p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    {jogador.fotoRostoUrl ? (
                      <img src={jogador.fotoRostoUrl} alt={jogador.nome} className="h-14 w-14 rounded-2xl object-cover" />
                    ) : (
                      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-luva-amber/15 text-sm font-black text-luva-amber">{jogador.numero ?? '--'}</span>
                    )}
                    <div>
                      <p className="font-display text-lg font-black text-white">{jogador.nome}</p>
                      {(jogador.isLibero || jogador.posicao === 'LB') && (
                        <span className="mb-2 mt-1 inline-flex rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1 text-[0.68rem] font-black uppercase tracking-[0.16em] text-emerald-100">
                          Líbero
                        </span>
                      )}
                      <p className="text-xs font-bold text-slate-300">#{jogador.numero ?? '--'} · {getPositionLabel(jogador.posicao)} · {jogador.documentosUrls?.length ?? 0} doc(s)</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => editPlayer(jogador)} className="rounded-full border border-white/10 px-4 py-2 text-xs font-black text-slate-100">Editar</button>
                    <button type="button" onClick={() => removePlayer(jogador.id)} className="rounded-full border border-red-300/25 px-4 py-2 text-xs font-black text-red-100"><Trash2 size={14} /></button>
                  </div>
                </article>
              ))}
            </div>
          </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-12">
        <div className="luva-card rounded-[1.5rem] p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="luva-kicker">Campeonatos</p>
              <h2 className="mt-3 font-display text-3xl font-black text-white">Inscreva sua equipe nas próximas competições</h2>
              <p className="mt-3 max-w-3xl text-sm font-semibold leading-7 text-slate-200">
                Equipes validadas podem solicitar participação nos campeonatos abertos. A organização revisa a solicitação antes de confirmar a entrada na tabela.
              </p>
            </div>
            <span className="inline-flex w-fit items-center gap-2 rounded-2xl border border-luva-amber/35 bg-luva-amber/10 px-4 py-3 text-sm font-black text-luva-amber">
              <Trophy size={17} />
              Área da equipe
            </span>
          </div>

          {campeonatoMsg && <p className="mt-5 rounded-2xl border border-luva-amber/35 bg-luva-amber/10 px-4 py-3 text-sm font-bold text-white">{campeonatoMsg}</p>}

          {campeonatosLoading ? (
            <p className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm font-bold text-slate-200">Carregando campeonatos...</p>
          ) : campeonatos.length === 0 ? (
            <p className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm font-bold text-slate-200">
              Nenhum campeonato disponível ainda ou sua equipe ainda não está ativa para inscrição.
            </p>
          ) : (
            <div className="captain-championship-table mt-6">
              <div className="captain-championship-row captain-championship-head">
                <span>Campeonato</span>
                <span>Descrição</span>
                <span>Status</span>
                <span>Inscrições</span>
                <span>Vagas</span>
                <span>Situação</span>
                <span>Ação</span>
              </div>
              {campeonatos.map((liga) => (
                <article key={liga.id} className="captain-championship-row">
                  <div className="captain-championship-main" data-label="Campeonato">
                    <strong>{liga.nome}</strong>
                    {liga.dataInicio && <small>Início: {new Date(liga.dataInicio).toLocaleDateString('pt-BR')}</small>}
                  </div>
                  <span className="captain-championship-description" data-label="Descrição">
                    {liga.descricao || liga.subtitulo || 'Campeonato aberto para organização da temporada.'}
                  </span>
                  <span data-label="Status">{formatStatus(liga.status)}</span>
                  <span data-label="Inscrições">{liga.inscricoesAbertas === false ? 'Fechadas' : 'Abertas'}</span>
                  <span data-label="Vagas">
                    {liga.vagasDisponiveis === null || liga.vagasDisponiveis === undefined ? 'A definir' : `${liga.vagasDisponiveis} vaga(s)`}
                  </span>
                  <span data-label="Situação">{liga.campeonatoAtual ? 'Atual da equipe' : liga.inscricao ? formatStatus(liga.inscricao.status) : 'Não inscrita'}</span>
                  <button
                    type="button"
                    disabled={Boolean(liga.inscricao) || liga.inscricoesAbertas === false || liga.vagasDisponiveis === 0}
                    onClick={() => solicitarInscricao(liga.id)}
                    data-label="Ação"
                  >
                    {liga.inscricao ? `Inscrição ${String(liga.inscricao.status).toLowerCase()}` : liga.inscricoesAbertas === false || liga.vagasDisponiveis === 0 ? 'Indisponível' : 'Solicitar inscrição'}
                  </button>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {positionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/75 p-3 backdrop-blur-xl sm:items-center sm:p-4">
          <div className="max-h-[calc(100svh-1.5rem)] w-full max-w-xl overflow-y-auto rounded-[1.5rem] border border-white/10 bg-[#132235] p-5 shadow-2xl sm:rounded-[2rem] sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="luva-kicker">Posição do atleta</p>
                <h3 className="mt-2 font-display text-3xl font-black text-white">Selecione a função em quadra</h3>
              </div>
              <button type="button" onClick={() => setPositionModalOpen(false)} className="rounded-full border border-white/10 px-4 py-2 text-sm font-black text-white">
                Fechar
              </button>
            </div>
            <div className="mt-5 grid gap-3">
              {PLAYER_POSITIONS.map((option) => {
                const selected = playerForm.posicao === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setPlayerForm((current) => ({ ...current, posicao: option.value }))
                      setPositionModalOpen(false)
                    }}
                    className={`rounded-2xl border px-4 py-4 text-left transition ${selected ? 'border-luva-amber bg-luva-amber/15' : 'border-white/10 bg-white/[0.045] hover:border-luva-amber/60'}`}
                  >
                    <span className="block font-display text-xl font-black text-white">{option.label}</span>
                    <small className="mt-1 block text-sm font-semibold leading-6 text-slate-300">{option.description}</small>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <CandidateEditForm
        tipo="equipe"
        session={session}
        section={editSection}
        open={Boolean(editSection)}
        onClose={() => setEditSection(null)}
        onSessionUpdate={setSession}
      />
    </main>
  )
}

function formatStatus(status?: string | null) {
  if (!status) return 'A definir'

  return String(status)
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/^\w/, (letter) => letter.toUpperCase())
}

function PanelCard({
  icon,
  title,
  text,
  status,
  action,
  onEdit,
}: {
  icon: React.ReactNode
  title: string
  text: string
  status: string
  action?: CardAction
  onEdit?: (section: CandidateEditSection) => void
}) {
  return (
    <article className="luva-card capitain-card rounded-[1.5rem] p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="capitain-card-icon flex h-11 w-11 items-center justify-center rounded-2xl">{icon}</span>
        <span className="capitain-card-status rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em]">{status}</span>
      </div>
      <h2 className="mt-5 font-display text-xl font-black text-white">{title}</h2>
      <p className="mt-2 text-sm font-semibold leading-6 text-slate-200">{text}</p>
      {action && onEdit && (
        <button type="button" onClick={() => onEdit(action.section)} className="candidate-card-edit mt-5 inline-flex items-center justify-center rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.12em] transition">
          {action.label}
        </button>
      )}
    </article>
  )
}

function Input({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  required,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
  required?: boolean
}) {
  return (
    <label className="grid gap-2">
      <span className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-200">{label}{required ? ' *' : ''}</span>
      <input
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm font-bold text-white outline-none transition placeholder:text-slate-500 focus:border-luva-amber/70"
      />
    </label>
  )
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/30 px-4 py-3">
      <span className="block text-[10px] font-black uppercase tracking-[0.16em] text-luva-amber">{label}</span>
      <strong className="mt-1 block truncate text-sm font-black text-white">{value}</strong>
    </div>
  )
}

function getCapitaoStatus(status?: string) {
  const normalized = String(status || 'PENDENTE').trim().toUpperCase()

  if (['APROVADA', 'APROVADO', 'ATIVA', 'ATIVO'].includes(normalized)) {
    return {
      approved: true,
      label: normalized === 'ATIVA' || normalized === 'ATIVO' ? 'Ativa' : 'Aprovada',
      description: 'Equipe inscrita no campeonato. Elenco e dados já podem ser atualizados.',
    }
  }

  if (normalized === 'REJEITADA' || normalized === 'REJEITADO') {
    return {
      approved: false,
      label: 'Não aprovada',
      description: 'A organização retornou a candidatura. Entre em contato para entender os próximos passos.',
    }
  }

  return {
    approved: false,
    label: 'Em análise',
    description: 'A organização valida os dados antes de liberar inscrição de atletas, QR Codes e agenda da equipe.',
  }
}
