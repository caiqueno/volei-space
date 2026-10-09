'use client'

import { useEffect, useRef } from 'react'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'

type Escuta = {
  tabela: 'ClassificacaoEntrada' | 'Partida' | 'SetPartida'
  filtro: string
}

export function useBancoAoVivo(chave: string, escutas: Escuta[], aoMudar: () => void) {
  const aoMudarRef = useRef(aoMudar)
  aoMudarRef.current = aoMudar
  const assinatura = escutas.map((escuta) => `${escuta.tabela}:${escuta.filtro}`).join('|')

  useEffect(() => {
    if (!chave || !isSupabaseConfigured || escutas.length === 0) return
    let timer = 0
    let ativo = true
    const pedir = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        if (ativo) aoMudarRef.current()
      }, 180)
    }
    const canal = supabase.channel(chave)
    for (const escuta of escutas) {
      canal.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: escuta.tabela, filter: escuta.filtro },
        () => pedir(),
      )
    }
    canal.subscribe((status) => {
      if (status === 'SUBSCRIBED') pedir()
    })
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') pedir()
    }
    window.addEventListener('online', pedir)
    document.addEventListener('visibilitychange', aoVoltar)
    return () => {
      ativo = false
      window.clearTimeout(timer)
      window.removeEventListener('online', pedir)
      document.removeEventListener('visibilitychange', aoVoltar)
      void supabase.removeChannel(canal)
    }
  }, [chave, assinatura])
}
