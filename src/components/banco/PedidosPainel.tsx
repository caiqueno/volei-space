'use client'

import { useState } from 'react'
import { botaoPedido, podeCancelarPedido, ROTULO_ESTADO_PEDIDO, usoDeLimites, validarSubstituicaoLocal } from '@/lib/banco-ui/botoes'
import { botaoDesafio } from '@/lib/banco-ui/botoes'
import { desafioAtivo, MOTIVO_MAX, validarMotivo } from '@/lib/desafio-ui'
import { chamarBanco } from '@/lib/banco-ui/cliente'
import { rotuloJogador } from '@/lib/banco-ui/formacao'
import type { PedidoBanco, TipoPedido, VisaoBanco } from '@/lib/banco-ui/tipos'
import { BTN_PRIMARIO, BTN_SECUNDARIO, Dialogo } from './Dialogo'

const CAMPO =
  'mt-1 min-h-[48px] w-full rounded-xl border border-vs-border bg-vs-elevated px-3 text-base text-vs-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'

const COR_ESTADO: Record<PedidoBanco['estado'], string> = {
  PENDENTE: 'border-vs-gold text-vs-gold',
  ACEITO: 'border-vs-win text-vs-win',
  RECUSADO: 'border-red-400 text-red-300',
  CANCELADO: 'border-vs-muted text-vs-muted',
}
const ICONE_ESTADO: Record<PedidoBanco['estado'], string> = { PENDENTE: '⏳', ACEITO: '✔', RECUSADO: '✖', CANCELADO: '–' }

export function PedidosPainel({
  token,
  visao,
  setAtual,
  semConexao,
  onAtualizar,
}: {
  token: string
  visao: VisaoBanco
  setAtual: number
  semConexao: boolean
  onAtualizar: () => void
}) {
  const desafioLigado = desafioAtivo(process.env.NEXT_PUBLIC_DESAFIO_ATIVO)
  const [motivoDesafio, setMotivoDesafio] = useState('')
  const [dialogo, setDialogo] = useState<TipoPedido | 'DESAFIO' | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [sai, setSai] = useState<number | null>(null)
  const [entra, setEntra] = useState<number | null>(null)
  const [erroForm, setErroForm] = useState<string | null>(null)
  const [cancelando, setCancelando] = useState<PedidoBanco['id'] | null>(null)

  const tempo = botaoPedido({ tipo: 'TEMPO', visao, enviando, semConexao })
  const subst = botaoPedido({ tipo: 'SUBSTITUICAO', visao, enviando, semConexao })
  const desafio = botaoDesafio({ ativo: desafioLigado, visao, enviando, semConexao })
  const uso = usoDeLimites(visao.pedidos)
  const titulares = visao.papeletas.find((p) => p.setNumero === setAtual)?.formacao.map((f) => f.jogadorId) ?? []
  const nomeDe = (id: number | undefined) => (id == null ? '?' : rotuloJogador(visao.elenco.find((j) => j.jogadorId === id)))
  const ordenados = [...visao.pedidos].sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm)))

  function abrir(tipo: TipoPedido | 'DESAFIO') {
    setMotivoDesafio('')
    setAviso(null)
    setErroForm(null)
    setSai(null)
    setEntra(null)
    setDialogo(tipo)
  }

  async function pedir() {
    if (!dialogo || enviando) return
    if (dialogo === 'SUBSTITUICAO') {
      const erro = validarSubstituicaoLocal(sai, entra)
      if (erro) {
        setErroForm(erro)
        return
      }
    }
    let corpo: Record<string, unknown>
    if (dialogo === 'DESAFIO') {
      const m = validarMotivo(motivoDesafio)
      if (!m.ok) {
        setErroForm(m.mensagem)
        return
      }
      corpo = m.motivo ? { tipo: 'DESAFIO', motivo: m.motivo } : { tipo: 'DESAFIO' }
    } else {
      corpo = dialogo === 'TEMPO' ? { tipo: 'TEMPO' } : { tipo: 'SUBSTITUICAO', sai, entra }
    }
    setEnviando(true)
    setErroForm(null)
    const r = await chamarBanco(token, '/pedidos', 'POST', corpo)
    setEnviando(false)
    if (!r.ok) {
      const msg = r.violacoes.length > 0 ? r.violacoes.map((v) => v.mensagem).join(' ') : r.erro
      if (r.status === 501) setErroForm('Este tipo de pedido ainda não está disponível.')
      else setErroForm(msg)
      return
    }
    setDialogo(null)
    setAviso({ tipo: 'ok', texto: dialogo === 'TEMPO' ? 'Pedido de tempo enviado. Aguardando o apontador.' : dialogo === 'DESAFIO' ? 'Pedido de desafio enviado. Aguardando o apontador.' : 'Pedido de substituição enviado. Aguardando o apontador.' })
    onAtualizar()
  }

  async function cancelar(p: PedidoBanco) {
    setCancelando(p.id)
    setAviso(null)
    const r = await chamarBanco(token, `/pedidos/${encodeURIComponent(String(p.id))}`, 'DELETE')
    setCancelando(null)
    if (!r.ok) {
      setAviso({ tipo: 'erro', texto: r.erro ?? 'Não foi possível cancelar.' })
      return
    }
    setAviso({ tipo: 'ok', texto: 'Pedido cancelado.' })
    onAtualizar()
  }

  return (
    <section aria-labelledby="titulo-pedidos" className="rounded-3xl border border-vs-border bg-vs-surface p-4">
      <h2 id="titulo-pedidos" className="font-display text-2xl font-bold text-vs-text">
        Pedidos ao apontador
      </h2>
      <p className="mt-1 text-sm text-vs-muted">
        Tempos: {uso.tempos} de {visao.limites.tempos}. Substituições: {uso.substituicoes} de {visao.limites.substituicoes}. O apontador decide cada pedido.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <button type="button" className={`${BTN_PRIMARIO} min-h-[64px] w-full text-lg`} disabled={!tempo.habilitado} aria-describedby="motivo-tempo" onClick={() => abrir('TEMPO')}>
            Pedir tempo
          </button>
          <p id="motivo-tempo" className="mt-1 min-h-[1.25rem] text-sm text-vs-muted">
            {tempo.motivo ?? ''}
          </p>
        </div>
        <div>
          <button type="button" className={`${BTN_PRIMARIO} min-h-[64px] w-full text-lg`} disabled={!subst.habilitado} aria-describedby="motivo-subst" onClick={() => abrir('SUBSTITUICAO')}>
            Pedir substituição
          </button>
          <p id="motivo-subst" className="mt-1 min-h-[1.25rem] text-sm text-vs-muted">
            {subst.motivo ?? ''}
          </p>
        </div>
      </div>

      {desafioLigado ? (
        <div className="mt-3">
          <button type="button" className={`${BTN_PRIMARIO} min-h-[64px] w-full text-lg`} disabled={!desafio.habilitado} aria-describedby="motivo-desafio" onClick={() => abrir('DESAFIO')}>
            Pedir desafio
          </button>
          <p id="motivo-desafio" className="mt-1 min-h-[1.25rem] text-sm text-vs-muted">
            {desafio.motivo ?? ''}
          </p>
        </div>
      ) : (
        <p className="mt-2 rounded-xl border border-vs-border bg-vs-elevated p-3 text-sm text-vs-text">Desafio de vídeo: fase posterior.</p>
      )}

      <div aria-live="polite" className="mt-3">
        {aviso ? (
          <p className={`rounded-xl border p-3 text-sm font-bold ${aviso.tipo === 'ok' ? 'border-vs-win text-vs-win' : 'border-red-400 bg-red-950/60 text-red-100'}`}>{aviso.texto}</p>
        ) : null}
      </div>

      <h3 className="mt-4 text-lg font-bold text-vs-text">Meus pedidos</h3>
      {ordenados.length === 0 ? (
        <p className="mt-2 text-sm text-vs-muted">Nenhum pedido ainda.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {ordenados.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-vs-border bg-vs-elevated p-3">
              <div className="min-w-0">
                <p className="text-base font-bold text-vs-text">{p.tipo === 'TEMPO' ? 'Tempo' : p.tipo === 'DESAFIO' ? 'Desafio de vídeo' : 'Substituição'}</p>
                {p.tipo === 'DESAFIO' && p.payload?.motivo ? <p className="text-sm text-vs-text">Motivo: {p.payload.motivo}</p> : null}
                {p.tipo === 'SUBSTITUICAO' ? (
                  <p className="text-sm text-vs-text">
                    Sai {nomeDe(p.payload?.sai)}, entra {nomeDe(p.payload?.entra)}
                  </p>
                ) : null}
                <p className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-sm font-bold ${COR_ESTADO[p.estado]}`}>
                  <span aria-hidden="true">{ICONE_ESTADO[p.estado]} </span>
                  {ROTULO_ESTADO_PEDIDO[p.estado]}
                </p>
              </div>
              {podeCancelarPedido(p) ? (
                <button type="button" className={`${BTN_SECUNDARIO} min-h-[44px]`} disabled={cancelando === p.id || semConexao} onClick={() => cancelar(p)}>
                  {cancelando === p.id ? 'Cancelando...' : 'Cancelar pedido'}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {dialogo === 'TEMPO' ? (
        <Dialogo titulo="Pedir tempo?" onFechar={() => !enviando && setDialogo(null)}>
          <p className="text-base text-vs-text">O pedido vai para o apontador, que confirma na súmula.</p>
          {erroForm ? (
            <p role="alert" className="mt-3 rounded-xl border border-red-400 bg-red-950/60 p-3 text-sm font-bold text-red-100">
              {erroForm}
            </p>
          ) : null}
          <div className="mt-5 flex gap-2">
            <button type="button" className={`${BTN_SECUNDARIO} flex-1`} disabled={enviando} onClick={() => setDialogo(null)}>
              Voltar
            </button>
            <button type="button" className={`${BTN_PRIMARIO} flex-1`} disabled={enviando} onClick={pedir}>
              {enviando ? 'Enviando...' : 'Pedir tempo'}
            </button>
          </div>
        </Dialogo>
      ) : null}

      {dialogo === 'DESAFIO' ? (
        <Dialogo titulo="Pedir desafio de vídeo" onFechar={() => !enviando && setDialogo(null)}>
          <label htmlFor="txt-motivo-desafio" className="text-sm font-bold text-vs-text">
            Motivo (opcional)
          </label>
          <input id="txt-motivo-desafio" type="text" maxLength={MOTIVO_MAX} className={CAMPO} value={motivoDesafio} onChange={(e) => setMotivoDesafio(e.target.value)} placeholder="Ex.: toque na rede" />
          <p className="mt-2 text-sm text-vs-muted">O apontador decide. O limite de desafios por set é conferido pelo servidor.</p>
          {erroForm ? (
            <p role="alert" className="mt-3 rounded-xl border border-red-400 bg-red-950/60 p-3 text-sm font-bold text-red-100">
              {erroForm}
            </p>
          ) : null}
          <div className="mt-5 flex gap-2">
            <button type="button" className={`${BTN_SECUNDARIO} flex-1`} disabled={enviando} onClick={() => setDialogo(null)}>
              Voltar
            </button>
            <button type="button" className={`${BTN_PRIMARIO} flex-1`} disabled={enviando} onClick={pedir}>
              {enviando ? 'Enviando...' : 'Pedir desafio'}
            </button>
          </div>
        </Dialogo>
      ) : null}

      {dialogo === 'SUBSTITUICAO' ? (
        <Dialogo titulo="Pedir substituição" onFechar={() => !enviando && setDialogo(null)}>
          <label htmlFor="sel-sai" className="text-sm font-bold text-vs-text">
            Quem sai
          </label>
          <select id="sel-sai" className={CAMPO} value={sai ?? ''} onChange={(e) => setSai(e.target.value === '' ? null : Number(e.target.value))}>
            <option value="">Escolha quem sai</option>
            {titulares.length > 0 ? (
              <optgroup label="Titulares da papeleta">
                {visao.elenco
                  .filter((j) => titulares.includes(j.jogadorId))
                  .map((j) => (
                    <option key={j.jogadorId} value={j.jogadorId}>
                      {rotuloJogador(j)}
                    </option>
                  ))}
              </optgroup>
            ) : null}
            <optgroup label={titulares.length > 0 ? 'Demais jogadores' : 'Elenco'}>
              {visao.elenco
                .filter((j) => !titulares.includes(j.jogadorId))
                .map((j) => (
                  <option key={j.jogadorId} value={j.jogadorId}>
                    {rotuloJogador(j)}
                  </option>
                ))}
            </optgroup>
          </select>
          <label htmlFor="sel-entra" className="mt-3 block text-sm font-bold text-vs-text">
            Quem entra
          </label>
          <select id="sel-entra" className={CAMPO} value={entra ?? ''} onChange={(e) => setEntra(e.target.value === '' ? null : Number(e.target.value))}>
            <option value="">Escolha quem entra</option>
            {visao.elenco.map((j) => (
              <option key={j.jogadorId} value={j.jogadorId} disabled={j.jogadorId === sai}>
                {rotuloJogador(j)}
              </option>
            ))}
          </select>
          {erroForm ? (
            <p role="alert" className="mt-3 rounded-xl border border-red-400 bg-red-950/60 p-3 text-sm font-bold text-red-100">
              {erroForm}
            </p>
          ) : null}
          <div className="mt-5 flex gap-2">
            <button type="button" className={`${BTN_SECUNDARIO} flex-1`} disabled={enviando} onClick={() => setDialogo(null)}>
              Voltar
            </button>
            <button type="button" className={`${BTN_PRIMARIO} flex-1`} disabled={enviando} onClick={pedir}>
              {enviando ? 'Enviando...' : 'Pedir substituição'}
            </button>
          </div>
        </Dialogo>
      ) : null}
    </section>
  )
}
