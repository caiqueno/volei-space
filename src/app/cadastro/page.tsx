'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CalendarPlus,
  CheckCircle2,
  Eye,
  EyeOff,
  ImageIcon,
  LockKeyhole,
  Mail,
  MapPinHouse,
  Plus,
  Send,
  Trash2,
  UserRound,
  UsersRound,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { fetchCepAddress, normalizeCep } from '@/lib/client-cep'
import { formatBytes, imageUploadRules, optimizeImageFile } from '@/lib/client-image-upload'

type CadastroTipo = 'equipe' | 'arbitro' | 'quadra' | 'organizador'
type AuthMode = 'cadastro' | 'login'
type FormState = Record<string, string | boolean | string[]>
type TrainingSchedule = { diaSemana: string; horario: string }

const perfis = [
  { id: 'equipe' as const, titulo: 'Equipe', texto: 'Cadastre sua equipe para participar dos campeonatos.', icon: UsersRound },
  { id: 'arbitro' as const, titulo: 'Árbitro', texto: 'Candidate-se para atuar nas partidas oficiais.', icon: BadgeCheck },
  { id: 'quadra' as const, titulo: 'Fornecedor de quadra', texto: 'Cadastre uma arena, ginásio ou espaço parceiro.', icon: MapPinHouse },
  { id: 'organizador' as const, titulo: 'Criador de campeonatos', texto: 'Crie sua conta para criar e operar campeonatos na volei.space.', icon: CalendarPlus },
]

const initial: Record<CadastroTipo, FormState> = {
  equipe: {
    nome: '',
    responsavel: '',
    email: '',
    telefone: '',
    emblemaUrl: '',
    ligaId: '',
    conviteToken: '',
    senha: '',
    confirmarSenha: '',
    genero: 'MASCULINO',
    categoria: 'MASCULINO',
    categoriaEtaria: 'ADULTO',
    nivel: 'INTERMEDIARIO',
    possuiLocalTreino: true,
    treinoTotal: '1',
    treinoDia1: 'Terca',
    treinoHora1: '20:00',
    treinoDia2: '',
    treinoHora2: '',
    treinoDia3: '',
    treinoHora3: '',
    cederQuadra: false,
    temInstagram: false,
    instagram: '',
    quadraHorarioTotal: '1',
    quadraHorarioDia1: 'Sabado',
    quadraHorarioInicio1: '14:00',
    quadraHorarioFim1: '18:00',
    quadraHorarioDia2: '',
    quadraHorarioInicio2: '',
    quadraHorarioFim2: '',
    quadraHorarioDia3: '',
    quadraHorarioInicio3: '',
    quadraHorarioFim3: '',
    cobertura: true,
    banheiro: true,
    piso: '',
    cep: '',
    endereco: '',
    bairro: '',
  },
  arbitro: { nome: '', email: '', telefone: '', senha: '', confirmarSenha: '', cref: '', diplomaUrl: '' },
  organizador: {
    nome: '',
    email: '',
    telefone: '',
    senha: '',
    confirmarSenha: '',
  },
  quadra: {
    nome: '',
    responsavel: '',
    email: '',
    telefone: '',
    senha: '',
    confirmarSenha: '',
    cep: '',
    endereco: '',
    bairro: '',
    estrutura: '',
    segunda: false,
    terca: false,
    quarta: false,
    quinta: false,
    sexta: false,
    sabado: true,
    domingo: true,
    manha: false,
    tarde: true,
    noite: true,
    fotosQuadraUrls: [],
    cobertura: true,
    banheiro: true,
    estacionamento: false,
  },
}

const inputBase =
  'w-full rounded-xl border border-white/18 !bg-[#071426] px-3.5 py-2.5 text-sm font-bold !text-white outline-none transition placeholder:!text-white/45 focus:border-luva-amber focus:!bg-[#0b1c33] focus:ring-4 focus:ring-luva-amber/20'
const labelBase = 'mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] !text-white/78'

export default function CadastroPage() {
  const [mode, setMode] = useState<AuthMode>('cadastro')
  // Sem escolha de perfil na UI — todo cadastro novo (sem contexto de convite
  // via ?perfil= na URL, ex. convite de equipe) é Organizador por padrão.
  const [tipo, setTipo] = useState<CadastroTipo>('organizador')
  const [step, setStep] = useState(0)
  const [forms, setForms] = useState(initial)
  const [login, setLogin] = useState({ email: '', senha: '', lembrar: true })
  const [showPassword, setShowPassword] = useState(false)
  const [cepLoading, setCepLoading] = useState(false)
  const [cepMessage, setCepMessage] = useState<string | null>(null)
  const lastCepSearchRef = useRef('')
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)

  const activeMeta = useMemo(() => perfis.find((item) => item.id === tipo), [tipo])
  const active = tipo ? forms[tipo] : initial.equipe
  const activeCep = String(active.cep ?? '')
  const steps = tipo ? stepsByTipo[tipo] : []
  const currentStep = steps[step]
  const progress = tipo ? Math.round(((step + 1) / steps.length) * 100) : 0
  const ActiveIcon = activeMeta?.icon

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const modo = params.get('modo')
    const perfil = params.get('perfil') as CadastroTipo | null
    const ligaId = params.get('ligaId')
    const conviteToken = params.get('convite')
    if (modo === 'login' || modo === 'cadastro') setMode(modo)
    if (perfil && ['equipe', 'arbitro', 'quadra', 'organizador'].includes(perfil)) {
      setTipo(perfil)
      setMode('cadastro')
    }
    if (ligaId) {
      setForms((current) => ({ ...current, equipe: { ...current.equipe, ligaId, conviteToken: conviteToken ?? '' } }))
    }
  }, [])

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode)
    setFeedback(null)
    window.history.replaceState(null, '', `/cadastro?modo=${nextMode}`)
  }

  function setField(name: string, value: string | boolean | string[]) {
    if (!tipo) return
    setFeedback(null)
    if (name === 'cep') {
      setCepMessage(null)
      lastCepSearchRef.current = ''
    }
    setForms((current) => ({ ...current, [tipo]: { ...current[tipo], [name]: value } }))
  }

  async function searchCep() {
    if (!tipo) return
    const cep = normalizeCep(String(forms[tipo].cep ?? ''))
    const searchKey = `${tipo}:${cep}`
    setCepMessage(null)
    if (!cep) return
    if (cep.length !== 8) {
      setCepMessage('Informe um CEP com 8 numeros ou preencha o endereco manualmente.')
      return
    }
    if (cepLoading && lastCepSearchRef.current === searchKey) return

    lastCepSearchRef.current = searchKey
    setCepLoading(true)
    try {
      const address = await fetchCepAddress(cep)
      setForms((current) => ({
        ...current,
        [tipo]: {
          ...current[tipo],
          cep: formatCep(address.cep),
          endereco: address.enderecoCompleto || current[tipo].endereco,
          bairro: address.bairro || current[tipo].bairro || '',
        },
      }))
      setCepMessage('Endereco preenchido pelo CEP.')
    } catch (error) {
      setCepMessage(error instanceof Error ? error.message : 'Nao foi possivel consultar o CEP agora. Preencha o endereco manualmente.')
    } finally {
      setCepLoading(false)
    }
  }

  useEffect(() => {
    if (!tipo || !['equipe', 'quadra'].includes(tipo)) return
    const cep = normalizeCep(activeCep)
    if (cep.length !== 8) return
    const searchKey = `${tipo}:${cep}`
    if (lastCepSearchRef.current === searchKey) return
    const timeout = window.setTimeout(() => {
      void searchCep()
    }, 550)
    return () => window.clearTimeout(timeout)
  }, [activeCep, tipo])

  async function submitCadastro(event: React.FormEvent) {
    event.preventDefault()
    if (!tipo) return

    const form = forms[tipo]
    if (String(form.senha || '').length < 8) {
      setFeedback({ type: 'error', text: 'A senha deve ter pelo menos 8 caracteres.' })
      return
    }

    if (String(form.senha || '') !== String(form.confirmarSenha || '')) {
      setFeedback({ type: 'error', text: 'As senhas não coincidem. Confira os dois campos antes de continuar.' })
      return
    }

    const validationError = validateCadastroStep(tipo, step, form)
    if (validationError) {
      setFeedback({ type: 'error', text: validationError })
      return
    }

    if (step < steps.length - 1) {
      setFeedback(null)
      setStep((current) => current + 1)
      return
    }

    setLoading(true)
    setFeedback(null)

    const res = await fetch(endpointByTipo[tipo], {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadByTipo(tipo, forms[tipo])),
    })
    const json = await res.json().catch(() => ({}))
    setLoading(false)

    if (res.ok) {
      setForms((current) => ({ ...current, [tipo]: initial[tipo] }))

      if (json.data?.requerVerificacao) {
        setFeedback({ type: 'success', text: json.data?.mensagem ?? 'Verifique seu e-mail para ativar sua conta.' })
        return
      }

      const currentForm = forms[tipo]
      const session = {
        tipo,
        perfil: activeMeta?.titulo ?? tipo,
        nome: String(currentForm.responsavel || currentForm.nome || ''),
        email: String(currentForm.email || ''),
        candidaturaId: json.data?.id ?? null,
        status: tipo === 'organizador' ? 'ATIVA' : 'PENDENTE',
      }

      window.localStorage.setItem('luva_session', JSON.stringify(session))
      setFeedback({ type: 'success', text: json.data?.mensagem ?? 'Cadastro recebido com sucesso.' })
      window.location.href = tipo === 'equipe' ? '/capitao' : '/painel'
      return
    }

    setFeedback({ type: 'error', text: json.error ?? 'Não foi possível enviar o cadastro agora.' })
  }

  async function submitLogin(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setFeedback(null)
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: login.email, senha: login.senha }),
    })
    const json = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) {
      setFeedback({ type: 'error', text: json.error ?? 'Não foi possível entrar.' })
      return
    }

    if (json.data?.user) {
      window.localStorage.setItem('luva_session', JSON.stringify(json.data.user))
    }

    window.location.href = json.data?.redirectTo ?? '/admin'
  }

  async function forgotPassword() {
    if (!login.email) {
      setFeedback({ type: 'error', text: 'Informe seu e-mail para receber o link de recuperação.' })
      return
    }
    setLoading(true)
    setFeedback(null)
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: login.email }),
    })
    const json = await res.json().catch(() => ({}))
    setLoading(false)
    setFeedback({
      type: res.ok ? 'success' : 'error',
      text: json.data?.mensagem ?? json.error ?? 'Não foi possível solicitar recuperação agora.',
    })
  }
  return (
    <main className="auth-page min-h-screen bg-[#020611] text-white">
      <section className="relative flex min-h-screen flex-col overflow-hidden bg-[#020611] px-5 py-4 text-white sm:px-8 lg:px-12">
        <div className="pointer-events-none absolute inset-0 min-h-full bg-[radial-gradient(circle_at_20%_10%,rgba(239,159,39,0.18),transparent_30%),radial-gradient(circle_at_84%_12%,rgba(23,95,166,0.26),transparent_36%),linear-gradient(135deg,#020611_0%,#071a2f_56%,#03101f_100%)]" />
        <div className="pointer-events-none absolute inset-0 min-h-full opacity-[0.22] [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:72px_72px]" />
        <div className="relative z-10 flex min-h-full flex-col">
        <header className="pointer-events-none absolute right-0 top-0 z-20 flex items-center justify-end gap-4">
          <Link href="/" className="auth-top-back pointer-events-auto ml-auto inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-black shadow-sm backdrop-blur transition hover:-translate-y-0.5">
            <ArrowLeft size={16} />
            Voltar
          </Link>
        </header>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-16 lg:py-6">
          <Link href="/" className="mx-auto flex w-fit items-center gap-2.5">
            <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg">
              <Image src="/brand/volei-space_simbolo-orbital_transparente.png" alt="volei.space" fill sizes="36px" className="object-contain" />
            </span>
            <span className="font-display text-lg font-black text-[#ffffff]"> </span>
          </Link>

          <p className="mt-6 text-center text-[11px] font-black uppercase tracking-[0.2em] text-luva-amber">{mode === 'cadastro' ? 'Criar acesso' : 'Login'}</p>
          <h2 className="mt-2 text-center font-display text-3xl font-black leading-tight text-white sm:text-4xl">
            {mode === 'cadastro' ? 'Criar conta' : 'Entrar na conta'}
          </h2>
          <p className="mt-2 text-center text-sm font-semibold leading-6 text-white/78">
            {mode === 'cadastro'
              ? 'Crie sua conta para começar a organizar seus campeonatos.'
              : 'Acesse sua área assim que a autenticação da plataforma estiver ativa.'}
          </p>

          <div className="auth-mode-switch mt-5 grid rounded-2xl border border-luva-amber/35 bg-[#061322] p-1.5 shadow-[0_18px_70px_rgba(0,0,0,0.35)] sm:grid-cols-2">
              <button
                type="button"
                onClick={() => switchMode('login')}
                className={`auth-mode-tab ${mode === 'login' ? 'is-active' : ''} rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-[0.12em] transition ${
                  mode === 'login' ? 'bg-luva-amber text-[#061322] shadow-[0_10px_30px_rgba(239,159,39,0.28)]' : 'text-white/88 hover:bg-white/8 hover:text-white'
                }`}
              >
                Entrar
              </button>
              <button
                type="button"
                onClick={() => switchMode('cadastro')}
                className={`auth-mode-tab ${mode === 'cadastro' ? 'is-active' : ''} rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-[0.12em] transition ${
                  mode === 'cadastro' ? 'bg-luva-amber text-[#061322] shadow-[0_10px_30px_rgba(239,159,39,0.28)]' : 'text-white/88 hover:bg-white/8 hover:text-white'
                }`}
              >
                Criar conta
              </button>
            </div>

            <div className="mt-5 rounded-[1.5rem] border border-white/12 bg-[#071426]/92 p-4 shadow-[0_24px_90px_rgba(0,0,0,0.45)] backdrop-blur sm:p-5">
              {mode === 'login' ? (
                <LoginPanel
                  login={login}
                  setLogin={setLogin}
                  showPassword={showPassword}
                  setShowPassword={setShowPassword}
                  onSubmit={submitLogin}
                  onForgotPassword={forgotPassword}
                />
              ) : (
                <CadastroPanel
                  tipo={tipo}
                  active={active}
                  activeMeta={activeMeta}
                  ActiveIcon={ActiveIcon}
                  step={step}
                  steps={steps}
                  currentStep={currentStep}
                  progress={progress}
                  loading={loading}
                  onSetStep={setStep}
                  onSetField={setField}
                  onSearchCep={searchCep}
                  cepLoading={cepLoading}
                  cepMessage={cepMessage}
                  onSubmit={submitCadastro}
                />
              )}

              {feedback && <FeedbackBox feedback={feedback} />}
            </div>
          </div>
          </div>
        </section>
    </main>
  )
}

function LoginPanel({
  login,
  setLogin,
  showPassword,
  setShowPassword,
  onSubmit,
  onForgotPassword,
}: {
  login: { email: string; senha: string; lembrar: boolean }
  setLogin: React.Dispatch<React.SetStateAction<{ email: string; senha: string; lembrar: boolean }>>
  showPassword: boolean
  setShowPassword: React.Dispatch<React.SetStateAction<boolean>>
  onSubmit: (event: React.FormEvent) => void
  onForgotPassword: () => void
}) {
  return (
    <form onSubmit={onSubmit}>
      <div className="space-y-5">
        <Field label="E-mail" required>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/58" size={18} />
            <input
              required
              type="email"
              value={login.email}
              onChange={(event) => setLogin((current) => ({ ...current, email: event.target.value }))}
              className={`${inputBase} [padding-left:3rem]`}
              placeholder="voce@email.com"
            />
          </div>
        </Field>

        <Field label="Senha" required>
          <div className="relative">
            <LockKeyhole className="absolute left-4 top-1/2 -translate-y-1/2 text-white/58" size={18} />
            <input
              required
              type={showPassword ? 'text' : 'password'}
              value={login.senha}
              onChange={(event) => setLogin((current) => ({ ...current, senha: event.target.value }))}
              className={`${inputBase} [padding-left:3rem] [padding-right:3rem]`}
              placeholder="Digite sua senha"
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-white/55 transition hover:bg-white/10 hover:text-white"
              aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </Field>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex items-center gap-2.5 text-sm font-bold text-white/76">
          <input
            type="checkbox"
            checked={login.lembrar}
            onChange={(event) => setLogin((current) => ({ ...current, lembrar: event.target.checked }))}
            className="h-4 w-4 accent-luva-amber"
          />
          Manter conectado
        </label>
        <button type="button" onClick={onForgotPassword} className="text-left text-sm font-black text-luva-amber transition hover:text-amber-600">
          Esqueceu a senha?
        </button>
      </div>

      <button type="submit" className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-luva-amber px-6 py-3 text-sm font-black uppercase tracking-wide text-white transition hover:-translate-y-0.5 hover:bg-luva-amber">
        Entrar
        <ArrowRight size={18} />
      </button>
    </form>
  )
}

function CadastroPanel({
  tipo,
  active,
  activeMeta,
  ActiveIcon,
  step,
  steps,
  currentStep,
  progress,
  loading,
  onSetStep,
  onSetField,
  onSearchCep,
  cepLoading,
  cepMessage,
  onSubmit,
}: {
  tipo: CadastroTipo
  active: FormState
  activeMeta?: (typeof perfis)[number]
  ActiveIcon?: (typeof perfis)[number]['icon']
  step: number
  steps: { title: string; description: string }[]
  currentStep: { title: string; description: string }
  progress: number
  loading: boolean
  onSetStep: React.Dispatch<React.SetStateAction<number>>
  onSetField: (name: string, value: string | boolean | string[]) => void
  onSearchCep: () => Promise<void>
  cepLoading: boolean
  cepMessage: string | null
  onSubmit: (event: React.FormEvent) => void
}) {
  return (
    <form onSubmit={onSubmit}>
      <div className="mb-5 rounded-2xl border border-white/12 bg-white/[0.045] p-4">
        <div className="flex items-start gap-3">
          <span className="auth-selected-profile-icon flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-luva-amber/35 bg-luva-amber/10 text-luva-amber">
            {ActiveIcon && <ActiveIcon size={22} />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-black text-white">{activeMeta?.titulo}</p>
            <p className="mt-1 text-sm font-semibold leading-6 text-white/70">{activeMeta?.texto}</p>
          </div>
        </div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/12">
          <div className="h-full rounded-full bg-luva-amber transition-all" style={{ width: `${progress}%` }} />
        </div>
        <ol className="mt-4 grid gap-3 sm:grid-cols-3">
          {steps.map((item, index) => {
            const activeStep = step === index
            const done = step > index
            return (
              <li
                key={item.title}
                className="flex items-center gap-2 text-xs font-black"
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] ${
                    activeStep
                      ? 'border-luva-amber bg-luva-amber text-[#050914]'
                      : done
                        ? 'auth-step-done border-emerald-300 bg-emerald-50 text-emerald-700'
                        : 'border-white/15 bg-white/[0.05] text-white/55'
                  }`}
                >
                  {done ? '✓' : index + 1}
                </span>
                <span className={activeStep ? 'text-white' : done ? 'text-emerald-300' : 'text-white/60'}>{item.title}</span>
              </li>
            )
          })}
        </ol>
      </div>

      <div className="mb-5">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-luva-amber">Etapa {step + 1} de {steps.length}</p>
        <h3 className="mt-2 font-display text-xl font-black text-white">{currentStep.title}</h3>
        <p className="mt-1 text-sm font-semibold leading-6 text-white/74">{currentStep.description}</p>
      </div>

      {renderStep(tipo, step, active, onSetField, onSearchCep, cepLoading, cepMessage)}

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={() => onSetStep((current) => Math.max(0, current - 1))}
          disabled={step === 0}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/14 bg-white/8 px-5 py-3 text-sm font-black text-white transition hover:border-luva-amber/60 hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ArrowLeft size={17} />
          Voltar
        </button>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-luva-amber px-6 py-3 text-sm font-black uppercase tracking-wide text-slate-950 transition hover:-translate-y-0.5 hover:bg-amber-300 disabled:opacity-50"
        >
          {step === steps.length - 1 ? <Send size={18} /> : <ArrowRight size={18} />}
          {loading ? 'Concluindo...' : step === steps.length - 1 ? 'Concluir cadastro' : 'Continuar'}
        </button>
      </div>
    </form>
  )
}

function renderStep(
  tipo: CadastroTipo,
  step: number,
  form: FormState,
  setField: (name: string, value: string | boolean | string[]) => void,
  searchCep: () => Promise<void>,
  cepLoading: boolean,
  cepMessage: string | null,
) {
  if (tipo === 'equipe') {
    if (step === 0) return <EquipeCapitao form={form} setField={setField} />
    if (step === 1) return <EquipeIdentidade form={form} setField={setField} />
    if (step === 2) return <EquipeCompeticao form={form} setField={setField} />
    return <EquipeQuadra form={form} setField={setField} searchCep={searchCep} cepLoading={cepLoading} cepMessage={cepMessage} />
  }
  if (tipo === 'arbitro') {
    if (step === 0) return <ArbitroDados form={form} setField={setField} />
    return <ArbitroExperiencia form={form} setField={setField} />
  }
  if (tipo === 'organizador') {
    return <OrganizadorDados form={form} setField={setField} />
  }
  if (step === 0) return <QuadraDados form={form} setField={setField} />
  if (step === 1) return <QuadraLocal form={form} setField={setField} searchCep={searchCep} cepLoading={cepLoading} cepMessage={cepMessage} />
  return <QuadraEstrutura form={form} setField={setField} />
}

function EquipeCapitao({ form, setField }: FieldProps) {
  return (
    <Grid>
      <Field label="Responsável pela equipe" required icon={<UserRound size={17} />}>
        <input required value={String(form.responsavel)} onChange={(event) => setField('responsavel', event.target.value)} className={`${inputBase} [padding-left:2.75rem]`} placeholder="Nome do responsável" />
      </Field>
      <Field label="E-mail" required icon={<Mail size={17} />}>
        <input required type="email" value={String(form.email)} onChange={(event) => setField('email', event.target.value)} className={`${inputBase} [padding-left:2.75rem]`} placeholder="equipe@email.com" />
      </Field>
      <Field label="Telefone" hint="Opcional.">
        <input value={String(form.telefone)} onChange={(event) => setField('telefone', formatPhone(event.target.value))} className={inputBase} placeholder="(00) 00000-0000" maxLength={15} />
      </Field>
      <PasswordFields form={form} setField={setField} />
    </Grid>
  )
}

function EquipeIdentidade({ form, setField }: FieldProps) {
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [uploadInfo, setUploadInfo] = useState('')
  const [previewUrl, setPreviewUrl] = useState('')
  const emblemaUrl = String(form.emblemaUrl || '')

  async function handleUpload(file: File | null) {
    if (!file) return
    setUploadError('')
    setUploadInfo('')
    try {
      setUploading(true)
      const optimized = await optimizeImageFile(file, `emblema-${String(form.nome || 'equipe')}`)
      setPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current)
        return optimized.previewUrl
      })

      const extension = optimized.file.type === 'image/webp' ? 'webp' : 'jpg'
      const fileName = `emblemas/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`
      const { error } = await supabase.storage.from('equipe-emblemas').upload(fileName, optimized.file, {
        upsert: false,
        contentType: optimized.file.type,
        cacheControl: '3600',
      })
      if (error) {
        setField('emblemaUrl', '')
        setUploadError('Não foi possível enviar o emblema. Tente novamente ou verifique o bucket equipe-emblemas no Supabase.')
        return
      }
      const { data } = supabase.storage.from('equipe-emblemas').getPublicUrl(fileName)
      if (!data.publicUrl) {
        setField('emblemaUrl', '')
        setUploadError('Não foi possível obter o link público do emblema.')
        return
      }
      setField('emblemaUrl', data.publicUrl)
      setUploadInfo(`Imagem otimizada: ${formatBytes(optimized.originalBytes)} para ${formatBytes(optimized.optimizedBytes)}.`)
    } catch (error) {
      setField('emblemaUrl', '')
      setUploadError(error instanceof Error ? error.message : 'Não foi possível processar a imagem selecionada.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <Grid>
      <Field label="Nome da equipe" required icon={<UsersRound size={17} />}>
        <input required value={String(form.nome)} onChange={(event) => setField('nome', event.target.value)} className={`${inputBase} [padding-left:2.75rem]`} placeholder="Ex: Kimura Vôlei" />
      </Field>
      <Field label="Emblema da equipe" icon={<ImageIcon size={17} />}>
        <label className="flex min-h-[4.25rem] cursor-pointer items-center gap-4 rounded-2xl border border-white/14 bg-white/6 px-4 py-3 transition hover:border-luva-amber/70 hover:bg-white/10">
          {previewUrl || emblemaUrl ? (
            <img src={previewUrl || emblemaUrl} alt="Emblema da equipe" className="h-12 w-12 rounded-xl border border-white/15 object-cover" />
          ) : (
            <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-luva-amber/40 bg-luva-amber/10 text-luva-amber">
              <ImageIcon size={20} />
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-black text-white">{uploading ? 'Processando e enviando...' : emblemaUrl ? 'Emblema enviado' : 'Enviar imagem do emblema'}</span>
            <span className="mt-1 block text-xs font-bold text-white/62">{imageUploadRules.allowedLabel}. Até {formatBytes(imageUploadRules.maxOriginalBytes)}; comprimimos automaticamente antes do envio.</span>
            {uploadInfo && <span className="mt-1 block text-xs font-black text-emerald-200">{uploadInfo}</span>}
          </span>
          {uploadError && <span className="text-xs font-black text-red-200">{uploadError}</span>}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            disabled={uploading}
            onChange={(event) => {
              void handleUpload(event.target.files?.[0] || null)
              event.currentTarget.value = ''
            }}
          />
        </label>
      </Field>
    </Grid>
  )
}

function EquipeCompeticao({ form, setField }: FieldProps) {
  const treinoTotal = Math.max(1, Number(form.treinoTotal || 1))

  function addTreino() {
    setField('treinoTotal', String(treinoTotal + 1))
  }

  function removeTreino(index: number) {
    for (let current = index; current < treinoTotal; current += 1) {
      setField(`treinoDia${current}`, String(form[`treinoDia${current + 1}`] || ''))
      setField(`treinoHora${current}`, String(form[`treinoHora${current + 1}`] || ''))
    }
    setField(`treinoDia${treinoTotal}`, '')
    setField(`treinoHora${treinoTotal}`, '')
    setField('treinoTotal', String(Math.max(1, treinoTotal - 1)))
  }

  return (
    <Grid>
      <Field label="Gênero da equipe" required>
        <select value={String(form.genero)} onChange={(event) => {
          setField('genero', event.target.value)
          setField('categoria', event.target.value)
        }} className={inputBase}>
          {categorias.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Categoria etária" required>
        <select value={String(form.categoriaEtaria)} onChange={(event) => setField('categoriaEtaria', event.target.value)} className={inputBase}>
          {categoriasEtarias.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </select>
      </Field>
      <div className="md:col-span-2">
        <p className={labelBase}>Nível autodeclarado</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {niveis.map((nivel) => {
            const active = form.nivel === nivel.value
            return (
              <button
                key={nivel.value}
                type="button"
                onClick={() => setField('nivel', nivel.value)}
                className={`auth-choice-option rounded-2xl border px-4 py-3 text-sm font-black transition ${
                  active
                    ? 'is-active border-luva-amber bg-luva-amber text-[#061322] shadow-[0_12px_34px_rgba(239,159,39,0.24)]'
                    : 'border-white/15 bg-white/[0.045] text-white/82 hover:border-luva-amber/70 hover:bg-white/[0.08] hover:text-white'
                }`}
              >
                {nivel.label}
              </button>
            )
          })}
        </div>
      </div>
      <BinaryChoice title="Possui local fixo de treino?" value={Boolean(form.possuiLocalTreino)} onChange={(value) => setField('possuiLocalTreino', value)} />
      {form.possuiLocalTreino && (
        <div className="md:col-span-2">
          <p className={labelBase}>Dias e horários de treino</p>
          <div className="grid gap-2">
            {Array.from({ length: treinoTotal }, (_, i) => i + 1).map((index) => (
              <div key={index} className="grid gap-2 sm:grid-cols-[1fr_150px_44px]">
                <select value={String(form[`treinoDia${index}`])} onChange={(event) => setField(`treinoDia${index}`, event.target.value)} className={inputBase}>
                  <option value="">Selecionar dia</option>
                  {diasSemanaOptions.map((dia) => <option key={dia.value} value={dia.value}>{dia.label}</option>)}
                </select>
                <input type="time" value={String(form[`treinoHora${index}`])} onChange={(event) => setField(`treinoHora${index}`, event.target.value)} className={inputBase} />
                <button
                  type="button"
                  onClick={() => removeTreino(index)}
                  disabled={treinoTotal === 1}
                  className="flex h-[46px] items-center justify-center rounded-xl border border-white/15 bg-white/[0.045] text-white/72 transition hover:border-red-300/70 hover:bg-red-500/15 hover:text-red-100 disabled:cursor-not-allowed disabled:opacity-35"
                  aria-label="Remover horário de treino"
                >
                  <Trash2 size={17} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addTreino}
              className="auth-add-button mt-1 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-luva-amber/45 bg-luva-amber/12 px-4 py-3 text-sm font-black text-luva-amber transition hover:bg-luva-amber hover:text-[#061322]"
            >
              <Plus size={17} />
              Adicionar outro dia e horário
            </button>
          </div>
        </div>
      )}
      <ToggleGroup title="Dias disponíveis para jogos" names={dias} form={form} setField={setField} />
      <ToggleGroup title="Períodos disponíveis" names={horarios} form={form} setField={setField} />
    </Grid>
  )
}

function EquipeQuadra({ form, setField, searchCep, cepLoading, cepMessage }: FieldProps & CepProps) {
  return (
    <Grid>
      <Field label="CEP da quadra" hint="Opcional. Ao informar o CEP, tentamos preencher o endereço automaticamente.">
        <input value={String(form.cep)} onChange={(event) => setField('cep', formatCep(event.target.value))} onBlur={searchCep} className={inputBase} placeholder="00000-000" maxLength={9} />
      </Field>
      <Field label="Endereço da quadra">
        <input value={String(form.endereco)} onChange={(event) => setField('endereco', event.target.value)} className={inputBase} placeholder="Rua, número, bairro" />
      </Field>
      <Field label="Bairro">
        <input value={String(form.bairro)} onChange={(event) => setField('bairro', event.target.value)} className={inputBase} placeholder="Bairro/cidade" />
      </Field>
      <Field label="Tipo de piso">
        <input value={String(form.piso)} onChange={(event) => setField('piso', event.target.value)} className={inputBase} placeholder="Madeira, cimento, taraflex..." />
      </Field>
      <CepFeedback cepLoading={cepLoading} cepMessage={cepMessage} />
      <ToggleGroup title="Estrutura da quadra" names={estruturaEquipe} form={form} setField={setField} />
      <BinaryChoice title="A equipe pode ceder quadra para jogos?" value={Boolean(form.cederQuadra)} onChange={(value) => setField('cederQuadra', value)} />
      <BinaryChoice title="Equipe tem Instagram?" value={Boolean(form.temInstagram)} onChange={(value) => setField('temInstagram', value)} />
      {form.temInstagram && (
        <Field label="@ do Instagram" className="md:col-span-2">
          <input value={String(form.instagram)} onChange={(event) => setField('instagram', event.target.value.replace(/^@/, ''))} className={inputBase} placeholder="ligaunicadevolei" />
        </Field>
      )}
    </Grid>
  )
}

function ArbitroDados({ form, setField }: FieldProps) {
  return (
    <Grid>
      <Field label="Nome completo" required icon={<UserRound size={17} />}>
        <input required value={String(form.nome)} onChange={(event) => setField('nome', event.target.value)} className={`${inputBase} [padding-left:2.75rem]`} placeholder="Seu nome" />
      </Field>
      <Field label="E-mail" required icon={<Mail size={17} />}>
        <input required type="email" value={String(form.email)} onChange={(event) => setField('email', event.target.value)} className={`${inputBase} [padding-left:2.75rem]`} placeholder="voce@email.com" />
      </Field>
      <Field label="Telefone" hint="Opcional.">
        <input value={String(form.telefone)} onChange={(event) => setField('telefone', formatPhone(event.target.value))} className={inputBase} placeholder="(00) 00000-0000" maxLength={15} />
      </Field>
      <PasswordFields form={form} setField={setField} />
    </Grid>
  )
}

function ArbitroExperiencia({ form, setField }: FieldProps) {
  return (
    <Grid>
      <Field label="CREF ou registro">
        <input value={String(form.cref)} onChange={(event) => setField('cref', event.target.value)} className={inputBase} placeholder="Opcional" />
      </Field>
      <Field label="Link de certificado" className="md:col-span-2">
        <input value={String(form.diplomaUrl)} onChange={(event) => setField('diplomaUrl', event.target.value)} className={inputBase} placeholder="https://..." />
      </Field>
    </Grid>
  )
}

function OrganizadorDados({ form, setField }: FieldProps) {
  return (
    <Grid>
      <Field label="Nome completo" required icon={<UserRound size={17} />}>
        <input required value={String(form.nome)} onChange={(event) => setField('nome', event.target.value)} className={`${inputBase} [padding-left:2.75rem]`} placeholder="Nome do responsável" />
      </Field>
      <Field label="E-mail" required icon={<Mail size={17} />}>
        <input required type="email" value={String(form.email)} onChange={(event) => setField('email', event.target.value)} className={`${inputBase} [padding-left:2.75rem]`} placeholder="organizador@email.com" />
      </Field>
      <Field label="Telefone" hint="Opcional.">
        <input value={String(form.telefone)} onChange={(event) => setField('telefone', formatPhone(event.target.value))} className={inputBase} placeholder="(00) 00000-0000" maxLength={15} />
      </Field>
      <PasswordFields form={form} setField={setField} />
      <div className="md:col-span-2 rounded-2xl border border-luva-amber/35 bg-luva-amber/10 p-4">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-luva-amber">Acesso padrão</p>
        <p className="mt-2 text-sm font-bold leading-6 text-white/82">
          Sua conta de criador é ativada na hora. Depois de entrar, você completa os dados da sua organização e já pode cadastrar campeonatos, abrir inscrições e operar suas competições.
        </p>
      </div>
    </Grid>
  )
}

function QuadraDados({ form, setField }: FieldProps) {
  return (
    <Grid>
      <Field label="Nome da quadra/arena" required>
        <input required value={String(form.nome)} onChange={(event) => setField('nome', event.target.value)} className={inputBase} placeholder="Arena, clube ou ginásio" />
      </Field>
      <Field label="Responsável" required icon={<UserRound size={17} />}>
        <input required value={String(form.responsavel)} onChange={(event) => setField('responsavel', event.target.value)} className={`${inputBase} [padding-left:2.75rem]`} placeholder="Nome do contato" />
      </Field>
      <Field label="E-mail" required icon={<Mail size={17} />}>
        <input required type="email" value={String(form.email)} onChange={(event) => setField('email', event.target.value)} className={`${inputBase} [padding-left:2.75rem]`} placeholder="contato@email.com" />
      </Field>
      <Field label="Telefone" hint="Opcional.">
        <input value={String(form.telefone)} onChange={(event) => setField('telefone', formatPhone(event.target.value))} className={inputBase} placeholder="(00) 00000-0000" maxLength={15} />
      </Field>
      <PasswordFields form={form} setField={setField} />
    </Grid>
  )
}

function QuadraLocal({ form, setField, searchCep, cepLoading, cepMessage }: FieldProps & CepProps) {
  const horarioTotal = Math.max(1, Number(form.quadraHorarioTotal || 1))

  function addHorario() {
    setField('quadraHorarioTotal', String(horarioTotal + 1))
  }

  function removeHorario(index: number) {
    for (let current = index; current < horarioTotal; current += 1) {
      setField(`quadraHorarioDia${current}`, String(form[`quadraHorarioDia${current + 1}`] || ''))
      setField(`quadraHorarioInicio${current}`, String(form[`quadraHorarioInicio${current + 1}`] || ''))
      setField(`quadraHorarioFim${current}`, String(form[`quadraHorarioFim${current + 1}`] || ''))
    }
    setField(`quadraHorarioDia${horarioTotal}`, '')
    setField(`quadraHorarioInicio${horarioTotal}`, '')
    setField(`quadraHorarioFim${horarioTotal}`, '')
    setField('quadraHorarioTotal', String(Math.max(1, horarioTotal - 1)))
  }

  return (
    <Grid>
      <Field label="CEP" hint="Opcional. Use para buscar o endereço automaticamente.">
        <input value={String(form.cep)} onChange={(event) => setField('cep', formatCep(event.target.value))} onBlur={searchCep} className={inputBase} placeholder="00000-000" maxLength={9} />
      </Field>
      <Field label="Endereço" required>
        <input required value={String(form.endereco)} onChange={(event) => setField('endereco', event.target.value)} className={inputBase} placeholder="Rua, número" />
      </Field>
      <Field label="Bairro">
        <input value={String(form.bairro)} onChange={(event) => setField('bairro', event.target.value)} className={inputBase} placeholder="Bairro/cidade" />
      </Field>
      <div className="md:col-span-2">
        <p className={labelBase}>Dias e horários disponíveis</p>
        <div className="grid gap-2">
          {Array.from({ length: horarioTotal }, (_, i) => i + 1).map((index) => (
            <div key={index} className="grid gap-2 sm:grid-cols-[1fr_140px_140px_44px]">
              <select value={String(form[`quadraHorarioDia${index}`] || '')} onChange={(event) => setField(`quadraHorarioDia${index}`, event.target.value)} className={inputBase}>
                <option value="">Selecionar dia</option>
                {diasSemanaOptions.map((dia) => <option key={dia.value} value={dia.value}>{dia.label}</option>)}
              </select>
              <input type="time" aria-label="Horário inicial" value={String(form[`quadraHorarioInicio${index}`] || '')} onChange={(event) => setField(`quadraHorarioInicio${index}`, event.target.value)} className={inputBase} />
              <input type="time" aria-label="Horário final" value={String(form[`quadraHorarioFim${index}`] || '')} onChange={(event) => setField(`quadraHorarioFim${index}`, event.target.value)} className={inputBase} />
              <button
                type="button"
                onClick={() => removeHorario(index)}
                disabled={horarioTotal === 1}
                className="flex h-[46px] items-center justify-center rounded-xl border border-white/15 bg-white/[0.045] text-white/72 transition hover:border-red-300/70 hover:bg-red-500/15 hover:text-red-100 disabled:cursor-not-allowed disabled:opacity-35"
                aria-label="Remover horário disponível"
              >
                <Trash2 size={17} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addHorario}
            className="auth-add-button mt-1 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-luva-amber/45 bg-luva-amber/12 px-4 py-3 text-sm font-black text-luva-amber transition hover:bg-luva-amber hover:text-[#061322]"
          >
            <Plus size={17} />
            Adicionar outro dia e horário
          </button>
        </div>
      </div>
      <CepFeedback cepLoading={cepLoading} cepMessage={cepMessage} />
    </Grid>
  )
}

function QuadraEstrutura({ form, setField }: FieldProps) {
  return (
    <Grid>
      <Field label="Estrutura" className="md:col-span-2">
        <textarea
          value={String(form.estrutura)}
          onChange={(event) => setField('estrutura', event.target.value)}
          className={`${inputBase} min-h-28 resize-none`}
          placeholder="Quantidade de quadras, arquibancada, iluminação, vestiário..."
        />
      </Field>
      <ToggleGroup title="Recursos disponíveis" names={estruturaQuadra} form={form} setField={setField} />
      <FotosQuadra form={form} setField={setField} />
    </Grid>
  )
}

function FotosQuadra({ form, setField }: FieldProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fotos = Array.isArray(form.fotosQuadraUrls) ? form.fotosQuadraUrls.map(String) : []

  async function uploadFotos(files: FileList | null) {
    if (!files?.length) return
    setError('')
    setUploading(true)

    const uploaded: string[] = []
    for (const file of Array.from(files).slice(0, Math.max(0, 8 - fotos.length))) {
      if (!file.type.startsWith('image/')) {
        setError('Envie apenas imagens da quadra.')
        continue
      }
      if (file.size > 5 * 1024 * 1024) {
        setError('Cada foto deve ter no máximo 5 MB.')
        continue
      }

      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const safeName = file.name
        .replace(/\.[^/.]+$/, '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9-_]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase()
      const path = `candidaturas/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName || 'quadra'}.${ext}`
      const { error: uploadError } = await supabase.storage.from('quadra-fotos').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      })

      if (uploadError) {
        setError('Não foi possível enviar uma das fotos. Verifique o bucket quadra-fotos no Supabase.')
        continue
      }

      const { data } = supabase.storage.from('quadra-fotos').getPublicUrl(path)
      if (data.publicUrl) uploaded.push(data.publicUrl)
    }

    if (uploaded.length) setField('fotosQuadraUrls', [...fotos, ...uploaded].slice(0, 8))
    setUploading(false)
  }

  function removeFoto(url: string) {
    setField('fotosQuadraUrls', fotos.filter((foto) => foto !== url))
  }

  return (
    <div className="md:col-span-2">
      <p className={labelBase}>Fotos da quadra para aprovação</p>
      <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-luva-amber/45 bg-luva-amber/10 px-4 py-5 text-center transition hover:border-luva-amber hover:bg-luva-amber/15">
        <Plus size={22} className="text-luva-amber" />
        <span className="mt-2 text-sm font-black text-white">Adicionar fotos da quadra</span>
        <span className="mt-1 text-xs font-semibold text-white/62">Até 8 imagens, 5 MB cada. Use fotos claras da quadra e estrutura.</span>
        <input
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          disabled={uploading || fotos.length >= 8}
          onChange={(event) => {
            uploadFotos(event.target.files)
            event.currentTarget.value = ''
          }}
        />
      </label>
      {uploading && <p className="mt-2 text-xs font-bold text-luva-amber">Enviando fotos...</p>}
      {error && <p className="mt-2 text-xs font-bold text-red-200">{error}</p>}
      {fotos.length > 0 && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {fotos.map((url) => (
            <div key={url} className="group relative overflow-hidden rounded-2xl border border-white/12 bg-white/[0.04]">
              <img src={url} alt="Foto da quadra" className="h-36 w-full object-cover" />
              <button
                type="button"
                onClick={() => removeFoto(url)}
                className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-[#071426]/90 text-white shadow-lg transition hover:bg-red-500"
                aria-label="Remover foto"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

type FieldProps = { form: FormState; setField: (name: string, value: string | boolean | string[]) => void }
type CepProps = { searchCep: () => Promise<void>; cepLoading: boolean; cepMessage: string | null }

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3.5 md:grid-cols-2">{children}</div>
}

function PasswordFields({ form, setField }: FieldProps) {
  const senha = String(form.senha || '')
  const confirmarSenha = String(form.confirmarSenha || '')
  const senhasDiferentes = confirmarSenha.length > 0 && senha !== confirmarSenha

  return (
    <>
      <Field label="Senha de acesso" required icon={<LockKeyhole size={17} />} className="md:col-span-2">
        <input
          required
          type="password"
          minLength={8}
          value={senha}
          onChange={(event) => setField('senha', event.target.value)}
          className={`${inputBase} [padding-left:2.75rem]`}
          placeholder="Mínimo 8 caracteres"
          autoComplete="new-password"
        />
      </Field>
      <Field label="Confirmar senha" required icon={<LockKeyhole size={17} />} className="md:col-span-2">
        <input
          required
          type="password"
          minLength={8}
          value={confirmarSenha}
          onChange={(event) => setField('confirmarSenha', event.target.value)}
          aria-invalid={senhasDiferentes}
          aria-describedby={senhasDiferentes ? 'password-mismatch' : undefined}
          className={`${inputBase} [padding-left:2.75rem] ${
            senhasDiferentes ? '!border-red-400 focus:!border-red-400 focus:!ring-red-400/20' : ''
          }`}
          placeholder="Repita a senha"
          autoComplete="new-password"
        />
        {senhasDiferentes && (
          <span id="password-mismatch" className="mt-2 block text-xs font-bold text-red-300" role="alert">
            As senhas não coincidem.
          </span>
        )}
      </Field>
    </>
  )
}

function Field({
  label,
  required,
  className = '',
  icon,
  hint,
  children,
}: {
  label: string
  required?: boolean
  className?: string
  icon?: React.ReactNode
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className={`auth-field block ${className}`}>
      <span className={labelBase}>
        {label}
        {required && <span className="text-luva-amber"> *</span>}
      </span>
      <span className="relative block">
        {icon && <span className="auth-field-icon pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-white/58">{icon}</span>}
        {children}
      </span>
      {hint && <span className="mt-1.5 block text-xs font-semibold leading-5 text-white/68">{hint}</span>}
    </label>
  )
}

function CepFeedback({ cepLoading, cepMessage }: { cepLoading: boolean; cepMessage: string | null }) {
  if (!cepLoading && !cepMessage) return null
  return (
    <p className="auth-cep-feedback md:col-span-2 rounded-xl border border-luva-amber/25 bg-luva-amber/10 px-3.5 py-2 text-xs font-bold text-white/78">
      {cepLoading ? 'Buscando endereço pelo CEP...' : cepMessage}
    </p>
  )
}

function ToggleGroup({
  title,
  names,
  form,
  setField,
}: {
  title: string
  names: { key: string; label: string }[]
  form: FormState
  setField: (name: string, value: boolean) => void
}) {
  return (
    <div className="md:col-span-2">
      <p className={labelBase}>{title}</p>
      <div className="grid gap-2 sm:grid-cols-3">
        {names.map((item) => {
          const active = Boolean(form[item.key])
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setField(item.key, !active)}
              className={`auth-choice-option rounded-2xl border px-4 py-3 text-sm font-black transition ${
                active
                  ? 'is-active border-luva-amber bg-luva-amber text-[#061322] shadow-[0_12px_34px_rgba(239,159,39,0.24)]'
                  : 'border-white/15 bg-white/[0.045] text-white/82 hover:border-luva-amber/70 hover:bg-white/[0.08] hover:text-white'
              }`}
            >
              {item.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function BinaryChoice({ title, value, onChange }: { title: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="md:col-span-2">
      <p className={labelBase}>{title}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {[
          { value: true, label: 'Sim' },
          { value: false, label: 'Não' },
        ].map((option) => {
          const active = value === option.value
          return (
            <button
              key={option.label}
              type="button"
              onClick={() => onChange(option.value)}
              className={`auth-choice-option rounded-2xl border px-4 py-3 text-sm font-black transition ${
                active
                  ? 'is-active border-luva-amber bg-luva-amber text-[#061322] shadow-[0_12px_34px_rgba(239,159,39,0.24)]'
                  : 'border-white/15 bg-white/[0.045] text-white/82 hover:border-luva-amber/70 hover:bg-white/[0.08] hover:text-white'
              }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function FeedbackBox({ feedback }: { feedback: { type: 'success' | 'error' | 'info'; text: string } }) {
  const styles = {
    success: 'auth-feedback-success',
    error: 'auth-feedback-error',
    info: 'auth-feedback-info',
  }

  return (
    <div className={`mt-6 flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm font-bold ${styles[feedback.type]}`}>
      {feedback.type === 'success' && <CheckCircle2 size={18} className="mt-0.5 shrink-0" />}
      <span>{feedback.text}</span>
    </div>
  )
}

const stepsByTipo = {
  equipe: [
    { title: 'Responsável', description: 'Informe responsável, e-mail e senha de acesso.' },
    { title: 'Equipe', description: 'Defina o nome e envie o emblema da equipe.' },
    { title: 'Perfil', description: 'Informe gênero, categoria, nível e rotina de treinos.' },
    { title: 'Estrutura', description: 'Informe disponibilidade, estrutura e envie para análise.' },
  ],
  arbitro: [
    { title: 'Dados pessoais', description: 'Informe seus dados principais para contato.' },
    { title: 'Experiência', description: 'Adicione registro, certificado ou comprovação quando tiver.' },
  ],
  // Só "Responsável" — os dados da organização (nome, cidade, logo) saíram
  // do cadastro e agora são preenchidos no onboarding pós-login (/painel),
  // reaproveitando o mesmo schema/validações via OrganizacaoForm.
  organizador: [{ title: 'Responsável', description: 'Informe dados de acesso e contato.' }],
  quadra: [
    { title: 'Contato', description: 'Identifique a arena e a pessoa responsável.' },
    { title: 'Local', description: 'Informe endereço e horários disponíveis.' },
    { title: 'Estrutura', description: 'Descreva recursos, espaço e diferenciais do local.' },
  ],
}

const endpointByTipo = {
  equipe: '/api/candidaturas/equipes',
  arbitro: '/api/candidaturas/arbitros',
  quadra: '/api/candidaturas/quadras',
  organizador: '/api/candidaturas/organizadores',
}

function getHorariosTreino(form: FormState): TrainingSchedule[] {
  if (!Boolean(form.possuiLocalTreino)) return []

  const treinoTotal = Math.max(1, Number(form.treinoTotal || 1))
  return Array.from({ length: treinoTotal }, (_, i) => i + 1)
    .map((index) => ({
      diaSemana: String(form[`treinoDia${index}`] || ''),
      horario: String(form[`treinoHora${index}`] || ''),
    }))
    .filter((item) => item.diaSemana && /^\d{2}:\d{2}$/.test(item.horario))
}

function validateCadastroStep(tipo: CadastroTipo, step: number, form: FormState) {
  if (tipo !== 'equipe') return ''

  if (step === 1 && !String(form.nome || '').trim()) {
    return 'Informe o nome da equipe para continuar.'
  }

  if (step === 1 && !String(form.emblemaUrl || '').trim()) {
    return 'Envie o emblema da equipe para continuar.'
  }

  if (step === 2 && Boolean(form.possuiLocalTreino) && getHorariosTreino(form).length === 0) {
    return 'Informe pelo menos um dia e horário de treino ou marque que a equipe não possui local fixo de treino.'
  }

  if (step === 2 && dias.every((dia) => !form[dia.key])) {
    return 'Selecione pelo menos um dia disponível para jogos.'
  }

  if (step === 2 && !form.manha && !form.tarde && !form.noite) {
    return 'Selecione pelo menos um período disponível para jogos.'
  }

  return ''
}

function payloadByTipo(tipo: CadastroTipo, form: FormState) {
  const senha = String(form.senha || '')
  const telefone = String(form.telefone || '').trim() || null

  if (tipo === 'equipe') {
    const genero = String(form.genero || 'MASCULINO')
    const possuiLocalTreino = Boolean(form.possuiLocalTreino)
    const horariosTreino = getHorariosTreino(form)

    return {
      nome: form.nome,
      responsavel: form.responsavel,
      email: form.email,
      telefone,
      senha,
      emblemaUrl: form.emblemaUrl,
      ligaId: form.ligaId ? Number(form.ligaId) : undefined,
      conviteToken: form.conviteToken || undefined,
      categoria: genero,
      serie: 'OURO',
      genero,
      categoriaEtaria: form.categoriaEtaria,
      nivel: form.nivel,
      possuiLocalTreino,
      horariosTreino,
      cederQuadra: Boolean(form.cederQuadra),
      temInstagram: Boolean(form.temInstagram),
      instagram: form.temInstagram ? String(form.instagram || '').replace(/^@/, '') : '',
      diasDisponiveis: dias.filter((dia) => form[dia.key]).map((dia) => dia.label),
      horarios: { manha: Boolean(form.manha), tarde: Boolean(form.tarde), noite: Boolean(form.noite) },
      quadraInfo: { cobertura: Boolean(form.cobertura), banheiro: Boolean(form.banheiro), piso: form.piso, cep: form.cep, endereco: form.endereco, bairro: form.bairro },
    }
  }
  if (tipo === 'arbitro') return { nome: form.nome, email: form.email, telefone, senha, cref: form.cref, diplomaUrl: form.diplomaUrl }
  if (tipo === 'organizador') {
    return { nome: form.nome, email: form.email, telefone, senha, plano: 'PADRAO' }
  }
  const quadraHorarioTotal = Math.max(1, Number(form.quadraHorarioTotal || 1))
  const horariosDisponiveis = Array.from({ length: quadraHorarioTotal }, (_, i) => i + 1)
    .map((index) => ({
      diaSemana: String(form[`quadraHorarioDia${index}`] || ''),
      horaInicio: String(form[`quadraHorarioInicio${index}`] || ''),
      horaFim: String(form[`quadraHorarioFim${index}`] || ''),
    }))
    .filter((item) => item.diaSemana && /^\d{2}:\d{2}$/.test(item.horaInicio) && /^\d{2}:\d{2}$/.test(item.horaFim))

  return {
    nome: form.nome,
    responsavel: form.responsavel,
    email: form.email,
    telefone,
    instagram: String(form.instagram || '').replace(/^@/, '').trim(),
    senha,
    cep: form.cep,
    endereco: form.endereco,
    bairro: form.bairro,
    estrutura: form.estrutura,
    horarios: { horariosDisponiveis },
    fotosUrls: Array.isArray(form.fotosQuadraUrls) ? form.fotosQuadraUrls : [],
    cobertura: Boolean(form.cobertura),
    banheiro: Boolean(form.banheiro),
    estacionamento: Boolean(form.estacionamento),
  }
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, '')
}

function formatPhone(value: string) {
  const digits = onlyDigits(value).slice(0, 11)
  if (digits.length <= 2) return digits ? `(${digits}` : ''
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

function formatCep(value: string) {
  const digits = onlyDigits(value).slice(0, 8)
  if (digits.length <= 5) return digits
  return `${digits.slice(0, 5)}-${digits.slice(5)}`
}

const categorias = [
  { value: 'MASCULINO', label: 'Masculino' },
  { value: 'FEMININO', label: 'Feminino' },
  { value: 'MISTO', label: 'Misto' },
]

const categoriasEtarias = [
  { value: 'SUB15', label: 'Sub 15' },
  { value: 'SUB18', label: 'Sub 18' },
  { value: 'SUB21', label: 'Sub 21' },
  { value: 'ADULTO', label: 'Adulto (+22)' },
  { value: 'MASTER', label: 'Master (+38)' },
]

const niveis = [
  { value: 'INICIANTE', label: 'Iniciante' },
  { value: 'INTERMEDIARIO', label: 'Intermediário' },
  { value: 'AVANCADO', label: 'Avançado' },
]

const diasSemanaOptions = [
  { value: 'Segunda', label: 'Segunda' },
  { value: 'Terca', label: 'Terça' },
  { value: 'Quarta', label: 'Quarta' },
  { value: 'Quinta', label: 'Quinta' },
  { value: 'Sexta', label: 'Sexta' },
  { value: 'Sabado', label: 'Sábado' },
  { value: 'Domingo', label: 'Domingo' },
]

const dias = [
  { key: 'segunda', label: 'Segunda' },
  { key: 'terca', label: 'Terça' },
  { key: 'quarta', label: 'Quarta' },
  { key: 'quinta', label: 'Quinta' },
  { key: 'sexta', label: 'Sexta' },
  { key: 'sabado', label: 'Sábado' },
  { key: 'domingo', label: 'Domingo' },
]

const horarios = [
  { key: 'manha', label: 'Manhã' },
  { key: 'tarde', label: 'Tarde' },
  { key: 'noite', label: 'Noite' },
]

const estruturaEquipe = [
  { key: 'cobertura', label: 'Coberta' },
  { key: 'banheiro', label: 'Banheiro' },
]

const estruturaQuadra = [
  { key: 'cobertura', label: 'Cobertura' },
  { key: 'banheiro', label: 'Banheiro' },
  { key: 'estacionamento', label: 'Estacionamento' },
]
