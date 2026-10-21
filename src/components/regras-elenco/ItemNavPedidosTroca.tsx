'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Repeat } from 'lucide-react'
import { usePollingVisivel, type ResultadoConsulta } from '@/lib/ao-vivo-ui/usePollingVisivel'
import {
  INTERVALO_PEDIDOS_MS, contarPedidosPendentes, elencoCompletoAtivo, itemAtivoPedidos, normalizarPedidos, rotuloContador, tratarResposta, urlPedidos,
} from '@/lib/regras-elenco-ui'

/** Item "Pedidos de troca" do menu do painel com contador de pendentes. Flag desligada: não renderiza nem consulta. */
export function ItemNavPedidosTroca({ variante }: { variante: 'painel-lateral' | 'painel-mobile' }) {
  const ativo = elencoCompletoAtivo(process.env.NEXT_PUBLIC_ELENCO_COMPLETO_ATIVO)
  const pathname = usePathname()
  const [pendentes, setPendentes] = useState(0)

  const buscar = useCallback(async (sinal: AbortSignal): Promise<ResultadoConsulta> => {
    try {
      const r = await fetch(urlPedidos('PENDENTE'), { cache: 'no-store', signal: sinal })
      const corpo = await r.json().catch(() => null)
      const t = tratarResposta(r.status, corpo)
      if (!t.ok) return t.tipo === 'desligado' || t.tipo === 'nao-habilitado' ? 'parar' : 'falha'
      setPendentes(contarPedidosPendentes(normalizarPedidos(corpo)))
      return 'ok'
    } catch {
      return sinal.aborted ? 'ok' : 'falha'
    }
  }, [])
  usePollingVisivel(buscar, { ativo, baseMs: INTERVALO_PEDIDOS_MS, maxMs: 60_000 })

  if (!ativo) return null
  const active = itemAtivoPedidos(pathname)
  const lateral = variante === 'painel-lateral'
  const contador = rotuloContador(pendentes)
  return (
    <Link
      href="/painel/pedidos-troca"
      aria-current={active ? 'page' : undefined}
      className={`${lateral ? 'profile-sidebar-link' : 'profile-mobile-link'} ${active ? 'is-active' : ''}`}
    >
      <Repeat size={18} />
      <span className={lateral ? 'flex-1' : undefined}>Pedidos de troca</span>
      {contador && (
        <span className="ml-1 rounded-full bg-luva-amber px-2 py-0.5 text-xs font-black text-[#07111f]" aria-label={`${pendentes} pendentes`}>
          {contador}
        </span>
      )}
    </Link>
  )
}
