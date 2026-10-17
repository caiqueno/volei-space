'use client'

import { useState, type FormEvent } from 'react'
import { Aviso, botaoPrimario, Campo, campoEstilo, Carregando, cartao, FalhaTela, falhaDe, useCarregar } from '@/components/meu-time/ui'
import type { Falha } from '@/lib/meu-time-ui/respostas'
import { obterClienteFase2, type ClienteFase2 } from './cliente'
import { PaginaFase2, SeletorEquipe } from './Comum'

export function ClubeTela({ cliente }: { cliente?: ClienteFase2 }) {
  const api = cliente ?? obterClienteFase2()
  const { carga, recarregar, tentarDeNovo } = useCarregar(() => api.obterClube())
  const [nome, setNome] = useState('')
  const [equipeId, setEquipeId] = useState('')
  const [falha, setFalha] = useState<Falha | null>(null)
  const [erroLocal, setErroLocal] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [msg, setMsg] = useState('')

  async function criar(ev: FormEvent) {
    ev.preventDefault()
    if (nome.trim().length < 2) {
      setErroLocal('Escreva o nome do clube.')
      return
    }
    setErroLocal(null)
    await agir(async () => {
      await api.criarClube(nome.trim())
      setMsg('Clube criado.')
    })
  }

  async function vincular() {
    if (!equipeId) {
      setErroLocal('Escolha o time que vai entrar no clube.')
      return
    }
    setErroLocal(null)
    await agir(async () => {
      await api.vincularEquipe(equipeId)
      setEquipeId('')
      setMsg('Time vinculado ao clube.')
    })
  }

  async function agir(fn: () => Promise<void>) {
    setOcupado(true)
    setFalha(null)
    setMsg('')
    try {
      await fn()
      await recarregar()
    } catch (e) {
      setFalha(falhaDe(e))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <PaginaFase2 titulo="Meu clube">
      {carga.estado === 'carregando' && <Carregando texto="Carregando seu clube…" />}
      {carga.estado === 'falha' && <FalhaTela falha={carga.falha} aoTentar={tentarDeNovo} />}
      {carga.estado === 'pronto' && !carga.dados && (
        <form onSubmit={criar} noValidate className={`${cartao} flex flex-col gap-3`}>
          <p className="text-[var(--vs-muted)]">Um clube junta vários times seus em um lugar só. Você ainda não tem um.</p>
          <Campo id="clube-nome" rotulo="Nome do clube" erro={erroLocal}>
            <input id="clube-nome" className={campoEstilo} value={nome} maxLength={80} onChange={(e) => setNome(e.target.value)} />
          </Campo>
          <button type="submit" className={botaoPrimario} disabled={ocupado}>{ocupado ? 'Criando…' : 'Criar clube'}</button>
        </form>
      )}
      {carga.estado === 'pronto' && carga.dados && (
        <>
          <section className={`${cartao}`} aria-labelledby="clube-titulo">
            <h2 id="clube-titulo" className="text-xl font-black">{carga.dados.nome}</h2>
            {carga.dados.equipes && carga.dados.equipes.length > 0 ? (
              <ul className="mt-2 flex flex-col gap-2" aria-label="Times do clube">
                {carga.dados.equipes.map((e) => (
                  <li key={e.id} className="min-h-[44px] rounded-xl border border-[var(--vs-border)] px-3 py-2 font-bold">{e.nome}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[var(--vs-muted)]">Nenhum time no clube ainda. Vincule um abaixo.</p>
            )}
          </section>
          <section className={`${cartao} flex flex-col gap-3`} aria-labelledby="vincular">
            <h2 id="vincular" className="text-xl font-black">Vincular um time</h2>
            <SeletorEquipe id="clube-equipe" valor={equipeId} aoMudar={setEquipeId} rotulo="Time que entra no clube" />
            {erroLocal && <p role="alert" className="text-sm font-bold text-[var(--vs-error-fg)]">{erroLocal}</p>}
            <button type="button" className={botaoPrimario} disabled={ocupado} onClick={vincular}>{ocupado ? 'Vinculando…' : 'Vincular ao clube'}</button>
          </section>
        </>
      )}
      {msg && <Aviso tom="is-success">{msg}</Aviso>}
      {falha && carga.estado === 'pronto' && <FalhaTela falha={falha} />}
    </PaginaFase2>
  )
}
