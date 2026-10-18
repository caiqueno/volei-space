'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { normalizarModo, solicitacoesAtivo, tratarResposta, type EstadoModoRevisao } from '@/lib/organizador-solicitacoes-ui'

/** Modo de inscrição da categoria aberta, só para exibir na revisão. Sem a flag, não faz nenhuma requisição. */
export function useModoInscricaoRevisao(): EstadoModoRevisao {
  const ativo = solicitacoesAtivo(process.env.NEXT_PUBLIC_INSCRICAO_SOLICITACAO_ATIVO)
  const categoriaId = useSearchParams().get('categoriaCampeonatoId')
  const [estado, setEstado] = useState<EstadoModoRevisao>('carregando')

  useEffect(() => {
    if (!ativo) return
    if (!categoriaId) {
      setEstado('sem-categoria')
      return
    }
    let vivo = true
    setEstado('carregando')
    fetch(`/api/organizador/categorias/${encodeURIComponent(categoriaId)}/inscricao`, { cache: 'no-store' })
      .then(async (r) => {
        const corpo = await r.json().catch(() => null)
        if (!vivo) return
        const t = tratarResposta(r.status, corpo)
        if (!t.ok) {
          // Recurso desligado no servidor: a inscrição segue automática.
          setEstado(t.tipo === 'desligado' || t.tipo === 'nao-habilitado' ? 'AUTOMATICA' : 'erro')
          return
        }
        setEstado(normalizarModo((corpo as { data?: { modoInscricao?: unknown } } | null)?.data?.modoInscricao))
      })
      .catch(() => { if (vivo) setEstado('erro') })
    return () => { vivo = false }
  }, [ativo, categoriaId])

  return estado
}
