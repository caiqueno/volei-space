'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import type { SumulaEvento } from '@/lib/regras-volei'
import { SumulaImpressa } from '@/components/sumula-impressa/SumulaImpressa'
import { montarSumulaImpressa, urlDeConsulta } from '@/lib/sumula-impressa/montar'
import type { RegistroSumula } from '@/lib/sumula-impressa/tipos'

// Mesma credencial da súmula: token opaco, ou id numérico pela rota pública
// (somente campeonato publicado). A autorização é do servidor.
export default function SumulaImprimirPage() {
  const { token } = useParams<{ token: string }>()
  const [registro, setRegistro] = useState<RegistroSumula | null>(null)
  const [eventos, setEventos] = useState<SumulaEvento[] | null>(null)
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

  // O log de eventos do motor (rodízio por ponto, A/P/E/D, folha de líbero) é opcional: a rota responde 404/503
  // quando o recurso está desligado ou a tabela ainda não existe, e então a súmula sai só com as ocorrências.
  useEffect(() => {
    if (!registro || /^\d+$/.test(token)) return
    let ativo = true
    fetch(`/api/sumula/${encodeURIComponent(token)}/eventos`, { cache: 'no-store' })
      .then(async (resposta) => {
        if (!resposta.ok) return
        const json = await resposta.json().catch(() => ({}))
        const lista = json?.data?.eventos
        if (ativo && Array.isArray(lista)) setEventos(lista as SumulaEvento[])
      })
      .catch(() => undefined)
    return () => {
      ativo = false
    }
  }, [registro, token])

  const modelo = useMemo(() => (registro ? montarSumulaImpressa(registro, eventos) : null), [registro, eventos])

  if (carregando) return <main className="si-estado" style={{ padding: 24, textAlign: "center" }} role="status">Carregando a súmula para impressão.</main>
  if (erro || !modelo) return <main className="si-estado" style={{ padding: 24, textAlign: "center" }} role="alert">{erro || 'Súmula indisponível.'}</main>
  // Botão sob a flag de tela; a rota do servidor tem a sua própria flag (SUMULA_PDF_ATIVO). Token numérico não tem PDF.
  const pdfAtivo = process.env.NEXT_PUBLIC_SUMULA_PDF_ATIVO === '1' && !/^\d+$/.test(token)
  return (
    <>
      {pdfAtivo ? (
        <div className="si-nao-imprimir" style={{ padding: '8px 16px', textAlign: 'right' }}>
          <a className="si-botao" href={`/api/sumula/${encodeURIComponent(token)}/pdf`} download>Baixar PDF</a>
        </div>
      ) : null}
      <SumulaImpressa modelo={modelo} aoImprimir={() => window.print()} />
    </>
  )
}
