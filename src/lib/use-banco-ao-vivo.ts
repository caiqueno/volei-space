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
    if (!chave || escutas.length === 0) return
    let timer = 0
    let ativo = true
    const pedir = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        if (ativo) aoMudarRef.current()
      }, 180)
    }
    // O Realtime deixa de enxergar SetPartida e ClassificacaoEntrada quando
    // a chave publicável perde o SELECT. A tela continua lendo as APIs.
    const intervalo = window.setInterval(() => {
      if (ativo) aoMudarRef.current()
    }, 4000)
    let canal: ReturnType<typeof supabase.channel> | null = null
    if (isSupabaseConfigured) {
      canal = supabase.channel(chave)
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
    }
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') pedir()
    }
    window.addEventListener('online', pedir)
    document.addEventListener('visibilitychange', aoVoltar)
    return () => {
      ativo = false
      window.clearTimeout(timer)
      window.clearInterval(intervalo)
      window.removeEventListener('online', pedir)
      document.removeEventListener('visibilitychange', aoVoltar)
      if (canal) void supabase.removeChannel(canal)
    }
  }, [chave, assinatura])
}
