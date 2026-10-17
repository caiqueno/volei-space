'use client'

import { useState } from 'react'
import { bancoAppAtivo, lerEnvelope, linkWhatsapp } from '@/lib/sumula-banco-ui'

export interface LinkBancoProps {
  partidaId: number
  equipes: Array<{ equipeId: number; nome: string }>
}

interface LinkGerado {
  url: string
  expiraEm?: string
}

/** Gera, copia e compartilha por WhatsApp o link do banco de cada equipe. Flag desligada: não renderiza. */
export function LinkBanco({ partidaId, equipes }: LinkBancoProps) {
  const ativo = bancoAppAtivo(process.env.NEXT_PUBLIC_BANCO_APP_ATIVO)
  const [links, setLinks] = useState<Record<number, LinkGerado>>({})
  const [gerando, setGerando] = useState<number | null>(null)
  const [mensagem, setMensagem] = useState('')

  if (!ativo) return null

  async function gerar(equipeId: number) {
    setGerando(equipeId)
    setMensagem('')
    try {
      const resposta = await fetch('/api/banco/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partidaId, equipeId }),
      })
      const lido = await lerEnvelope<LinkGerado>(resposta)
      if (lido.tipo === 'ok' && lido.data?.url) setLinks((atual) => ({ ...atual, [equipeId]: lido.data }))
      else if (lido.tipo === 'desligado') setMensagem('O app de banco não está habilitado para esta partida.')
      else setMensagem(lido.tipo === 'erro' ? lido.mensagem : 'Não foi possível gerar o link.')
    } catch {
      setMensagem('Sem conexão para gerar o link. Tente de novo.')
    } finally {
      setGerando(null)
    }
  }

  async function copiar(equipeId: number, url: string) {
    try {
      await navigator.clipboard.writeText(url)
      setMensagem('Link copiado.')
    } catch {
      setMensagem(`Não foi possível copiar automaticamente. Selecione o link: ${url}`)
    }
    void equipeId
  }

  return (
    <section aria-label="Link do banco" className="rounded-lg border-2 border-blue-700 bg-white p-3 text-slate-900">
      <h3 className="text-sm font-bold text-blue-900">Link do banco de reservas</h3>
      <ul className="mt-2 space-y-2">
        {equipes.map((equipe) => {
          const link = links[equipe.equipeId]
          return (
            <li key={equipe.equipeId} className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 text-sm font-semibold">{equipe.nome}</span>
                <button
                  type="button"
                  disabled={gerando === equipe.equipeId}
                  onClick={() => void gerar(equipe.equipeId)}
                  className="min-h-[48px] rounded-md bg-blue-700 px-4 text-sm font-bold text-white disabled:opacity-50"
                >
                  {gerando === equipe.equipeId ? 'Gerando...' : link ? 'Gerar novo link' : 'Gerar link'}
                </button>
              </div>
              {link ? (
                <div className="space-y-1">
                  <input readOnly value={link.url} aria-label={`Link do banco de ${equipe.nome}`} onFocus={(e) => e.currentTarget.select()} className="w-full rounded border border-slate-400 p-2 text-xs" />
                  {link.expiraEm ? <p className="text-xs text-slate-700">Vale até {new Date(link.expiraEm).toLocaleString('pt-BR')}.</p> : null}
                  <div className="flex gap-2">
                    <button type="button" onClick={() => void copiar(equipe.equipeId, link.url)} className="min-h-[48px] flex-1 rounded-md border-2 border-slate-500 px-3 text-sm font-bold">Copiar</button>
                    <a href={linkWhatsapp(link.url, equipe.nome)} target="_blank" rel="noopener noreferrer" className="flex min-h-[48px] flex-1 items-center justify-center rounded-md border-2 border-green-700 px-3 text-sm font-bold text-green-900">WhatsApp</a>
                  </div>
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
      <p role="status" className="mt-1 text-xs text-slate-700">{mensagem}</p>
    </section>
  )
}
