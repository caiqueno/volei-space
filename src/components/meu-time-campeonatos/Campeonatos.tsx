'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  conviteParaCategoria,
  guardarEntrada,
  hrefContinuacao,
  hrefCriarTime,
  inscricaoViaMeuTimeAtiva,
  lerEntradaDaUrl,
  lerEntradaGuardada,
  limparEntradaGuardada,
  mesclarOfertas,
  normalizarEntrada,
  ofertasDaEntrada,
  proximosPassos,
  type Entrada,
  type LeituraEntrada,
} from '@/lib/inscricao-entrada-ui/regras'
import { extrairData } from '@/lib/meu-time-ui/respostas'
import { ErroMeuTime } from '@/components/meu-time/cliente'
import { Aviso, botaoPerigo, botaoPrimario, botaoSecundario, Campo, campoEstilo, Carregando, cartao, FalhaTela, falhaDe, Pagina } from '@/components/meu-time/ui'
import { SeletorEquipe } from '@/components/meu-time-fase2/Comum'
import type { Falha } from '@/lib/meu-time-ui/respostas'
import {
  AJUDA_MODO,
  botaoDaOferta,
  codigoPedeRecarregar,
  maximoParaEscolha,
  mensagemErroSolicitacao,
  inscricaoSolicitacaoAtiva,
  LIMITE_MENSAGEM,
  mensagemRetorno,
  prepararMensagem,
  ROTULO_MODO,
  textoConfirmacao,
  textoSituacao,
  type AtletaDoBanco,
  type OfertaCampeonato,
} from '@/lib/meu-time-campeonatos-ui/regras'
import { obterClienteCampeonatos, type ClienteCampeonatos } from './cliente'
import { SeletorAtletas } from './SeletorAtletas'

const SELO_MODO = {
  AUTOMATICA: 'border-[var(--vs-border-strong)] text-[var(--vs-text)]',
  APROVACAO: 'border-[var(--vs-gold)] text-[var(--vs-gold)]',
} as const

type Retorno = { tom: 'is-success' | 'is-error'; texto: string }

/** Resultado do envio. `escolher` = máximo de atletas, quando o líder precisa escolher quem entra. */
type ResultadoEnvio = { ok: boolean; escolher?: number }

function Oferta({
  oferta,
  equipeNome,
  ocupado,
  aoConfirmar,
  aoCancelar,
  carregarAtletas,
  abrirAuto = false,
}: {
  abrirAuto?: boolean
  oferta: OfertaCampeonato
  equipeNome: string
  ocupado: boolean
  aoConfirmar: (o: OfertaCampeonato, mensagem?: string, atletas?: string[]) => Promise<ResultadoEnvio>
  aoCancelar: (o: OfertaCampeonato) => Promise<void>
  carregarAtletas: () => Promise<AtletaDoBanco[]>
}) {
  const botao = botaoDaOferta(oferta)
  const [confirmando, setConfirmando] = useState(abrirAuto)
  const [mensagem, setMensagem] = useState('')
  const [maximoEscolha, setMaximoEscolha] = useState<number | null>(null)
  const idBase = `oferta-${oferta.categoriaId}`
  const gatilho = useRef<HTMLButtonElement>(null)
  const primeiro = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (confirmando) primeiro.current?.focus()
  }, [confirmando])

  function fechar() {
    setConfirmando(false)
    setMensagem('')
    setMaximoEscolha(null)
    gatilho.current?.focus()
  }

  return (
    <li className={`${cartao} flex flex-col gap-3`}>
      <div>
        <h2 className="font-display text-xl font-black leading-tight">{oferta.campeonato}</h2>
        <p className="text-base text-[var(--vs-muted)]">
          {oferta.categoria}
          {oferta.naipe ? ` · ${oferta.naipe.charAt(0)}${oferta.naipe.slice(1).toLowerCase()}` : ''}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full border px-3 py-1 text-sm font-bold ${SELO_MODO[oferta.modo]}`}>{ROTULO_MODO[oferta.modo]}</span>
        <span className="rounded-full bg-[var(--vs-elevated)] px-3 py-1 text-sm font-bold">{textoSituacao(oferta)}</span>
      </div>

      {botao.acao === null && <p className="text-sm text-[var(--vs-muted)]">{botao.motivo}</p>}

      {botao.acao === 'CANCELAR' && (
        <button type="button" className={`${botaoPerigo} self-start`} disabled={ocupado} onClick={() => void aoCancelar(oferta)}>
          {botao.rotulo}
        </button>
      )}

      {(botao.acao === 'INSCREVER' || botao.acao === 'SOLICITAR') && !confirmando && (
        <button ref={gatilho} type="button" className={botaoPrimario} disabled={ocupado} onClick={() => setConfirmando(true)}>
          {botao.rotulo}
        </button>
      )}

      {(botao.acao === 'INSCREVER' || botao.acao === 'SOLICITAR') && confirmando && (
        <div
          role="group"
          aria-labelledby={`${idBase}-confirma`}
          onKeyDown={(e) => e.key === 'Escape' && !ocupado && fechar()}
          className="flex flex-col gap-3 rounded-xl border border-[var(--vs-border-strong)] bg-[var(--vs-bg)] p-3"
        >
          <p id={`${idBase}-confirma`} className="font-bold">{textoConfirmacao(oferta, equipeNome)}</p>
          <p className="text-sm text-[var(--vs-muted)]">{AJUDA_MODO[oferta.modo]}</p>
          {botao.acao === 'SOLICITAR' && (
            <Campo id={`${idBase}-msg`} rotulo="Mensagem para o organizador (opcional)">
              <textarea
                id={`${idBase}-msg`}
                className={`${campoEstilo} min-h-[96px]`}
                maxLength={LIMITE_MENSAGEM}
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
              />
            </Campo>
          )}
          {maximoEscolha !== null ? (
            <SeletorAtletas
              idBase={idBase}
              maximo={maximoEscolha}
              ocupado={ocupado}
              carregar={carregarAtletas}
              aoEnviar={async (ids) => {
                const r = await aoConfirmar(oferta, prepararMensagem(mensagem), ids)
                if (r.escolher !== undefined) setMaximoEscolha(r.escolher)
                else fechar()
              }}
              aoVoltar={() => setMaximoEscolha(null)}
            />
          ) : (
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              ref={primeiro}
              type="button"
              className={botaoPrimario}
              disabled={ocupado}
              onClick={async () => {
                const r = await aoConfirmar(oferta, prepararMensagem(mensagem))
                if (r.escolher !== undefined) {
                  setMaximoEscolha(r.escolher)
                  return
                }
                setConfirmando(false)
                setMensagem('')
              }}
            >
              {ocupado ? 'Enviando…' : botao.acao === 'INSCREVER' ? 'Sim, inscrever' : 'Sim, enviar pedido'}
            </button>
            <button type="button" className={botaoSecundario} disabled={ocupado} onClick={fechar}>
              Voltar
            </button>
          </div>
          )}
        </div>
      )}
    </li>
  )
}

export function CampeonatosTela({ cliente }: { cliente?: ClienteCampeonatos }) {
  const api = cliente ?? obterClienteCampeonatos()
  const via = inscricaoViaMeuTimeAtiva()
  const ativo = inscricaoSolicitacaoAtiva() || via
  const [leitura, setLeitura] = useState<LeituraEntrada>({})
  const [entrada, setEntrada] = useState<Entrada | null>(null)
  const [conviteInvalido, setConviteInvalido] = useState(false)
  const [concluida, setConcluida] = useState<{ equipeId: string; estado: 'INSCRITA' | 'PENDENTE' } | null>(null)
  const [equipeId, setEquipeId] = useState('')
  const [equipeNome, setEquipeNome] = useState('seu time')
  const [ofertas, setOfertas] = useState<OfertaCampeonato[] | null>(null)
  const [falha, setFalha] = useState<Falha | null>(null)
  const [retorno, setRetorno] = useState<Retorno | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const pedido = useRef(0)

  const carregar = useCallback(async () => {
    if (!equipeId) {
      setOfertas(null)
      return
    }
    const n = ++pedido.current
    try {
      const lista = await api.listarOfertas(equipeId)
      if (n === pedido.current) {
        setOfertas(via && entrada ? mesclarOfertas(lista, ofertasDaEntrada(entrada, leitura.categoria)) : lista)
        setFalha(null)
      }
    } catch (e) {
      if (n === pedido.current) setFalha(falhaDe(e))
    }
  }, [api, equipeId, via, entrada, leitura.categoria])

  useEffect(() => {
    if (!ativo) return
    setOfertas(null)
    setFalha(null)
    setRetorno(null)
    void carregar()
  }, [ativo, carregar])

  // Lê `?categoria=&entrada=`; o token do convite fica só em memória e no sessionStorage, fora da URL.
  useEffect(() => {
    if (!via) return
    const params = new URLSearchParams(window.location.search)
    const daUrl = lerEntradaDaUrl((k) => params.get(k))
    if (daUrl.entrada) {
      guardarEntrada(daUrl)
      params.delete('entrada')
      const resto = params.toString()
      window.history.replaceState(null, '', `${window.location.pathname}${resto ? `?${resto}` : ''}`)
      setLeitura(daUrl)
    } else {
      setLeitura({ ...lerEntradaGuardada(), ...(daUrl.categoria ? { categoria: daUrl.categoria } : {}) })
    }
  }, [via])

  useEffect(() => {
    if (!via || !leitura.entrada) return
    let vivo = true
    setConviteInvalido(false)
    fetch(`/api/inscricao/entrada/${encodeURIComponent(leitura.entrada)}`, { cache: 'no-store', credentials: 'same-origin' })
      .then(async (res) => {
        let json: unknown = null
        try {
          json = await res.json()
        } catch {
          json = null
        }
        const e = res.ok ? normalizarEntrada(extrairData<unknown>(json)) : null
        if (!vivo) return
        setEntrada(e)
        setConviteInvalido(!e)
      })
      .catch(() => {
        if (vivo) setConviteInvalido(true)
      })
    return () => { vivo = false }
  }, [via, leitura.entrada])

  const carregarAtletas = useCallback(() => api.listarAtletas(equipeId), [api, equipeId])

  // Flag desligada: nada novo aparece e nenhuma requisição sai.
  if (!ativo) {
    return (
      <Pagina titulo="Campeonatos" voltar={{ href: '/meu-time', texto: 'Voltar aos meus times' }}>
        <Aviso>Esta função ainda não está disponível para você. Assim que estiver, é só voltar aqui.</Aviso>
      </Pagina>
    )
  }

  async function aoConfirmar(o: OfertaCampeonato, mensagem?: string, atletas?: string[]): Promise<ResultadoEnvio> {
    setOcupado(o.categoriaId)
    setRetorno(null)
    try {
      const convite = via ? conviteParaCategoria(entrada, leitura.entrada, o.categoriaId) : undefined
      const r = await api.solicitar(equipeId, o.categoriaId, mensagem, atletas, convite)
      setRetorno({ tom: 'is-success', texto: mensagemRetorno(r.estado, o.modo) })
      if (via) {
        setConcluida({ equipeId, estado: r.estado })
        if (convite) limparEntradaGuardada()
      }
    } catch (e) {
      const f = falhaDe(e)
      setRetorno({ tom: 'is-error', texto: mensagemErroSolicitacao(f) })
      const escolher = maximoParaEscolha(f)
      if (escolher !== null) {
        setOcupado(null)
        return { ok: false, escolher }
      }
      if (!(e instanceof ErroMeuTime) || (!codigoPedeRecarregar(f.codigo) && f.tipo !== 'conflito')) {
        setOcupado(null)
        return { ok: false }
      }
      await carregar()
      setOcupado(null)
      return { ok: false }
    }
    await carregar()
    setOcupado(null)
    return { ok: true }
  }

  async function aoCancelar(o: OfertaCampeonato) {
    if (!o.solicitacaoId) return
    setOcupado(o.categoriaId)
    setRetorno(null)
    try {
      await api.cancelarSolicitacao(o.solicitacaoId)
      setRetorno({ tom: 'is-success', texto: 'Pedido cancelado. Você pode pedir de novo quando quiser.' })
    } catch (e) {
      setRetorno({ tom: 'is-error', texto: falhaDe(e).mensagem })
    }
    await carregar()
    setOcupado(null)
  }

  return (
    <Pagina titulo="Campeonatos" voltar={{ href: '/meu-time', texto: 'Voltar aos meus times' }}>
      <p className="text-base text-[var(--vs-muted)]">Escolha o time e veja onde ele pode se inscrever.</p>
      <SeletorEquipe id="equipe-campeonatos" valor={equipeId} aoMudar={setEquipeId} rotulo="Qual time vai participar?" />
      <EquipeNome onNome={setEquipeNome} equipeId={equipeId} />
      {via && leitura.entrada && (
        <p className="text-base text-[var(--vs-muted)]">
          Ainda não tem time?{' '}
          <Link href={hrefCriarTime(hrefContinuacao(leitura.entrada, leitura.categoria))} className="font-bold underline">Criar meu time</Link>
          {' '}e volte aqui para terminar a inscrição.
        </p>
      )}
      {via && conviteInvalido && (
        <Aviso tom="is-error" alerta>Este convite não vale mais ou expirou. Peça um link novo ao organizador. Abaixo estão os campeonatos abertos para o seu time.</Aviso>
      )}

      <div aria-live="polite" className="flex flex-col gap-2">
        {retorno && <Aviso tom={retorno.tom} alerta={retorno.tom === 'is-error'}>{retorno.texto}</Aviso>}
      </div>
      {via && concluida && (
        <div className={`${cartao} flex flex-col gap-2`}>
          <h2 className="text-xl font-black">Próximos passos</h2>
          <p className="text-[var(--vs-muted)]">
            {concluida.estado === 'INSCRITA' ? 'Agora complete o time para ele poder jogar.' : 'Enquanto o organizador analisa, deixe o time pronto.'}
          </p>
          {proximosPassos(concluida.equipeId).map((p) => (
            <Link key={p.href} href={p.href} className={botaoPrimario}>{p.rotulo}</Link>
          ))}
        </div>
      )}

      {equipeId && !ofertas && !falha && <Carregando texto="Buscando campeonatos abertos…" />}
      {falha && <FalhaTela falha={falha} aoTentar={() => void carregar()} />}
      {ofertas && ofertas.length === 0 && <Aviso>Não há campeonatos abertos para este time agora. Volte aqui mais tarde.</Aviso>}
      {ofertas && ofertas.length > 0 && (
        <ul className="flex flex-col gap-3" aria-label="Campeonatos e categorias">
          {ofertas.map((o) => (
            <Oferta key={o.categoriaId} abrirAuto={via && !concluida && leitura.categoria === o.categoriaId} oferta={o} equipeNome={equipeNome} ocupado={ocupado === o.categoriaId} aoConfirmar={aoConfirmar} aoCancelar={aoCancelar} carregarAtletas={carregarAtletas} />
          ))}
        </ul>
      )}
    </Pagina>
  )
}

/** Descobre o nome do time escolhido (o seletor só devolve o id) para a frase de confirmação. */
function EquipeNome({ equipeId, onNome }: { equipeId: string; onNome: (n: string) => void }) {
  useEffect(() => {
    if (!equipeId) return
    const sel = document.getElementById('equipe-campeonatos') as HTMLSelectElement | null
    const nome = sel?.selectedOptions[0]?.textContent?.trim()
    onNome(nome || 'seu time')
  }, [equipeId, onNome])
  return null
}
