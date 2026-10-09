export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { ArrowRight, CalendarDays, CheckCircle2, ClipboardCheck, UserRound, Users } from 'lucide-react'
import { isSupabaseConfigured } from '@/lib/supabase'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'

export default async function AdminDashboardPage() {
  let counts = { partidas: 0, equipes: 0, jogadores: 0, pendentes: 0 }
  let proximasPartidas: any[] = []

  if (isSupabaseConfigured) {
    const [{ count: partidas }, { count: equipes }, { count: jogadores }, { count: pendentes }] = await Promise.all([
      supabase.from('Partida').select('id', { count: 'exact', head: true }),
      supabase.from('Equipe').select('id', { count: 'exact', head: true }),
      supabase.from('Jogador').select('id', { count: 'exact', head: true }),
      supabase.from('Partida').select('id', { count: 'exact', head: true }).eq('status', 'PENDENTE_APROVACAO'),
    ])

    counts = { partidas: partidas ?? 0, equipes: equipes ?? 0, jogadores: jogadores ?? 0, pendentes: pendentes ?? 0 }

    const { data } = await supabase
      .from('Partida')
      .select('*, equipeA:Equipe!Partida_equipeAId_fkey(nome), equipeB:Equipe!Partida_equipeBId_fkey(nome)')
      .in('status', ['AGENDADA', 'EM_ANDAMENTO'])
      .order('dataHora', { ascending: true })
      .limit(5)
    proximasPartidas = data ?? []
  }

  const cards = [
    { label: 'Partidas', value: counts.partidas, href: '/admin/partidas', icon: CalendarDays },
    { label: 'Equipes', value: counts.equipes, href: '/admin/equipes', icon: Users },
    { label: 'Jogadores', value: counts.jogadores, href: '/admin/jogadores', icon: UserRound },
    { label: 'Súmulas pendentes', value: counts.pendentes, href: '/admin/partidas?status=PENDENTE_APROVACAO', icon: ClipboardCheck },
  ]

  return (
    <div className="grid gap-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-luva-blue">Resumo operacional</p>
            <h2 className="type-page-title mt-2 text-luva-navy">Painel do campeonato</h2>
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-luva-muted">
              Controle inscrições, equipes, atletas, calendário, súmulas e resultados da temporada em um só painel.
            </p>
          </div>
          {!isSupabaseConfigured && <span className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-black text-amber-800">Supabase pendente</span>}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, href, icon: Icon }) => (
          <Link key={href} href={href} className="group rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-luva-blue">
            <div className="flex items-center justify-between text-luva-blue">
              <Icon size={24} />
              <ArrowRight size={18} className="transition group-hover:translate-x-1" />
            </div>
            <p className="mt-7 text-4xl font-black text-luva-navy">{value}</p>
            <p className="mt-1 text-sm font-black text-luva-muted">{label}</p>
          </Link>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-2xl font-black text-luva-navy">Próximas partidas</h3>
            <Link href="/admin/partidas" className="text-sm font-black text-luva-blue hover:text-luva-navy">Ver todas</Link>
          </div>
          {proximasPartidas.length === 0 ? (
            <div className="rounded-xl bg-slate-50 p-5 text-sm font-bold text-luva-muted">Nenhuma partida agendada ainda.</div>
          ) : (
            <div className="grid gap-3">
              {proximasPartidas.map((partida: any) => (
                <div key={partida.id} className="flex flex-col gap-2 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="font-black text-slate-950">{partida.equipeA?.nome} x {partida.equipeB?.nome}</p>
                  <p className="text-sm font-bold text-luva-muted">{partida.dataHora ? new Date(partida.dataHora).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Sem data'}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="text-2xl font-black text-luva-navy">Checklist inicial</h3>
          <div className="mt-5 grid gap-3">
            {['Configurar Supabase', 'Cadastrar equipes', 'Cadastrar atletas', 'Criar calendário', 'Validar súmula digital'].map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                <CheckCircle2 size={18} className="text-emerald-600" />
                <p className="text-sm font-bold text-slate-700">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
