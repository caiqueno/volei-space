'use client'

import { useState } from 'react'
import { Aviso, botaoSecundario, Carregando, cartao, FalhaTela, falhaDe } from '@/components/meu-time/ui'
import { formatarDataHora } from '@/lib/meu-time-fase2-ui/convites'
import { tituloNotificacao } from '@/lib/meu-time-fase2-ui/notificacoes'
import type { Notificacao } from '@/lib/meu-time-fase2-ui/tipos'
import type { Falha } from '@/lib/meu-time-ui/respostas'
import { obterClienteFase2, type ClienteFase2 } from './cliente'
import { PaginaFase2 } from './Comum'
import { useCarregar } from '@/components/meu-time/ui'

export function ListaNotificacoes({
  itens,
  aoMarcar,
}: {
  itens: Notificacao[]
  aoMarcar: (id: string) => Promise<void>
}) {
  const [ocupado, setOcupado] = useState<string | null>(null)
  if (itens.length === 0) return <Aviso>Nenhuma novidade por enquanto.</Aviso>
  return (
    <ul className="flex flex-col gap-2" aria-label="Notificações">
      {itens.map((n) => (
        <li key={n.id} className={`${cartao} flex flex-col gap-1 ${n.lidaEm ? 'opacity-80' : 'border-[var(--vs-gold)]'}`}>
          <span className="font-black">{tituloNotificacao(n)}</span>
          <span className="text-sm text-[var(--vs-muted)]">{formatarDataHora(n.criadoEm)}{n.lidaEm ? ' · lida' : ''}</span>
          {!n.lidaEm && (
            <button
              type="button"
              className={`${botaoSecundario} self-start`}
              disabled={ocupado === n.id}
              onClick={async () => {
                setOcupado(n.id)
                try {
                  await aoMarcar(n.id)
                } finally {
                  setOcupado(null)
                }
              }}
            >
              Marcar como lida
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}

export function NotificacoesTela({ cliente }: { cliente?: ClienteFase2 }) {
  const api = cliente ?? obterClienteFase2()
  const { carga, recarregar, tentarDeNovo } = useCarregar(() => api.listarNotificacoes())
  const [falha, setFalha] = useState<Falha | null>(null)
  return (
    <PaginaFase2 titulo="Notificações">
      {carga.estado === 'carregando' && <Carregando texto="Buscando novidades…" />}
      {carga.estado === 'falha' && <FalhaTela falha={carga.falha} aoTentar={tentarDeNovo} />}
      {falha && <FalhaTela falha={falha} />}
      {carga.estado === 'pronto' && (
        <ListaNotificacoes
          itens={carga.dados}
          aoMarcar={async (id) => {
            try {
              setFalha(null)
              await api.marcarLida(id)
              await recarregar()
            } catch (e) {
              setFalha(falhaDe(e))
            }
          }}
        />
      )}
    </PaginaFase2>
  )
}
