'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { SumulaImpressa } from '@/components/sumula-impressa/SumulaImpressa'
import { montarSumulaImpressa, urlDeConsulta } from '@/lib/sumula-impressa/montar'
import type { RegistroSumula } from '@/lib/sumula-impressa/tipos'

// Mesma credencial da súmula: token opaco, ou id numérico pela rota pública
// (somente campeonato publicado). A autorização é do servidor.
export default function SumulaImprimirPage() {
  const { token } = useParams<{ token: string }>()
  const [registro, setRegistro] = useState<RegistroSumula | null>(null)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let ativo = true
    fetch(urlDeConsulta(token), { cache: 'no-store' })
      .then(async (resposta) => {
        const json = await resposta.json().catch(() => ({}))
        if (!resposta.ok) throw new Error(json.error || 'Não foi possível abrir a súmula.')
        if (ativo) setRegistro(json.data)
      })
      .catch((falha) => {
        if (ativo) setErro(falha instanceof Error ? falha.message : 'Não foi possível abrir a súmula.')
      })
      .finally(() => {
        if (ativo) setCarregando(false)
      })
    return () => {
      ativo = false
    }
  }, [token])

  const modelo = useMemo(() => (registro ? montarSumulaImpressa(registro) : null), [registro])

  if (carregando) return <main className="si-estado" style={{ padding: 24, textAlign: "center" }} role="status">Carregando a súmula para impressão.</main>
  if (erro || !modelo) return <main className="si-estado" style={{ padding: 24, textAlign: "center" }} role="alert">{erro || 'Súmula indisponível.'}</main>
  return <SumulaImpressa modelo={modelo} aoImprimir={() => window.print()} />
}
