'use client'

import { useCallback, useEffect, useState } from 'react'
import { bancoAppAtivo, lerEnvelope, linksAtivos, linkWhatsapp, normalizarLinksBanco, type LinkBancoAtivo } from '@/lib/sumula-banco-ui'

export interface LinkBancoProps {
  partidaId: number
  equipes: Array<{ equipeId: number; nome: string }>
}

interface LinkGerado {
  url: string
  expiraEm?: string
  acessoId?: string | number
}

/** Gera, copia, compartilha e revoga o link do banco de cada equipe. Flag desligada: não renderiza nem faz requisição. */
export function LinkBanco({ partidaId, equipes }: LinkBancoProps) {
  const ativo = bancoAppAtivo(process.env.NEXT_PUBLIC_BANCO_APP_ATIVO)
  const [links, setLinks] = useState<Record<number, LinkGerado>>({})
  const [existentes, setExistentes] = useState<LinkBancoAtivo[]>([])
  const [gerando, setGerando] = useState<number | null>(null)
  const [confirmandoRevogar, setConfirmandoRevogar] = useState<string | null>(null)
  const [revogando, setRevogando] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState('')

  const carregarLinks = useCallback(async () => {
    try {
      const resposta = await fetch(`/api/banco/links?partidaId=${encodeURIComponent(String(partidaId))}`, { cache: 'no-store' })
      const lido = await lerEnvelope<unknown>(resposta)
      if (lido.tipo === 'ok') setExistentes(normalizarLinksBanco(lido.data))
    } catch {
      // Sem conexão: a lista de links ativos fica como estava; gerar um link novo continua possível.
    }
  }, [partidaId])

  useEffect(() => {
    if (!ativo) return
    void carregarLinks()
  }, [ativo, carregarLinks])

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
      if (lido.tipo === 'ok' && lido.data?.url) {
        setLinks((atual) => ({ ...atual, [equipeId]: lido.data }))
        void carregarLinks()
      } else if (lido.tipo === 'desligado') setMensagem('O app de banco não está habilitado para esta partida.')
      else setMensagem(lido.tipo === 'erro' ? lido.mensagem : 'Não foi possível gerar o link.')
    } catch {
      setMensagem('Sem conexão para gerar o link. Tente de novo.')
    } finally {
      setGerando(null)
    }
  }

  async function revogar(acessoId: string) {
    setRevogando(acessoId)
    setMensagem('')
    try {
      const resposta = await fetch(`/api/banco/links?acessoId=${encodeURIComponent(acessoId)}`, { method: 'DELETE' })
      const lido = await lerEnvelope<unknown>(resposta)
      if (lido.tipo === 'ok') {
        setMensagem('Link revogado. Quem tem esse endereço não consegue mais abrir o banco.')
        setLinks((atual) => {
          const proximo = { ...atual }
          for (const [chave, valor] of Object.entries(proximo)) if (String(valor.acessoId ?? '') === acessoId) delete proximo[Number(chave)]
          return proximo
        })
        setConfirmandoRevogar(null)
        await carregarLinks()
      } else {
        setMensagem(lido.tipo === 'erro' ? `Não foi possível revogar o link: ${lido.mensagem}` : 'O app de banco não está habilitado para esta partida.')
      }
    } catch {
      setMensagem('Sem conexão para revogar o link. Tente de novo.')
    } finally {
      setRevogando(null)
    }
  }

  async function copiar(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      setMensagem('Link copiado.')
    } catch {
      setMensagem(`Não foi possível copiar automaticamente. Selecione o link: ${url}`)
    }
  }

  const ativos = linksAtivos(existentes)

  return (
    <section aria-label="Link do banco" className="rounded-lg border-2 border-blue-700 bg-white p-3 text-slate-900">
      <h3 className="text-sm font-bold text-blue-900">Link do banco de reservas</h3>
      <ul className="mt-2 space-y-2">
        {equipes.map((equipe) => {
          const link = links[equipe.equipeId]
          const doTime = ativos.filter((l) => l.equipeId === equipe.equipeId)
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
                  {gerando === equipe.equipeId ? 'Gerando...' : link || doTime.length > 0 ? 'Gerar novo link' : 'Gerar link'}
                </button>
              </div>
              {link ? (
                <div className="space-y-1">
                  <input readOnly value={link.url} aria-label={`Link do banco de ${equipe.nome}`} onFocus={(e) => e.currentTarget.select()} className="w-full rounded border border-slate-400 p-2 text-xs" />
                  {link.expiraEm ? <p className="text-xs text-slate-700">Vale até {new Date(link.expiraEm).toLocaleString('pt-BR')}.</p> : null}
                  <div className="flex gap-2">
                    <button type="button" onClick={() => void copiar(link.url)} className="min-h-[48px] flex-1 rounded-md border-2 border-slate-500 px-3 text-sm font-bold">Copiar</button>
                    <a href={linkWhatsapp(link.url, equipe.nome)} target="_blank" rel="noopener noreferrer" className="flex min-h-[48px] flex-1 items-center justify-center rounded-md border-2 border-green-700 px-3 text-sm font-bold text-green-900">WhatsApp</a>
                  </div>
                </div>
              ) : null}
              {doTime.length > 0 ? (
                <ul className="space-y-1" aria-label={`Links ativos de ${equipe.nome}`}>
                  {doTime.map((l) => (
                    <li key={l.acessoId} className="rounded border border-slate-300 p-2 text-xs">
                      <p>
                        Link ativo{l.criadoEm ? `, criado em ${new Date(l.criadoEm).toLocaleString('pt-BR')}` : ''}
                        {l.expiraEm ? `, vale até ${new Date(l.expiraEm).toLocaleString('pt-BR')}` : ''}.
                      </p>
                      {confirmandoRevogar === l.acessoId ? (
                        <div role="group" aria-label="Confirmar revogação" className="mt-1">
                          <p className="font-bold">Revogar este link? Quem o tem deixa de abrir o banco.</p>
                          <div className="mt-1 flex gap-2">
                            <button
                              type="button"
                              disabled={revogando === l.acessoId}
                              onClick={() => void revogar(l.acessoId)}
                              className="min-h-[48px] flex-1 rounded-md bg-red-700 px-3 text-sm font-bold text-white disabled:opacity-50"
                            >
                              {revogando === l.acessoId ? 'Revogando...' : 'Sim, revogar'}
                            </button>
                            <button
                              type="button"
                              disabled={revogando === l.acessoId}
                              onClick={() => setConfirmandoRevogar(null)}
                              className="min-h-[48px] flex-1 rounded-md border-2 border-slate-500 px-3 text-sm font-bold"
                            >
                              Voltar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmandoRevogar(l.acessoId)}
                          className="mt-1 min-h-[48px] rounded-md border-2 border-red-700 px-3 text-sm font-bold text-red-900"
                        >
                          Revogar
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          )
        })}
      </ul>
      <p role="status" className="mt-1 text-xs text-slate-700">{mensagem}</p>
    </section>
  )
}
