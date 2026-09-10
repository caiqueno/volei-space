export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { CalendarPlus, ExternalLink, FileText } from 'lucide-react'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { Badge } from '@/components/ui/Badge'
import { AprovarButton } from './AprovarButton'
import { EscalarArbitroButton } from './EscalarArbitroButton'

const statusLabel: Record<string, string> = {
  AGENDADA: 'Agendada',
  EM_ANDAMENTO: 'Em andamento',
  PENDENTE_APROVACAO: 'Aguardando aprovação',
  ENCERRADA: 'Encerrada',
  WO: 'W.O.',
}

const statusVariant: Record<string, 'neutral' | 'info' | 'warning' | 'success' | 'error'> = {
  AGENDADA: 'neutral',
  EM_ANDAMENTO: 'info',
  PENDENTE_APROVACAO: 'warning',
  ENCERRADA: 'success',
  WO: 'error',
}

export default async function AdminPartidasPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams
  let q = supabase
    .from('Partida')
    .select(`
      *,
      equipeA:Equipe!equipeAId(*),
      equipeB:Equipe!equipeBId(*),
      sets:SetPartida(*),
      escala:EscalaArbitro(*, arbitro:Arbitro(*)),
      candidaturasArbitro:CandidaturaPartidaArbitro(*, candidatura:CandidaturaArbitro(*))
    `)
    .order('rodada', { ascending: true })
    .order('dataHora', { ascending: true })

  if (sp.status) q = q.eq('status', sp.status)

  const { data } = await q
  const partidas = (data ?? []) as any[]

  const statusFiltros = [
    { label: 'Todas', value: '' },
    { label: 'Agendadas', value: 'AGENDADA' },
    { label: 'Pendentes', value: 'PENDENTE_APROVACAO' },
    { label: 'Encerradas', value: 'ENCERRADA' },
  ]

  return (
    <div className="space-y-6">
      <section className="rounded-[1.75rem] border border-white/10 bg-[#0b1726]/92 p-6 shadow-[0_24px_70px_rgba(0,0,0,.22)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-luva-amber">Calendário operacional</p>
            <h2 className="mt-2 font-display text-3xl font-black text-white">Partidas</h2>
            <p className="mt-2 text-sm font-bold text-slate-300">{partidas.length} partida(s) encontrada(s)</p>
          </div>
          <Link
            href="/admin/partidas/nova"
            className="inline-flex w-fit items-center gap-2 rounded-full bg-luva-amber px-5 py-3 text-sm font-black text-white transition hover:brightness-110"
          >
            <CalendarPlus size={17} />
            Nova partida
          </Link>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {statusFiltros.map((f) => (
            <Link
              key={f.value}
              href={f.value ? `/admin/partidas?status=${f.value}` : '/admin/partidas'}
              className={`admin-filter-pill rounded-full px-4 py-2 text-sm font-black transition ${
                (sp.status ?? '') === f.value ? 'admin-filter-pill-active' : 'admin-filter-pill-idle'
              }`}
            >
              {f.label}
            </Link>
          ))}
        </div>
      </section>

      {partidas.length === 0 ? (
        <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-12 text-center text-sm font-bold text-slate-300">
          Nenhuma partida encontrada.
        </div>
      ) : (
        <div className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#0b1726]/90 shadow-[0_24px_70px_rgba(0,0,0,.22)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="border-b border-white/10 bg-white/[0.04]">
                <tr>
                  <th className="px-5 py-4 text-left text-xs font-black uppercase tracking-[0.16em] text-slate-300">Rd</th>
                  <th className="px-5 py-4 text-left text-xs font-black uppercase tracking-[0.16em] text-slate-300">Partida</th>
                  <th className="px-5 py-4 text-left text-xs font-black uppercase tracking-[0.16em] text-slate-300">Data</th>
                  <th className="px-5 py-4 text-left text-xs font-black uppercase tracking-[0.16em] text-slate-300">Placar</th>
                  <th className="px-5 py-4 text-left text-xs font-black uppercase tracking-[0.16em] text-slate-300">Arbitragem</th>
                  <th className="px-5 py-4 text-left text-xs font-black uppercase tracking-[0.16em] text-slate-300">Status</th>
                  <th className="px-5 py-4 text-left text-xs font-black uppercase tracking-[0.16em] text-slate-300">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {partidas.map((p) => {
                  const sets = (p.sets ?? []) as any[]
                  const setsPlacar = sets.reduce<{ a: number; b: number }>(
                    (acc, s) => {
                      if (s.pontosA > s.pontosB) acc.a++
                      else if (s.pontosB > s.pontosA) acc.b++
                      return acc
                    },
                    { a: 0, b: 0 },
                  )
                  const escala = (p.escala ?? []) as any[]
                  const candidaturas = ((p.candidaturasArbitro ?? []) as any[]).filter((item) =>
                    ['SOLICITADA', 'PENDENTE'].includes(String(item.status ?? '').toUpperCase()),
                  )

                  return (
                    <tr key={p.id} className="transition hover:bg-white/[0.035]">
                      <td className="px-5 py-5">
                        <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-luva-amber px-2 text-xs font-black text-white">
                          {p.rodada}
                        </span>
                      </td>
                      <td className="px-5 py-5">
                        <p className="font-black text-white">{p.equipeA?.nome ?? 'Equipe A'} × {p.equipeB?.nome ?? 'Equipe B'}</p>
                        <p className="mt-1 text-xs font-bold text-slate-400">{p.localNome || p.localEndereco || 'Local a definir'}</p>
                      </td>
                      <td className="px-5 py-5 font-bold text-slate-200">
                        {formatDateTime(p.dataHora)}
                      </td>
                      <td className="px-5 py-5">
                        <span className="font-black text-white">{sets.length > 0 ? `${setsPlacar.a} × ${setsPlacar.b}` : '—'}</span>
                      </td>
                      <td className="px-5 py-5">
                        {escala.length > 0 ? (
                          <div className="space-y-1">
                            {escala.map((item) => (
                              <p key={item.id} className="text-sm font-black text-emerald-200">
                                {item.arbitro?.nome ?? 'Árbitro escalado'}
                              </p>
                            ))}
                          </div>
                        ) : candidaturas.length > 0 ? (
                          <div className="space-y-2">
                            {candidaturas.map((item) => (
                              <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.045] px-3 py-2">
                                <div>
                                  <p className="font-black text-white">{item.candidatura?.nome ?? 'Árbitro'}</p>
                                  <p className="text-xs font-bold text-slate-400">{item.candidatura?.email}</p>
                                </div>
                                <EscalarArbitroButton candidaturaId={item.id} />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs font-bold text-slate-400">Sem candidatura</span>
                        )}
                      </td>
                      <td className="px-5 py-5">
                        <Badge variant={statusVariant[p.status] ?? 'neutral'}>
                          {statusLabel[p.status] ?? normalizeStatus(p.status)}
                        </Badge>
                      </td>
                      <td className="px-5 py-5">
                        <div className="flex flex-wrap items-center gap-2">
                          {p.sumulaToken && (
                            <>
                              <a
                                href={`/arbitro/partida/${p.sumulaToken}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1.5 text-xs font-black text-slate-100 transition hover:bg-white/10"
                              >
                                <ExternalLink size={14} />
                                Operação
                              </a>
                              <a
                                href={`/sumula/${p.sumulaToken}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1.5 text-xs font-black text-slate-100 transition hover:bg-white/10"
                              >
                                <FileText size={14} />
                                Súmula
                              </a>
                            </>
                          )}
                          {p.status === 'PENDENTE_APROVACAO' && <AprovarButton partidaId={p.id} />}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Data a definir'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function normalizeStatus(status?: string | null) {
  return String(status ?? 'Status').replace(/_/g, ' ').toLowerCase()
}
