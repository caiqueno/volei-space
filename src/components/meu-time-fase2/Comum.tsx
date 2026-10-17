'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { obterClientePadrao, type MeuTimeClient } from '@/components/meu-time/cliente'
import { Aviso, botaoSecundario, Campo, campoEstilo, Carregando, FalhaTela, Pagina, useCarregar } from '@/components/meu-time/ui'
import { faseDoisAtiva } from '@/lib/meu-time-fase2-ui/flag'

/** Com a flag desligada, a tela não mostra nada novo. */
export function PaginaFase2({ titulo, children }: { titulo: string; children: ReactNode }) {
  if (!faseDoisAtiva()) {
    return (
      <Pagina titulo={titulo} voltar={{ href: '/meu-time', texto: 'Voltar aos meus times' }}>
        <Aviso>Esta função ainda não está disponível para você. Assim que estiver, é só voltar aqui.</Aviso>
      </Pagina>
    )
  }
  return <Pagina titulo={titulo} voltar={{ href: '/meu-time', texto: 'Voltar aos meus times' }}>{children}</Pagina>
}

/** Escolha de time com rótulo. Mostra carregando, vazio e erro. */
export function SeletorEquipe({
  id,
  valor,
  aoMudar,
  cliente,
  rotulo = 'Qual time?',
}: {
  id: string
  valor: string
  aoMudar: (equipeId: string) => void
  cliente?: MeuTimeClient
  rotulo?: string
}) {
  const api = cliente ?? obterClientePadrao()
  const { carga, tentarDeNovo } = useCarregar(() => api.listarEquipes())
  if (carga.estado === 'carregando') return <Carregando texto="Carregando seus times…" />
  if (carga.estado === 'falha') return <FalhaTela falha={carga.falha} aoTentar={tentarDeNovo} />
  if (carga.dados.length === 0) {
    return (
      <Aviso>
        Você ainda não tem um time. <Link href="/meu-time/novo" className="font-bold underline">Criar meu time</Link>
      </Aviso>
    )
  }
  return (
    <Campo id={id} rotulo={rotulo}>
      <select id={id} className={campoEstilo} value={valor} onChange={(e) => aoMudar(e.target.value)}>
        <option value="">Escolha um time</option>
        {carga.dados.map((e) => (
          <option key={e.id} value={e.id}>{e.nome}</option>
        ))}
      </select>
    </Campo>
  )
}

export { botaoSecundario }
