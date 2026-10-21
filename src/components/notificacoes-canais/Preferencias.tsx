'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Aviso, botaoPrimario, botaoSecundario, Carregando, cartao, FalhaTela, falhaDe, useCarregar } from '@/components/meu-time/ui'
import {
  CANAIS,
  chaveVapidParaBytes,
  chaveVapidValida,
  comPreferencia,
  corpoDaAssinatura,
  estadoDoPush,
  suportaPush,
  textoDoPush,
  textoFalhaPush,
  textoResultadoPermissao,
  tiposDisponiveis,
  valorDaPreferencia,
  type AmbientePush,
  type Canal,
  type EstadoPush,
  type FalhaPush,
  type Preferencia,
} from '@/lib/notificacoes-canais-ui/regras'
import { obterClienteCanais, type ClienteCanais } from './cliente'

const SW_URL = '/sw.js'

function lerAmbiente(assinado: boolean): AmbientePush {
  const temNotification = typeof Notification !== 'undefined'
  return {
    temServiceWorker: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
    temPushManager: typeof window !== 'undefined' && 'PushManager' in window,
    temNotification,
    contextoSeguro: typeof window !== 'undefined' && window.isSecureContext,
    permissao: temNotification ? Notification.permission : null,
    assinado,
  }
}

/** Botão que registra o aparelho. A permissão só é pedida dentro do clique. */
export function AvisosNoAparelho({ cliente }: { cliente?: ClienteCanais }) {
  const api = cliente ?? obterClienteCanais()
  const [estado, setEstado] = useState<EstadoPush | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [retorno, setRetorno] = useState<{ tom: 'is-success' | 'is-error' | 'is-warning'; texto: string } | null>(null)

  // Só olha o que o navegador já sabe. Não pede permissão nem chama o servidor.
  useEffect(() => {
    let vivo = true
    async function ler() {
      const base = lerAmbiente(false)
      if (!suportaPush(base)) {
        if (vivo) setEstado(estadoDoPush(base))
        return
      }
      let assinado = false
      try {
        const reg = await navigator.serviceWorker.getRegistration(SW_URL)
        assinado = !!(await reg?.pushManager.getSubscription())
      } catch {
        assinado = false
      }
      if (vivo) setEstado(estadoDoPush(lerAmbiente(assinado)))
    }
    void ler()
    return () => {
      vivo = false
    }
  }, [])

  const ativar = useCallback(async () => {
    setOcupado(true)
    setRetorno(null)
    const falhar = (f: FalhaPush) => setRetorno({ tom: 'is-error', texto: textoFalhaPush(f) })
    try {
      if (!suportaPush(lerAmbiente(false))) {
        setEstado('sem-suporte')
        return
      }
      // 1) Permissão: só aqui, depois do toque.
      const permissao = await Notification.requestPermission()
      if (permissao !== 'granted') {
        setEstado(permissao === 'denied' ? 'negada' : 'pronta')
        setRetorno({ tom: 'is-warning', texto: textoResultadoPermissao(permissao) })
        return
      }
      // 2) Chave pública do servidor.
      let chave = ''
      try {
        chave = await api.obterChavePublica()
      } catch (e) {
        const f = falhaDe(e)
        falhar(f.tipo === 'rede' ? 'rede' : 'chave')
        setEstado('concedida')
        return
      }
      const bytes = chaveVapidValida(chave) ? chaveVapidParaBytes(chave) : null
      if (!bytes) {
        falhar('chave')
        setEstado('concedida')
        return
      }
      // 3) Service worker e assinatura.
      let assinatura: PushSubscription
      try {
        const reg = await navigator.serviceWorker.register(SW_URL)
        await navigator.serviceWorker.ready
        assinatura = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes as BufferSource }))
      } catch {
        falhar('assinatura')
        setEstado('concedida')
        return
      }
      const corpo = corpoDaAssinatura(assinatura.toJSON())
      if (!corpo) {
        falhar('assinatura')
        setEstado('concedida')
        return
      }
      // 4) Envia ao servidor.
      try {
        await api.assinar(corpo)
      } catch (e) {
        falhar(falhaDe(e).tipo === 'rede' ? 'rede' : 'servidor')
        setEstado('concedida')
        return
      }
      setEstado('ativa')
      setRetorno({ tom: 'is-success', texto: textoResultadoPermissao('granted') })
    } finally {
      setOcupado(false)
    }
  }, [api])

  const desativar = useCallback(async () => {
    setOcupado(true)
    setRetorno(null)
    try {
      const reg = await navigator.serviceWorker.getRegistration(SW_URL)
      const sub = await reg?.pushManager.getSubscription()
      if (sub) {
        const endpoint = sub.endpoint
        await api.cancelarAssinatura(endpoint)
        await sub.unsubscribe()
      }
      setEstado('concedida')
      setRetorno({ tom: 'is-success', texto: 'Avisos desativados neste aparelho.' })
    } catch (e) {
      setRetorno({ tom: 'is-error', texto: falhaDe(e).mensagem })
    } finally {
      setOcupado(false)
    }
  }, [api])

  if (!estado) return <Carregando texto="Verificando este aparelho…" />
  const t = textoDoPush(estado)
  return (
    <section className={`${cartao} flex flex-col gap-3`} aria-labelledby="push-titulo">
      <h2 id="push-titulo" className="text-lg font-black">{t.titulo}</h2>
      <p className="text-base text-[var(--vs-muted)]">{t.explicacao}</p>
      {t.botao && (
        <button type="button" className={estado === 'ativa' ? botaoSecundario : botaoPrimario} disabled={ocupado} onClick={() => void (estado === 'ativa' ? desativar() : ativar())}>
          {ocupado ? 'Aguarde…' : t.botao}
        </button>
      )}
      <div aria-live="polite">{retorno && <Aviso tom={retorno.tom} alerta={retorno.tom === 'is-error'}>{retorno.texto}</Aviso>}</div>
    </section>
  )
}

function Interruptor({ id, rotulo, marcado, desabilitado, aoMudar }: { id: string; rotulo: string; marcado: boolean; desabilitado: boolean; aoMudar: (v: boolean) => void }) {
  return (
    <label htmlFor={id} className="flex min-h-[48px] items-center justify-between gap-3 text-base">
      <span>{rotulo}</span>
      <input id={id} type="checkbox" role="switch" className="h-6 w-6 shrink-0 accent-[var(--vs-gold)]" checked={marcado} disabled={desabilitado} onChange={(e) => aoMudar(e.target.checked)} />
    </label>
  )
}

export function PreferenciasTela({ cliente }: { cliente?: ClienteCanais }) {
  const api = cliente ?? obterClienteCanais()
  const { carga, tentarDeNovo } = useCarregar(() => api.listarPreferencias())
  const [prefs, setPrefs] = useState<Preferencia[] | null>(null)
  const [salvando, setSalvando] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const vivo = useRef(true)

  useEffect(() => {
    vivo.current = true
    return () => {
      vivo.current = false
    }
  }, [])

  useEffect(() => {
    if (carga.estado === 'pronto') setPrefs((atual) => atual ?? carga.dados)
  }, [carga])

  async function mudar(canal: Canal, tipo: string, ativo: boolean) {
    if (!prefs) return
    const chave = `${canal}:${tipo}`
    const anterior = prefs
    setSalvando(chave)
    setErro(null)
    setOk(false)
    setPrefs(comPreferencia(prefs, { canal, tipo, ativo }))
    try {
      await api.salvarPreferencia({ canal, tipo, ativo })
      if (vivo.current) setOk(true)
    } catch (e) {
      if (vivo.current) {
        setPrefs(anterior)
        setErro(falhaDe(e).mensagem)
      }
    } finally {
      if (vivo.current) setSalvando(null)
    }
  }

  const tipos = tiposDisponiveis(prefs ?? [])
  return (
    <div className="flex flex-col gap-4">
      <p className="text-base text-[var(--vs-muted)]">Escolha por onde e sobre o que você quer ser avisado.</p>
      <AvisosNoAparelho cliente={cliente} />
      {carga.estado === 'carregando' && <Carregando texto="Carregando suas preferências…" />}
      {carga.estado === 'falha' && <FalhaTela falha={carga.falha} aoTentar={tentarDeNovo} />}
      <div aria-live="polite" className="flex flex-col gap-2">
        {erro && <Aviso tom="is-error" alerta>{erro}</Aviso>}
        {ok && !erro && <Aviso tom="is-success">Preferência salva.</Aviso>}
      </div>
      {prefs && (
        <ul className="flex flex-col gap-3" aria-label="Canais de aviso">
          {CANAIS.map((c) => (
            <li key={c.canal}>
              <fieldset className={`${cartao} flex flex-col gap-1`}>
                <legend className="px-1 text-lg font-black">{c.rotulo}</legend>
                <p className="text-sm text-[var(--vs-muted)]">{c.explicacao}</p>
                {tipos.map((t) => {
                  const id = `pref-${c.canal}-${t.tipo}`
                  return (
                    <Interruptor
                      key={t.tipo}
                      id={id}
                      rotulo={t.rotulo}
                      marcado={valorDaPreferencia(prefs, c.canal, t.tipo)}
                      desabilitado={salvando === `${c.canal}:${t.tipo}`}
                      aoMudar={(v) => void mudar(c.canal, t.tipo, v)}
                    />
                  )
                })}
              </fieldset>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
