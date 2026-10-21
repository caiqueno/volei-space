'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ClipboardList, UsersRound } from 'lucide-react'
import { usePollingVisivel, type ResultadoConsulta } from '@/lib/ao-vivo-ui/usePollingVisivel'
import {
  INTERVALO_INSCRICOES_MS, contarParaMenu, falhaBloqueante, normalizarInscricoes, painelInscricoesAtivo, rotuloContador, tratarResposta, urlInscricoes,
} from '@/lib/painel-inscricoes-ui'

type Variante = 'painel-lateral' | 'painel-mobile'

function ativoNaRota(pathname: string, base: string) {
  return pathname === base || pathname.startsWith(`${base}/`)
}

/** Itens "Inscrições" (com contador de em análise + pendências) e "Minha equipe" do menu do painel. Flag desligada: nada renderiza nem consulta. */
export function ItensNavInscricoes({ variante }: { variante: Variante }) {
  const ativo = painelInscricoesAtivo(process.env.NEXT_PUBLIC_PAINEL_INSCRICOES_ATIVO)
  const pathname = usePathname()
  const [pendentes, setPendentes] = useState(0)

  const buscar = useCallback(async (sinal: AbortSignal): Promise<ResultadoConsulta> => {
    try {
      const r = await fetch(urlInscricoes(), { cache: 'no-store', signal: sinal })
      const corpo = await r.json().catch(() => null)
      const t = tratarResposta(r.status, corpo)
      if (!t.ok) return falhaBloqueante(t.tipo) ? 'parar' : 'falha'
      setPendentes(contarParaMenu(normalizarInscricoes(corpo).itens))
      return 'ok'
    } catch {
      return sinal.aborted ? 'ok' : 'falha'
    }
  }, [])
  usePollingVisivel(buscar, { ativo, baseMs: INTERVALO_INSCRICOES_MS, maxMs: 60_000 })

  if (!ativo) return null
  const lateral = variante === 'painel-lateral'
  const classe = lateral ? 'profile-sidebar-link' : 'profile-mobile-link'
  const contador = rotuloContador(pendentes)
  const insc = ativoNaRota(pathname, '/painel/inscricoes')
  const equipe = ativoNaRota(pathname, '/painel/equipe')
  return (
    <>
      <Link href="/painel/inscricoes" aria-current={insc ? 'page' : undefined} className={`${classe} ${insc ? 'is-active' : ''}`}>
        <ClipboardList size={18} />
        <span className={lateral ? 'flex-1' : undefined}>Inscrições</span>
        {contador && (
          <span className="ml-1 rounded-full bg-luva-amber px-2 py-0.5 text-xs font-black text-[#07111f]" aria-label={`${pendentes} em análise ou com pendência`}>
            {contador}
          </span>
        )}
      </Link>
      <Link href="/painel/equipe" aria-current={equipe ? 'page' : undefined} className={`${classe} ${equipe ? 'is-active' : ''}`}>
        <UsersRound size={18} />
        <span className={lateral ? 'flex-1' : undefined}>Minha equipe</span>
      </Link>
    </>
  )
}
