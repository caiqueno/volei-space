'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { obterClientePadrao, type MeuTimeClient } from './cliente'
import { PassoAtletas } from './PassoAtletas'
import { Aviso, botaoPrimario, botaoSecundario, Carregando, cartao, FalhaTela, falhaDe, Pagina, useCarregar } from './ui'
import { NAIPE_ROTULO } from './rotulos'
import {
  apagarRascunho,
  carregarRascunho,
  chaveRascunho,
  guardarRascunho,
  rascunhoVazio,
  reconciliarRascunho,
  type RascunhoAssistente,
} from '@/lib/meu-time-ui/rascunho'
import { descreverStatusInscricao, type Falha } from '@/lib/meu-time-ui/respostas'
import { avisosDeEnvio, lerRegras, montarInscricao, problemasDeEnvio } from '@/lib/meu-time-ui/selecao'
import type { DetalheEquipe, RespostaInscricao } from '@/lib/meu-time-ui/tipos'

const TITULOS = ['Confirmar o time', 'Escolher atletas', 'Comissão técnica', 'Revisar e enviar'] as const

function horaAgora() {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function AssistenteInscricao({ equipeId, cliente }: { equipeId: string; cliente?: MeuTimeClient }) {
  const api = cliente ?? obterClientePadrao()
  const params = useSearchParams()
  const categoria = params.get('categoria')
  const { carga, tentarDeNovo } = useCarregar(() => api.obterEquipe(equipeId))
  const voltar = { href: `/meu-time/${encodeURIComponent(equipeId)}`, texto: 'Voltar para o time' }

  if (carga.estado === 'carregando') return <Pagina titulo="Inscrever meu time"><Carregando texto="Preparando a inscrição…" /></Pagina>
  if (carga.estado === 'falha') return <Pagina titulo="Inscrever meu time" voltar={{ href: '/meu-time', texto: 'Voltar para meus times' }}><FalhaTela falha={carga.falha} aoTentar={tentarDeNovo} /></Pagina>
  if (!categoria) {
    return (
      <Pagina titulo="Inscrever meu time" voltar={voltar}>
        <Aviso tom="is-warning">
          <strong className="block">Falta saber em qual categoria inscrever.</strong>
          Abra o link de convite que o organizador mandou (por exemplo, no WhatsApp). Ele já traz a categoria certa. Seu time e seus atletas continuam salvos.
        </Aviso>
        <Link href={voltar.href} className={botaoSecundario}>Voltar para o time</Link>
      </Pagina>
    )
  }
  return (
    <Assistente
      key={`${equipeId}-${categoria}`} api={api} equipeId={equipeId} categoria={categoria}
      detalhe={carga.dados} regras={lerRegras((c) => params.get(c))}
    />
  )
}

type PropsAssistente = {
  api: MeuTimeClient
  equipeId: string
  categoria: string
  detalhe: DetalheEquipe
  regras: ReturnType<typeof lerRegras>
}

function Assistente({ api, equipeId, categoria, detalhe, regras }: PropsAssistente) {
  const chave = chaveRascunho(equipeId, categoria)
  const { equipe, atletas, comissao } = detalhe
  const [rascunho, setRascunho] = useState<RascunhoAssistente>(rascunhoVazio)
  const [pronto, setPronto] = useState(false)
  const [salvoEm, setSalvoEm] = useState<string | null>(null)
  const [semArmazenamento, setSemArmazenamento] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [falha, setFalha] = useState<Falha | null>(null)
  const [enviada, setEnviada] = useState<RespostaInscricao | null>(null)
  const emEnvio = useRef(false)
  const tituloRef = useRef<HTMLHeadingElement>(null)
  const primeiraRenderizacao = useRef(true)

  // Retoma o rascunho guardado no aparelho (se houver), descartando o que já não existe no time.
  useEffect(() => {
    const guardado = carregarRascunho(chave)
    if (guardado) setRascunho(reconciliarRascunho(guardado, atletas, comissao))
    setPronto(true)
    // Só na abertura: depois disso o estado da tela manda e o salvamento acompanha.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave])

  // Salva sozinho a cada mudança.
  useEffect(() => {
    if (!pronto || enviada) return
    const ok = guardarRascunho(chave, rascunho)
    setSemArmazenamento(!ok)
    if (ok) setSalvoEm(horaAgora())
  }, [rascunho, pronto, chave, enviada])

  // Leva o foco ao título do passo para quem usa leitor de tela ou teclado.
  useEffect(() => {
    if (primeiraRenderizacao.current) { primeiraRenderizacao.current = false; return }
    tituloRef.current?.focus()
  }, [rascunho.passo, enviada])

  const problemas = problemasDeEnvio(rascunho.escolhas, atletas, regras)
  const avisos = avisosDeEnvio(rascunho.escolhas, atletas, regras)
  const nomePor = useMemo(() => new Map(atletas.map((a) => [a.id, a.nome])), [atletas])

  const irPara = (passo: RascunhoAssistente['passo']) => setRascunho((r) => ({ ...r, passo }))
  const voltar = { href: `/meu-time/${encodeURIComponent(equipeId)}`, texto: 'Voltar para o time' }

  async function enviar() {
    if (emEnvio.current || problemas.length > 0 || !rascunho.aceite) return
    emEnvio.current = true
    setEnviando(true)
    setFalha(null)
    try {
      const resposta = await api.inscrever(equipeId, montarInscricao(categoria, rascunho.escolhas, rascunho.comissao))
      apagarRascunho(chave)
      setEnviada(resposta)
    } catch (erro) {
      setFalha(falhaDe(erro))
    } finally {
      emEnvio.current = false
      setEnviando(false)
    }
  }

  if (enviada) {
    const status = descreverStatusInscricao(enviada.data.status)
    return (
      <Pagina titulo="Inscrição enviada">
        <h2 ref={tituloRef} tabIndex={-1} className="text-xl font-black outline-none">{equipe.nome} está na categoria.</h2>
        <Aviso tom={status.tom === 'ok' ? 'is-success' : 'is-warning'}><strong className="block">{status.rotulo}</strong>{status.explicacao}</Aviso>
        {enviada.avisos.length > 0 && (
          <Aviso tom="is-warning">
            <strong className="block">O que ainda merece atenção:</strong>
            <ul className="list-disc pl-5">{enviada.avisos.map((a) => <li key={a}>{a}</li>)}</ul>
          </Aviso>
        )}
        <Link href={`/meu-time/${encodeURIComponent(equipeId)}`} className={botaoPrimario}>Ver meu time</Link>
        <Link href="/meu-time" className={botaoSecundario}>Meus times</Link>
      </Pagina>
    )
  }

  const passo = rascunho.passo
  return (
    <Pagina titulo="Inscrever meu time" voltar={voltar}>
      <nav aria-label="Passos da inscrição">
        <ol className="grid grid-cols-4 gap-1">
          {TITULOS.map((titulo, i) => (
            <li key={titulo} aria-current={passo === i + 1 ? 'step' : undefined} className={`h-2 rounded-full ${i + 1 <= passo ? 'bg-[var(--vs-gold)]' : 'bg-[var(--vs-elevated)]'}`}>
              <span className="sr-only">Passo {i + 1}: {titulo}{passo === i + 1 ? ' (atual)' : ''}</span>
            </li>
          ))}
        </ol>
      </nav>
      <h2 ref={tituloRef} tabIndex={-1} className="text-xl font-black outline-none">Passo {passo} de 4 · {TITULOS[passo - 1]}</h2>
      <p className="-mt-2 text-sm text-[var(--vs-muted)]" role="status">
        {semArmazenamento ? 'Não conseguimos guardar neste aparelho. Termine nesta tela para não perder o que fez.' : salvoEm ? `Salvo às ${salvoEm}` : 'Salva sozinho enquanto você preenche.'}
      </p>

      {passo === 1 && (
        <div className="flex flex-col gap-4">
          <div className={`${cartao} flex flex-col gap-1`}>
            <p className="text-xl font-black">{equipe.nome}</p>
            <p className="text-[var(--vs-muted)]">{[equipe.cidade, NAIPE_ROTULO[equipe.naipe]].filter(Boolean).join(' · ')}</p>
            <p className="pt-2 text-sm">{atletas.length} {atletas.length === 1 ? 'atleta cadastrado' : 'atletas cadastrados'}</p>
          </div>
          <Aviso>A inscrição entra na categoria assim que você enviar. Não há fila de aprovação; o sistema avisa antes se algo estiver errado.</Aviso>
          {atletas.length === 0 && (
            <Aviso tom="is-warning">Seu time ainda não tem atletas. <Link href={voltar.href} className="font-black underline">Cadastre os atletas</Link> e volte: nada se perde.</Aviso>
          )}
          <button type="button" onClick={() => irPara(2)} className={botaoPrimario}>É esse time, continuar</button>
        </div>
      )}

      {passo === 2 && (
        <PassoAtletas
          equipeId={equipeId} atletas={atletas} escolhas={rascunho.escolhas} regras={regras}
          aoMudar={(escolhas) => setRascunho((r) => ({ ...r, escolhas }))}
          aoVoltar={() => irPara(1)} aoContinuar={() => irPara(3)}
        />
      )}

      {passo === 3 && (
        <div className="flex flex-col gap-4">
          <p className="text-[var(--vs-muted)]">Quem vai ao banco de reservas? É opcional: pode pular.</p>
          {comissao.length === 0 && (
            <Aviso>Nenhuma pessoa na comissão técnica. Tudo bem seguir sem. Para cadastrar, <Link href={voltar.href} className="font-black underline">abra o time</Link> (sua escolha de atletas fica guardada).</Aviso>
          )}
          <ul className="flex flex-col gap-2" aria-label="Comissão técnica">
            {comissao.map((membro) => (
              <li key={membro.id}>
                <label className={`${cartao} flex min-h-[56px] cursor-pointer items-center gap-3`}>
                  <input
                    type="checkbox" className="h-6 w-6 accent-[var(--vs-gold)]" checked={rascunho.comissao.includes(membro.id)}
                    onChange={(e) => setRascunho((r) => ({ ...r, comissao: e.target.checked ? [...r.comissao, membro.id] : r.comissao.filter((id) => id !== membro.id) }))}
                  />
                  <span><strong className="block">{membro.nome}</strong><span className="text-sm text-[var(--vs-muted)]">{membro.funcao}</span></span>
                </label>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={() => irPara(4)} className={botaoPrimario}>{rascunho.comissao.length === 0 ? 'Pular e revisar' : 'Revisar'}</button>
            <button type="button" onClick={() => irPara(2)} className={botaoSecundario}>Voltar</button>
          </div>
        </div>
      )}

      {passo === 4 && (
        <div className="flex flex-col gap-4">
          <dl className={`${cartao} grid grid-cols-[auto_1fr] gap-x-4 gap-y-2`}>
            <dt className="text-sm font-bold text-[var(--vs-muted)]">Time</dt><dd className="font-bold">{equipe.nome}{equipe.cidade ? ` · ${equipe.cidade}` : ''}</dd>
            <dt className="text-sm font-bold text-[var(--vs-muted)]">Naipe</dt><dd>{NAIPE_ROTULO[equipe.naipe]}</dd>
            <dt className="text-sm font-bold text-[var(--vs-muted)]">Atletas</dt><dd>{rascunho.escolhas.length}</dd>
            <dt className="text-sm font-bold text-[var(--vs-muted)]">Comissão</dt><dd>{rascunho.comissao.length === 0 ? 'Ninguém' : rascunho.comissao.length}</dd>
          </dl>
          <ul className="divide-y divide-[var(--vs-border)] rounded-xl border border-[var(--vs-border)]" aria-label="Atletas da inscrição">
            {rascunho.escolhas.map((e) => (
              <li key={e.atletaId} className="flex min-h-[44px] items-center justify-between gap-2 px-3 py-2">
                <span className="font-bold">{nomePor.get(e.atletaId) ?? 'Atleta'}</span>
                <span className="text-sm text-[var(--vs-muted)]">camisa {e.numero}{e.capitao ? ' · capitão' : ''}{e.libero ? ' · líbero' : ''}</span>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => irPara(2)} className="min-h-[44px] self-start text-sm font-bold text-[var(--vs-gold)] underline">Editar atletas</button>

          {avisos.length > 0 && (
            <Aviso tom="is-warning"><strong className="block">Avisos (não impedem o envio):</strong><ul className="list-disc pl-5">{avisos.map((a) => <li key={a}>{a}</li>)}</ul></Aviso>
          )}

          <label className="flex min-h-[44px] cursor-pointer items-start gap-3">
            <input type="checkbox" checked={rascunho.aceite} onChange={(e) => setRascunho((r) => ({ ...r, aceite: e.target.checked }))} className="mt-1 h-6 w-6 shrink-0 accent-[var(--vs-gold)]" />
            <span className="font-bold">Li e aceito o regulamento do campeonato.</span>
          </label>

          {falha && <FalhaTela falha={falha} />}

          <div className="flex flex-col gap-2">
            {(problemas.length > 0 || !rascunho.aceite) && (
              <p id="motivo-envio" className="text-sm font-bold text-[var(--vs-warning-fg)]">
                {problemas.length > 0 ? `Ainda não dá para enviar. ${problemas[0].mensagem}` : 'Marque que leu o regulamento para enviar.'}
              </p>
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button" onClick={enviar} disabled={enviando || problemas.length > 0 || !rascunho.aceite}
                aria-describedby={problemas.length > 0 || !rascunho.aceite ? 'motivo-envio' : undefined} className={botaoPrimario}
              >
                {enviando ? 'Enviando…' : 'Enviar inscrição'}
              </button>
              <button type="button" onClick={() => irPara(3)} className={botaoSecundario}>Voltar</button>
            </div>
          </div>
        </div>
      )}
    </Pagina>
  )
}
