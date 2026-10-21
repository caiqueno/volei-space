'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { obterClientePadrao } from '@/components/meu-time/cliente'
import { Aviso, botaoPrimario, botaoSecundario, Carregando, cartao, FalhaTela, falhaDe, Pagina } from '@/components/meu-time/ui'
import { obterClienteCampeonatos } from '@/components/meu-time-campeonatos/cliente'
import { acoesAgora } from '@/lib/login-sem-senha-ui/regras'
import { ordenarJogos, rotuloStatusJogo, type JogoDoTime } from '@/lib/meu-time-campeonatos-ui/regras'
import type { Falha } from '@/lib/meu-time-ui/respostas'
import type { EquipeResumo } from '@/lib/meu-time-ui/tipos'

type Dados = { equipes: EquipeResumo[]; jogos: JogoDoTime[] | null }

function horario(iso: string | null): string {
  if (!iso) return 'Horário a definir'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? 'Horário a definir' : d.toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function pendentes(e: EquipeResumo): number {
  const p = e.prontidao
  return (p.semDocumento ?? 0) + (p.semAutorizacaoResponsavel ?? p.semAutorizacao ?? 0)
}

export function InicioTela() {
  const [dados, setDados] = useState<Dados | null>(null)
  const [falha, setFalha] = useState<Falha | null>(null)

  const carregar = useCallback(async () => {
    setFalha(null)
    setDados(null)
    try {
      const equipes = await obterClientePadrao().listarEquipes()
      let jogos: JogoDoTime[] | null = []
      try {
        const listas = await Promise.all(equipes.map((e) => obterClienteCampeonatos().listarJogos(e.id)))
        jogos = ordenarJogos(listas.flat())
      } catch {
        // Jogos indisponíveis (recurso desligado ou falha): o resto do resumo continua útil.
        jogos = null
      }
      setDados({ equipes, jogos })
    } catch (e) {
      setFalha(falhaDe(e))
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  return (
    <Pagina titulo="Início">
      {!dados && !falha && <Carregando texto="Carregando seu resumo…" />}
      {falha && <FalhaTela falha={falha} aoTentar={() => void carregar()} />}
      {dados && <Resumo dados={dados} />}
    </Pagina>
  )
}

function Resumo({ dados }: { dados: Dados }) {
  const { equipes, jogos } = dados
  const proximos = (jogos ?? []).filter((j) => !['ENCERRADA', 'FINALIZADA', 'CANCELADA', 'WO'].includes(String(j.status).toUpperCase())).slice(0, 3)
  const atletasPendentes = equipes.reduce((n, e) => n + pendentes(e), 0)
  const papeletas = (jogos ?? []).filter((j) => j.papeletaPendente).length
  const acoes = acoesAgora({ proximosJogos: proximos.length, atletasPendentes, papeletasPendentes: papeletas }, equipes.length > 0)

  if (equipes.length === 0) {
    return (
      <div className={`${cartao} flex flex-col gap-3`}>
        <h2 className="text-xl font-black">Comece pelo seu time</h2>
        <p className="text-[var(--vs-muted)]">Crie o time em cerca de 30 segundos. O resto você completa depois.</p>
        <Link href="/meu-time/novo" className={botaoPrimario}>Cadastrar meu time</Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <section aria-labelledby="agora" className={`${cartao} flex flex-col gap-2`}>
        <h2 id="agora" className="text-xl font-black">O que fazer agora</h2>
        <ul className="flex flex-col gap-2">
          {acoes.map((a) => (
            <li key={a.texto}>
              <Link href={a.href} className={botaoSecundario}>{a.texto}</Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="jogos" className={`${cartao} flex flex-col gap-2`}>
        <h2 id="jogos" className="text-xl font-black">Próximos jogos</h2>
        {jogos === null && <Aviso>Não deu para buscar os jogos agora.</Aviso>}
        {jogos !== null && proximos.length === 0 && <p className="text-[var(--vs-muted)]">Nenhum jogo marcado por enquanto.</p>}
        {proximos.length > 0 && (
          <ul className="flex flex-col gap-2">
            {proximos.map((j) => (
              <li key={`${j.partidaId}:${j.equipeId}`} className="rounded-xl bg-[var(--vs-elevated)] p-3">
                <p className="font-black">Contra {j.adversario}</p>
                <p className="text-sm">{horario(j.horario)}{j.local ? ` · ${j.local}` : ''}</p>
                <p className="text-sm text-[var(--vs-muted)]">{j.campeonato} · {rotuloStatusJogo(j.status)}</p>
              </li>
            ))}
          </ul>
        )}
        <Link href="/meu-time/jogos" className="inline-flex min-h-[44px] items-center text-sm font-bold text-[var(--vs-gold)] underline">Ver todos os jogos</Link>
      </section>

      <section aria-labelledby="atletas" className={`${cartao} flex flex-col gap-2`}>
        <h2 id="atletas" className="text-xl font-black">Pendências de atletas</h2>
        {atletasPendentes === 0 ? (
          <p className="text-[var(--vs-muted)]">Nenhuma pendência nos seus times.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {equipes.filter((e) => pendentes(e) > 0).map((e) => (
              <li key={e.id}>
                <Link href={`/meu-time/${encodeURIComponent(e.id)}`} className="inline-flex min-h-[44px] items-center text-base font-bold underline">
                  {e.nome}: {e.prontidao.mensagem}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="solic" className={`${cartao} flex flex-col gap-2`}>
        <h2 id="solic" className="text-xl font-black">Competições e solicitações</h2>
        <p className="text-[var(--vs-muted)]">Veja campeonatos abertos e o andamento das suas solicitações de participação.</p>
        <Link href="/meu-time/campeonatos" className={botaoSecundario}>Abrir Competições</Link>
      </section>
    </div>
  )
}
