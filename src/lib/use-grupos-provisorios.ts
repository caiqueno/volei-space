'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { queryCategoria } from '@/components/portal/SeletorCategoria'
import { gruposDaTabela, type GrupoProvisorio } from '@/lib/semi-provisoria'
import { useBancoAoVivo } from '@/lib/use-banco-ao-vivo'

/** Lê a classificação que já existe e monta os grupos da semi. Não grava. */
export function useGruposProvisorios(ligaId: number, categoriaId: string | null, ativo: boolean) {
  const [grupos, setGrupos] = useState<GrupoProvisorio[]>([])
  const texto = useRef('')
  const geracao = useRef(0)

  const carregar = useCallback(async () => {
    if (!ativo || !Number.isInteger(ligaId) || ligaId <= 0) return
    const marca = ++geracao.current
    try {
      const resposta = await fetch(`/api/portal/classificacao?ligaId=${ligaId}${queryCategoria(categoriaId)}`, { cache: 'no-store' })
      const json = await resposta.json()
      if (marca !== geracao.current || !resposta.ok) return
      const categorias = Array.isArray(json.data?.categorias) ? json.data.categorias : []
      const proximos = gruposDaTabela(categorias)
      const serie = JSON.stringify(proximos)
      if (serie === texto.current) return
      texto.current = serie
      setGrupos(proximos)
    } catch {
      // A chave continua com o que já estava na tela.
    }
  }, [ativo, ligaId, categoriaId])

  useEffect(() => {
    if (!ativo) return
    texto.current = ''
    setGrupos([])
    void carregar()
  }, [ativo, carregar])

  useBancoAoVivo(
    ativo ? `semi-provisoria-${ligaId}-${categoriaId ?? 'todas'}` : '',
    ativo
      ? [
          { tabela: 'ClassificacaoEntrada', filtro: `ligaId=eq.${ligaId}` },
          { tabela: 'Partida', filtro: `ligaId=eq.${ligaId}` },
        ]
      : [],
    () => { void carregar() },
  )

  return ativo ? grupos : []
}
