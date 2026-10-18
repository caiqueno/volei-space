'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { BancoApp } from '@/components/banco/BancoApp'
import { Aviso, botaoSecundario, Carregando, cartao, FalhaTela, falhaDe, Pagina } from '@/components/meu-time/ui'
import { SeletorEquipe } from '@/components/meu-time-fase2/Comum'
import type { Falha } from '@/lib/meu-time-ui/respostas'
import {
  bancoSessaoAtivo,
  baseApiSessao,
  chaveJogo,
  ordenarJogos,
  rotuloStatusJogo,
  TEXTO_PAPELETA_PENDENTE,
  type JogoDoTime,
} from '@/lib/meu-time-campeonatos-ui/regras'
import { obterClienteCampeonatos, type ClienteCampeonatos } from './cliente'

function formatarHorario(iso: string | null): string {
  if (!iso) return 'Horário a definir'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'Horário a definir'
  return d.toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function CartaoJogo({ jogo, aoAbrir }: { jogo: JogoDoTime; aoAbrir: (j: JogoDoTime) => void }) {
  return (
    <li className={`${cartao} flex flex-col gap-2`}>
      <div className="flex flex-wrap items-center gap-2">
        {jogo.papeletaPendente && (
          <span className="rounded-full bg-[var(--vs-gold)] px-3 py-1 text-sm font-black text-[var(--vs-on-gold)]">{TEXTO_PAPELETA_PENDENTE}</span>
        )}
        <span className="rounded-full bg-[var(--vs-elevated)] px-3 py-1 text-sm font-bold">{rotuloStatusJogo(jogo.status)}</span>
      </div>
      <h2 className="font-display text-xl font-black leading-tight">
        <span className="sr-only">Contra </span>
        {jogo.adversario}
      </h2>
      <p className="text-base">
        {formatarHorario(jogo.horario)}
        {jogo.local ? ` · ${jogo.local}` : ''}
      </p>
      <p className="text-sm text-[var(--vs-muted)]">
        {jogo.campeonato}
        {jogo.categoria ? ` · ${jogo.categoria}` : ''}
      </p>
      <button type="button" className={botaoSecundario} onClick={() => aoAbrir(jogo)}>
        Abrir banco de reservas
        <span className="sr-only"> do jogo contra {jogo.adversario}</span>
      </button>
    </li>
  )
}

export function JogosTela({ cliente }: { cliente?: ClienteCampeonatos }) {
  const api = cliente ?? obterClienteCampeonatos()
  const ativo = bancoSessaoAtivo()
  const [equipeId, setEquipeId] = useState('')
  const [jogos, setJogos] = useState<JogoDoTime[] | null>(null)
  const [falha, setFalha] = useState<Falha | null>(null)
  const [aberto, setAberto] = useState<JogoDoTime | null>(null)
  const pedido = useRef(0)

  const carregar = useCallback(async () => {
    if (!equipeId) {
      setJogos(null)
      return
    }
    const n = ++pedido.current
    try {
      const lista = await api.listarJogos(equipeId)
      if (n === pedido.current) {
        setJogos(ordenarJogos(lista))
        setFalha(null)
      }
    } catch (e) {
      if (n === pedido.current) setFalha(falhaDe(e))
    }
  }, [api, equipeId])

  useEffect(() => {
    if (!ativo) return
    setJogos(null)
    setFalha(null)
    setAberto(null)
    void carregar()
  }, [ativo, carregar])

  if (!ativo) {
    return (
      <Pagina titulo="Jogos" voltar={{ href: '/meu-time', texto: 'Voltar aos meus times' }}>
        <Aviso>Esta função ainda não está disponível para você. Assim que estiver, é só voltar aqui.</Aviso>
      </Pagina>
    )
  }

  // Jogo aberto: o mesmo app do banco, agora pela sessão do time (sem link).
  if (aberto) {
    return (
      <div className="mx-auto w-full max-w-3xl px-3 pb-28 pt-4 text-[var(--vs-text)]">
        <button
          type="button"
          className={`${botaoSecundario} mb-3`}
          onClick={() => {
            setAberto(null)
            void carregar()
          }}
        >
          Voltar aos jogos
        </button>
        <BancoApp key={chaveJogo(aberto)} token={`sessao-${chaveJogo(aberto)}`} baseApi={baseApiSessao(aberto.partidaId, aberto.equipeId)} />
      </div>
    )
  }

  return (
    <Pagina titulo="Jogos" voltar={{ href: '/meu-time', texto: 'Voltar aos meus times' }}>
      <p className="text-base text-[var(--vs-muted)]">Veja os próximos jogos e envie a papeleta daqui, sem precisar de link.</p>
      <SeletorEquipe id="equipe-jogos" valor={equipeId} aoMudar={setEquipeId} rotulo="De qual time?" />
      {equipeId && !jogos && !falha && <Carregando texto="Buscando os jogos…" />}
      {falha && <FalhaTela falha={falha} aoTentar={() => void carregar()} />}
      {jogos && jogos.length === 0 && <Aviso>Este time não tem jogos marcados por enquanto.</Aviso>}
      {jogos && jogos.length > 0 && (
        <ul className="flex flex-col gap-3" aria-label="Jogos do time">
          {jogos.map((j) => (
            <CartaoJogo key={chaveJogo(j)} jogo={j} aoAbrir={setAberto} />
          ))}
        </ul>
      )}
    </Pagina>
  )
}
