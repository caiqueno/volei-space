'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Aviso, botaoPrimario, Campo, campoEstilo, Carregando, FalhaTela, falhaDe } from '@/components/meu-time/ui'
import type { Falha } from '@/lib/meu-time-ui/respostas'
import {
  descreverStatus,
  estadoDaEtapa,
  ETAPAS,
  LIMITE_COMENTARIO,
  podeResponder,
  prepararComentario,
  rotuloAutor,
  type Comentario,
  type InscricaoDoLider,
} from '@/lib/meu-time-competicoes-ui/status'
import { obterClienteCompeticoes, type ClienteCompeticoes } from './cliente'

const CLASSE_TOM = { ok: 'is-success', aviso: 'is-warning', erro: 'is-error', neutro: '' } as const

function formatar(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

/** Conversa da inscrição com o organizador, com campo para responder quando há pendência. */
export function ComentariosInscricao({ inscricaoId, status, cliente }: { inscricaoId: string; status: string; cliente?: ClienteCompeticoes }) {
  const api = cliente ?? obterClienteCompeticoes()
  const [itens, setItens] = useState<Comentario[] | null>(null)
  const [falha, setFalha] = useState<Falha | null>(null)
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [erroEnvio, setErroEnvio] = useState<string | null>(null)
  const vivo = useRef(true)
  const idCampo = `resp-${inscricaoId}`

  const carregar = useCallback(async () => {
    try {
      const l = await api.listarComentarios(inscricaoId)
      if (vivo.current) {
        setItens(l)
        setFalha(null)
      }
    } catch (e) {
      if (vivo.current) setFalha(falhaDe(e))
    }
  }, [api, inscricaoId])

  useEffect(() => {
    vivo.current = true
    void carregar()
    return () => {
      vivo.current = false
    }
  }, [carregar])

  const responder = podeResponder(status)
  // Sem conversa e sem pendência não há o que mostrar.
  if (itens && itens.length === 0 && !responder) return null

  async function enviar() {
    const mensagem = prepararComentario(texto)
    if (!mensagem || enviando) return
    setEnviando(true)
    setErroEnvio(null)
    setEnviado(false)
    try {
      await api.comentar(inscricaoId, mensagem)
      setTexto('')
      setEnviado(true)
      await carregar()
    } catch (e) {
      setErroEnvio(falhaDe(e).mensagem)
    } finally {
      if (vivo.current) setEnviando(false)
    }
  }

  return (
    <section aria-label="Conversa com o organizador" className="flex flex-col gap-2">
      <h4 className="text-base font-black">Conversa com o organizador</h4>
      {!itens && !falha && <Carregando texto="Carregando a conversa…" />}
      {falha && <FalhaTela falha={falha} aoTentar={() => void carregar()} />}
      {itens && itens.length > 0 && (
        <ul className="flex flex-col gap-2">
          {itens.map((c) => (
            <li key={c.id} className={`rounded-xl border border-[var(--vs-border)] p-3 ${c.autor === 'ORGANIZADOR' ? 'bg-[var(--vs-elevated)]' : ''}`}>
              <p className="text-sm font-bold">{rotuloAutor(c.autor)}{c.criadoEm ? ` · ${formatar(c.criadoEm)}` : ''}</p>
              <p className="whitespace-pre-wrap break-words text-base">{c.mensagem}</p>
            </li>
          ))}
        </ul>
      )}
      {responder && (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void enviar()
          }}
        >
          <Campo id={idCampo} rotulo="Sua resposta ao organizador" ajuda={`Conte o que você ajustou ou tire a dúvida. Até ${LIMITE_COMENTARIO} letras.`} erro={erroEnvio}>
            <textarea id={idCampo} className={`${campoEstilo} min-h-[96px]`} maxLength={LIMITE_COMENTARIO} value={texto} onChange={(e) => setTexto(e.target.value)} />
          </Campo>
          <button type="submit" className={botaoPrimario} disabled={enviando || !prepararComentario(texto)}>
            {enviando ? 'Enviando…' : 'Enviar resposta'}
          </button>
          <div aria-live="polite">{enviado && <Aviso tom="is-success">Resposta enviada. O organizador foi avisado.</Aviso>}</div>
        </form>
      )}
    </section>
  )
}

/** Caminho Rascunho → Em análise → Pendência → Resposta, com o que fazer em cada estado. */
export function StatusInscricao({ inscricao, inscricaoId }: { inscricao: InscricaoDoLider; inscricaoId: string }) {
  const d = descreverStatus(inscricao)
  return (
    <div className="flex flex-col gap-3">
      <ol aria-label="Caminho da inscrição" className="flex flex-wrap gap-1 text-sm">
        {ETAPAS.map((e, i) => {
          const est = estadoDaEtapa(d, e.id)
          const rotulo = e.id === 'DECISAO' && est === 'atual' ? d.rotulo : e.rotulo
          return (
            <li
              key={e.id}
              aria-current={est === 'atual' ? 'step' : undefined}
              className={`rounded-full border px-3 py-1 font-bold ${est === 'atual' ? 'border-[var(--vs-gold)] bg-[var(--vs-elevated)] text-[var(--vs-gold)]' : est === 'concluida' ? 'border-[var(--vs-border-strong)]' : 'border-[var(--vs-border)] text-[var(--vs-muted)]'}`}
            >
              <span className="sr-only">{est === 'concluida' ? 'Etapa concluída: ' : est === 'atual' ? 'Etapa atual: ' : 'Etapa futura: '}</span>
              {i + 1}. {rotulo}
            </li>
          )
        })}
      </ol>
      <div className={`vs-state ${CLASSE_TOM[d.tom]} flex flex-col gap-1`} role="status">
        <p className="font-black">{d.rotulo}</p>
        <p className="text-base">{d.explicacao}</p>
        <p className="text-base font-bold">O que fazer: {d.proximoPasso}</p>
      </div>
      <ComentariosInscricao inscricaoId={inscricaoId} status={inscricao.status} />
    </div>
  )
}
