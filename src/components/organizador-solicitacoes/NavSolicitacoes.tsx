'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Bell, Inbox } from 'lucide-react'
import { usePollingVisivel, type ResultadoConsulta } from '@/lib/ao-vivo-ui/usePollingVisivel'
import {
  INTERVALO_SOLICITACOES_MS, contarPendentes, dataCurta, destinoNotificacao, normalizarNotificacoes,
  normalizarSolicitacoes, rotuloContador, solicitacoesAtivo, tratarResposta, urlSolicitacoes,
  type NotificacaoOrganizador,
} from '@/lib/organizador-solicitacoes-ui'

function useAtivo() {
  return solicitacoesAtivo(process.env.NEXT_PUBLIC_INSCRICAO_SOLICITACAO_ATIVO)
}

/** Item "Solicitações" do menu com contador de pendentes. Desligado pela flag: não renderiza nem consulta. */
export function ItemNavSolicitacoes() {
  const ativo = useAtivo()
  const pathname = usePathname()
  const [pendentes, setPendentes] = useState(0)

  const buscar = useCallback(async (sinal: AbortSignal): Promise<ResultadoConsulta> => {
    try {
      const r = await fetch(urlSolicitacoes('PENDENTE'), { cache: 'no-store', signal: sinal })
      const corpo = await r.json().catch(() => null)
      const t = tratarResposta(r.status, corpo)
      if (!t.ok) return t.tipo === 'desligado' || t.tipo === 'nao-habilitado' ? 'parar' : 'falha'
      setPendentes(contarPendentes(normalizarSolicitacoes(corpo)))
      return 'ok'
    } catch {
      return sinal.aborted ? 'ok' : 'falha'
    }
  }, [])
  usePollingVisivel(buscar, { ativo, baseMs: INTERVALO_SOLICITACOES_MS, maxMs: 60_000 })

  if (!ativo) return null
  const active = pathname.startsWith('/admin/solicitacoes')
  const contador = rotuloContador(pendentes)
  return (
    <Link
      href="/admin/solicitacoes"
      aria-current={active ? 'page' : undefined}
      className={`admin-nav-link flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-bold transition ${active ? 'admin-nav-link-active' : ''}`}
    >
      <Inbox size={18} />
      <span className="flex-1">Solicitações</span>
      {contador && (
        <span className="rounded-full bg-luva-amber px-2 py-0.5 text-xs font-black text-[#07111f]" aria-label={`${pendentes} pendentes`}>
          {contador}
        </span>
      )}
    </Link>
  )
}

/** Sino de notificações do organizador. Tipo SOLICITACAO_INSCRICAO leva à fila. */
export function SinoNotificacoesOrganizador() {
  const ativo = useAtivo()
  const router = useRouter()
  const [lista, setLista] = useState<NotificacaoOrganizador[]>([])
  const [naoLidas, setNaoLidas] = useState(0)
  const [aberto, setAberto] = useState(false)
  const [erro, setErro] = useState(false)
  const caixa = useRef<HTMLDivElement>(null)

  const buscar = useCallback(async (sinal: AbortSignal): Promise<ResultadoConsulta> => {
    try {
      const r = await fetch('/api/organizador/notificacoes', { cache: 'no-store', signal: sinal })
      const corpo = await r.json().catch(() => null)
      const t = tratarResposta(r.status, corpo)
      if (!t.ok) {
        if (t.tipo === 'desligado' || t.tipo === 'nao-habilitado') return 'parar'
        setErro(true)
        return 'falha'
      }
      const n = normalizarNotificacoes(corpo)
      setLista(n.lista)
      setNaoLidas(n.naoLidas)
      setErro(false)
      return 'ok'
    } catch {
      return sinal.aborted ? 'ok' : 'falha'
    }
  }, [])
  usePollingVisivel(buscar, { ativo, baseMs: INTERVALO_SOLICITACOES_MS, maxMs: 60_000 })

  useEffect(() => {
    if (!aberto) return
    const fora = (e: MouseEvent) => { if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false) }
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberto(false) }
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('mousedown', fora)
      document.removeEventListener('keydown', tecla)
    }
  }, [aberto])

  if (!ativo) return null

  async function abrirNotificacao(n: NotificacaoOrganizador) {
    if (!n.lida) {
      setLista((atual) => atual.map((x) => (x.id === n.id ? { ...x, lida: true } : x)))
      setNaoLidas((v) => Math.max(0, v - 1))
      void fetch(`/api/organizador/notificacoes/${encodeURIComponent(n.id)}/lida`, { method: 'POST' }).catch(() => undefined)
    }
    const destino = destinoNotificacao(n.tipo)
    if (destino) {
      setAberto(false)
      router.push(destino)
    }
  }

  const contador = rotuloContador(naoLidas)
  return (
    <div ref={caixa} className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        aria-haspopup="true"
        aria-label={naoLidas > 0 ? `Notificações, ${naoLidas} não lidas` : 'Notificações'}
        className="admin-nav-link flex min-h-[44px] w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-luva-amber"
      >
        <Bell size={18} />
        <span className="flex-1 text-left">Notificações</span>
        {contador && <span className="rounded-full bg-luva-amber px-2 py-0.5 text-xs font-black text-[#07111f]">{contador}</span>}
      </button>
      {aberto && (
        <div className="absolute left-0 right-0 z-40 mt-2 max-h-80 overflow-y-auto rounded-2xl border border-white/15 bg-[#0b1a2c] p-2 shadow-xl lg:left-full lg:right-auto lg:top-0 lg:ml-2 lg:mt-0 lg:w-80">
          {erro && <p role="alert" className="px-3 py-2 text-xs font-bold text-red-300">Não foi possível atualizar as notificações.</p>}
          {lista.length === 0 ? (
            <p className="px-3 py-4 text-sm font-semibold text-slate-300">Nenhuma notificação.</p>
          ) : (
            <ul>
              {lista.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => void abrirNotificacao(n)}
                    className={`block min-h-[44px] w-full rounded-xl px-3 py-2 text-left hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-luva-amber ${n.lida ? 'opacity-70' : ''}`}
                  >
                    <span className="flex items-center gap-2 text-sm font-black text-white">
                      {!n.lida && <span className="h-2 w-2 shrink-0 rounded-full bg-luva-amber" aria-label="Não lida" />}
                      {n.titulo}
                    </span>
                    <span className="block text-xs font-semibold text-slate-300">{n.mensagem}</span>
                    <span className="block text-[11px] font-semibold text-slate-400">{dataCurta(n.criadaEm)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
