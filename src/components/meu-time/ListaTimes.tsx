'use client'

import Link from 'next/link'
import { obterClientePadrao, type MeuTimeClient } from './cliente'
import { Aviso, botaoPrimario, Carregando, cartao, FalhaTela, Pagina, useCarregar } from './ui'
import { NAIPE_ROTULO } from './rotulos'

export function ListaTimes({ cliente }: { cliente?: MeuTimeClient }) {
  const api = cliente ?? obterClientePadrao()
  const { carga, tentarDeNovo } = useCarregar(() => api.listarEquipes())

  return (
    <Pagina titulo="Meu Time">
      {carga.estado === 'carregando' && <Carregando texto="Carregando seus times…" />}
      {carga.estado === 'falha' && <FalhaTela falha={carga.falha} aoTentar={tentarDeNovo} />}
      {carga.estado === 'pronto' && carga.dados.length === 0 && (
        <div className={`${cartao} flex flex-col gap-3`}>
          <h2 className="text-xl font-black">Você ainda não tem um time</h2>
          <p className="text-[var(--vs-muted)]">Crie o seu em cerca de 30 segundos. Só precisa do nome e do naipe. O resto você completa depois.</p>
          <Link href="/meu-time/novo" className={botaoPrimario}>Criar meu time</Link>
        </div>
      )}
      {carga.estado === 'pronto' && carga.dados.length > 0 && (
        <>
          <ul className="flex flex-col gap-3" aria-label="Seus times">
            {carga.dados.map((equipe) => (
              <li key={equipe.id}>
                <Link
                  href={`/meu-time/${encodeURIComponent(equipe.id)}`}
                  className={`${cartao} block min-h-[64px] transition hover:border-[var(--vs-gold)] motion-reduce:transition-none`}
                >
                  <span className="block text-lg font-black">{equipe.nome}</span>
                  <span className="block text-sm text-[var(--vs-muted)]">
                    {[equipe.cidade, NAIPE_ROTULO[equipe.naipe]].filter(Boolean).join(' · ')}
                  </span>
                  <span className="mt-2 block text-sm font-bold">{equipe.prontidao.mensagem}</span>
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/meu-time/novo" className={botaoPrimario}>Criar outro time</Link>
        </>
      )}
      {carga.estado === 'pronto' && carga.dados.length > 0 && (
        <Aviso>Toque em um time para ver atletas, comissão técnica e inscrições.</Aviso>
      )}
    </Pagina>
  )
}
