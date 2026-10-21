'use client'

import { useEffect, useReducer, useRef, useState } from 'react'
import { AlertCircle, KeyRound, Mail, MessageCircle } from 'lucide-react'
import { ActionBar } from '@/components/ui/action-bar'
import {
  codigoCompleto,
  descricaoDoPerfil,
  emailValido,
  ESTADO_INICIAL,
  loginWhatsappAtivo,
  MENSAGEM_UNIFORME,
  normalizarCodigo,
  normalizarTelefone,
  OPCOES_ONBOARDING,
  rotuloDoPerfil,
  rotuloReenvio,
  segundosRestantes,
  telefoneValido,
  TEXTO_CODIGO_ENVIADO,
  TEXTO_CONVITE_ATLETA,
  TITULO_ESCOLHA_PERFIL,
  TITULO_ONBOARDING,
  transicaoLogin,
  type Canal,
  type Perfil,
} from '@/lib/login-sem-senha-ui/regras'
import { confirmarCodigo, solicitarCodigo, trocarPerfil } from './cliente'

const campo = 'admin-login-input rounded-2xl px-4 py-4 text-base font-semibold outline-none transition'
const rotulo = 'text-xs font-black uppercase tracking-[0.18em] text-luva-amber'
const botaoPrimario = 'admin-login-button inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl px-5 py-4 text-sm font-black uppercase tracking-wide transition disabled:opacity-60'
const botaoContorno = 'inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border border-white/20 px-5 py-3 text-sm font-black uppercase tracking-wide text-white transition hover:bg-white/10'
const botaoLink = 'min-h-[44px] text-sm font-semibold text-slate-200 underline decoration-white/30 underline-offset-4 transition hover:text-white disabled:no-underline disabled:opacity-60'

function Erro({ texto }: { texto: string }) {
  return (
    <p role="alert" className="flex items-start gap-2 rounded-2xl border border-red-400/35 bg-red-500/14 px-4 py-3 text-sm font-bold leading-6 text-red-50">
      <AlertCircle className="mt-0.5 shrink-0 text-red-200" size={18} />
      <span>{texto}</span>
    </p>
  )
}

type Props = {
  /** Continuação já validada pelo chamador (ex.: voltar à inscrição). */
  continuar: string | null
  aoUsarSenha: () => void
}

export function LoginPorCodigo({ continuar, aoUsarSenha }: Props) {
  const [estado, enviar] = useReducer(transicaoLogin, ESTADO_INICIAL)
  // Volta do Google sem conta: o servidor manda /login?novaConta=1 e a sessão já é de onboarding.
  useEffect(() => {
    try {
      if (new URLSearchParams(window.location.search).get('novaConta') === '1') enviar({ tipo: 'confirmado', resultado: { tipo: 'novaConta' } })
    } catch {
      /* sem window ou URL inválida: segue no passo normal */
    }
  }, [])
  const [email, setEmail] = useState('')
  const [codigo, setCodigo] = useState('')
  const [canal, setCanal] = useState<Canal>('EMAIL')
  const [telefone, setTelefone] = useState('')
  const [agora, setAgora] = useState(() => Date.now())
  const [erroPerfil, setErroPerfil] = useState('')
  const [trocando, setTrocando] = useState(false)
  const [convite, setConvite] = useState(false)
  const campoCodigo = useRef<HTMLInputElement>(null)
  const whatsapp = loginWhatsappAtivo()
  const googleAtivo = true // este componente só monta com a flag ligada

  // Contagem do reenvio: só corre enquanto há contagem pendente.
  const libera = estado.passo === 'codigo' || estado.passo === 'confirmando' ? estado.liberaReenvioEm : 0
  useEffect(() => {
    if (!libera) return
    setAgora(Date.now())
    const id = window.setInterval(() => {
      const t = Date.now()
      setAgora(t)
      if (segundosRestantes(t, libera) === 0) window.clearInterval(id)
    }, 500)
    return () => window.clearInterval(id)
  }, [libera])

  useEffect(() => {
    if (estado.passo === 'codigo') campoCodigo.current?.focus()
  }, [estado.passo])

  // Redireciona ao concluir. Organizador: a sessão local mínima permite ao painel abrir.
  useEffect(() => {
    if (estado.passo !== 'concluido') return
    window.location.assign(estado.destino)
  }, [estado])

  // Envio do código (primeiro envio e reenvio).
  const enviando = estado.passo === 'enviando' ? estado.email : null
  useEffect(() => {
    if (!enviando) return
    let ativo = true
    void solicitarCodigo({ email: enviando, ...(canal === 'WHATSAPP' ? { canal, telefone: normalizarTelefone(telefone) } : {}) }).then((r) => {
      if (!ativo) return
      if (r.ok) {
        enviar({ tipo: 'enviado', agora: Date.now() })
        setCodigo('')
      } else enviar({ tipo: 'falhaEnvio', mensagem: r.mensagem })
    })
    return () => { ativo = false }
    // canal e telefone são lidos no momento do envio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enviando])

  // Confirmação do código.
  const confirmando = estado.passo === 'confirmando' ? estado.email : null
  useEffect(() => {
    if (!confirmando) return
    let ativo = true
    void confirmarCodigo(confirmando, codigo).then((r) => {
      if (!ativo) return
      if (!r.ok) {
        enviar({ tipo: 'falhaConfirmar', mensagem: r.mensagem })
        return
      }
      if (r.dados.tipo === 'perfis' && r.dados.perfis.length === 1 && r.dados.perfis[0].perfil === 'ORGANIZADOR') {
        try { window.localStorage.setItem('luva_session', JSON.stringify({ tipo: 'organizador', perfil: 'organizador', email: confirmando })) } catch { /* sem armazenamento local */ }
      }
      enviar({ tipo: 'confirmado', resultado: r.dados, continuar })
    })
    return () => { ativo = false }
    // o código é lido no momento da confirmação.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmando])

  function aoEnviarEmail(e: React.FormEvent) {
    e.preventDefault()
    if (canal === 'WHATSAPP' && !telefoneValido(telefone)) return
    enviar({ tipo: 'enviar', email })
  }

  function aoConfirmar(e: React.FormEvent) {
    e.preventDefault()
    if (!codigoCompleto(codigo)) return
    enviar({ tipo: 'confirmar' })
  }

  async function escolher(perfil: Perfil) {
    if (trocando) return
    setTrocando(true)
    setErroPerfil('')
    const r = await trocarPerfil(perfil)
    if (!r.ok) {
      setErroPerfil(r.mensagem)
      setTrocando(false)
      return
    }
    if (perfil.perfil === 'ORGANIZADOR') {
      try { window.localStorage.setItem('luva_session', JSON.stringify({ tipo: 'organizador', perfil: 'organizador' })) } catch { /* sem armazenamento local */ }
    } else {
      try { window.localStorage.removeItem('luva_session') } catch { /* sem armazenamento local */ }
    }
    enviar({ tipo: 'escolheu', perfil, continuar })
  }

  if (estado.passo === 'perfil') {
    return (
      <div className="grid gap-4">
        <h3 className="text-center text-2xl font-black text-white">{TITULO_ESCOLHA_PERFIL}</h3>
        <ul className="grid gap-3">
          {estado.perfis.map((p) => (
            <li key={`${p.perfil}:${p.referenciaId}`}>
              <button type="button" disabled={trocando} onClick={() => void escolher(p)} className={`${botaoContorno} !flex-col !items-start !normal-case !tracking-normal`}>
                <span className="text-base font-black">{rotuloDoPerfil(p)}</span>
                <span className="text-sm font-semibold text-slate-300">{descricaoDoPerfil(p.perfil)}</span>
              </button>
            </li>
          ))}
        </ul>
        {erroPerfil && <Erro texto={erroPerfil} />}
      </div>
    )
  }

  if (estado.passo === 'onboarding') {
    return (
      <div className="grid gap-4">
        <h3 className="text-center text-2xl font-black text-white">{TITULO_ONBOARDING}</h3>
        <ul className="grid gap-3">
          {OPCOES_ONBOARDING.map((o) => (
            <li key={o.id}>
              {o.href ? (
                <a href={o.href} className={`${botaoContorno} !flex-col !items-start !normal-case !tracking-normal`}>
                  <span className="text-base font-black">{o.titulo}</span>
                  <span className="text-sm font-semibold text-slate-300">{o.texto}</span>
                </a>
              ) : (
                <button type="button" aria-expanded={convite} onClick={() => setConvite((v) => !v)} className={`${botaoContorno} !flex-col !items-start !normal-case !tracking-normal`}>
                  <span className="text-base font-black">{o.titulo}</span>
                  <span className="text-sm font-semibold text-slate-300">{o.texto}</span>
                </button>
              )}
            </li>
          ))}
        </ul>
        {convite && <p role="status" className="text-sm font-semibold leading-6 text-slate-100">{TEXTO_CONVITE_ATLETA}</p>}
      </div>
    )
  }

  const reenviando = estado.passo === 'enviando' && Boolean(estado.reenvio)
  const noCodigo = estado.passo === 'codigo' || estado.passo === 'confirmando' || reenviando
  const ocupado = estado.passo === 'enviando' || estado.passo === 'confirmando' || estado.passo === 'concluido'

  if (noCodigo) {
    const restante = estado.passo === 'enviando' ? 0 : segundosRestantes(agora, estado.liberaReenvioEm)
    const erro = estado.passo === 'codigo' ? estado.erro : undefined
    return (
      <form onSubmit={aoConfirmar} className="grid gap-4" noValidate>
        <p className="text-sm font-semibold leading-6 text-slate-200">
          {TEXTO_CODIGO_ENVIADO} <span className="break-all">{estado.email}</span>
        </p>
        <p role="status" className="text-xs font-semibold leading-5 text-slate-300">{MENSAGEM_UNIFORME}</p>
        <label className="grid gap-2">
          <span className={rotulo}>Código</span>
          <input
            ref={campoCodigo}
            name="codigo"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={12}
            required
            disabled={ocupado}
            value={codigo}
            onChange={(ev) => setCodigo(normalizarCodigo(ev.target.value))}
            onPaste={(ev) => {
              ev.preventDefault()
              setCodigo(normalizarCodigo(ev.clipboardData.getData('text')))
            }}
            aria-invalid={erro ? true : undefined}
            className={`${campo} text-center text-2xl tracking-[0.5em]`}
            placeholder="000000"
          />
        </label>
        {erro && <Erro texto={erro} />}
        <ActionBar type="submit" loading={estado.passo === 'confirmando'} loadingLabel="Entrando" disabled={!codigoCompleto(codigo)} className={botaoPrimario}>
          <KeyRound size={18} />
          Entrar
        </ActionBar>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button type="button" className={botaoLink} disabled={restante > 0 || ocupado} onClick={() => enviar({ tipo: 'reenviar', agora: Date.now() })}>
            {rotuloReenvio(restante)}
          </button>
          <button type="button" className={botaoLink} disabled={ocupado} onClick={() => { setCodigo(''); enviar({ tipo: 'trocarEmail' }) }}>
            Trocar e-mail
          </button>
        </div>
      </form>
    )
  }

  const erroEmail = estado.passo === 'email' ? estado.erro : undefined
  return (
    <div className="grid gap-4">
      <form onSubmit={aoEnviarEmail} className="grid gap-4" noValidate>
        <label className="grid gap-2">
          <span className={rotulo}>E-mail</span>
          <input
            name="email-codigo"
            type="email"
            required
            disabled={ocupado}
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            aria-invalid={erroEmail ? true : undefined}
            className={campo}
            placeholder="voce@exemplo.com"
          />
        </label>
        {whatsapp && (
          <fieldset className="grid gap-2">
            <legend className={rotulo}>Receber o código por</legend>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" aria-pressed={canal === 'EMAIL'} onClick={() => setCanal('EMAIL')} className={`${botaoContorno} ${canal === 'EMAIL' ? 'bg-white/15' : ''}`}>
                <Mail size={16} /> E-mail
              </button>
              <button type="button" aria-pressed={canal === 'WHATSAPP'} onClick={() => setCanal('WHATSAPP')} className={`${botaoContorno} ${canal === 'WHATSAPP' ? 'bg-white/15' : ''}`}>
                <MessageCircle size={16} /> WhatsApp
              </button>
            </div>
            {canal === 'WHATSAPP' && (
              <label className="grid gap-2">
                <span className={rotulo}>Telefone com DDD</span>
                <input
                  name="telefone-codigo"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  disabled={ocupado}
                  value={telefone}
                  onChange={(ev) => setTelefone(ev.target.value)}
                  aria-invalid={telefone !== '' && !telefoneValido(telefone) ? true : undefined}
                  className={campo}
                  placeholder="(11) 91234-5678"
                />
              </label>
            )}
          </fieldset>
        )}
        {erroEmail && <Erro texto={erroEmail} />}
        <ActionBar
          type="submit"
          loading={estado.passo === 'enviando'}
          loadingLabel="Enviando"
          disabled={!emailValido(email) || (canal === 'WHATSAPP' && !telefoneValido(telefone))}
          className={botaoPrimario}
        >
          <Mail size={18} />
          Enviar código
        </ActionBar>
      </form>
      {googleAtivo && (
        <a href="/api/auth/google/inicio" className={botaoContorno}>
          Entrar com Google
        </a>
      )}
      <button type="button" className={`${botaoLink} text-center`} onClick={aoUsarSenha}>
        Prefiro usar senha
      </button>
    </div>
  )
}
