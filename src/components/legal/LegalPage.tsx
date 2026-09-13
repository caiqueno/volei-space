import Link from 'next/link'
import type { ReactNode } from 'react'
import { ArrowLeft, CalendarDays, FileCheck2, ShieldCheck } from 'lucide-react'

export type LegalSection = {
  id: string
  title: string
  content: ReactNode
}

type LegalPageProps = {
  eyebrow: string
  title: string
  description: string
  updatedAt: string
  sections: LegalSection[]
  icon?: 'terms' | 'privacy' | 'cookies'
}

const icons = {
  terms: FileCheck2,
  privacy: ShieldCheck,
  cookies: CalendarDays,
}

export function LegalPage({ eyebrow, title, description, updatedAt, sections, icon = 'terms' }: LegalPageProps) {
  const Icon = icons[icon]

  return (
    <div className="legal-page min-h-screen bg-[#f4f7fb] text-slate-900">
      <section className="legal-page-hero relative overflow-hidden bg-[#061426] text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_10%,rgba(239,159,39,0.22),transparent_34%),radial-gradient(circle_at_15%_85%,rgba(24,95,165,0.28),transparent_38%)]" />
        <div className="relative mx-auto max-w-7xl px-4 py-14 md:py-20">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-extrabold text-slate-300 transition hover:text-white">
            <ArrowLeft size={17} /> Voltar para o início
          </Link>
          <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_320px] lg:items-end">
            <div>
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-luva-amber"><Icon size={18} /> {eyebrow}</p>
              <h1 className="legal-page-hero-title mt-4 max-w-4xl text-4xl font-black leading-tight md:text-6xl">{title}</h1>
              <p className="mt-5 max-w-3xl text-base font-semibold leading-8 text-slate-300 md:text-lg">{description}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur-sm">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-600">Última atualização</p>
              <p className="mt-2 text-base font-black text-slate-600">{updatedAt}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 lg:grid-cols-[270px_minmax(0,1fr)] lg:py-14">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <nav aria-label="Nesta página" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Nesta página</p>
            <ol className="mt-4 space-y-1">
              {sections.map((section, index) => (
                <li key={section.id}>
                  <a href={`#${section.id}`} className="flex gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950">
                    <span className="text-luva-blue">{String(index + 1).padStart(2, '0')}</span><span>{section.title}</span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </aside>

        <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          {sections.map((section, index) => (
            <section id={section.id} key={section.id} className="scroll-mt-28 border-b border-slate-200 px-6 py-8 last:border-b-0 md:px-10 md:py-10">
              <div className="flex items-start gap-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#061426] text-xs font-black text-luva-amber">{String(index + 1).padStart(2, '0')}</span>
                <div className="legal-copy min-w-0 flex-1">
                  <h2 className="text-2xl font-black tracking-tight text-slate-600">{section.title}</h2>
                  <div className="mt-5 space-y-4 text-[15px] font-medium leading-7 text-slate-600">{section.content}</div>
                </div>
              </div>
            </section>
          ))}
        </article>
      </div>

      {/*<section className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm font-semibold text-slate-600 md:flex-row md:items-center md:justify-between">
         <p>Documentos legais da plataforma volei.space.</p>
          <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Outros documentos legais">
            <Link className="font-extrabold text-luva-blue hover:underline" href="/termos-de-uso">Termos de Uso</Link>
            <Link className="font-extrabold text-luva-blue hover:underline" href="/politica-de-privacidade">Privacidade</Link>
            <Link className="font-extrabold text-luva-blue hover:underline" href="/politica-de-cookies">Cookies</Link>
          </nav>
        </div>
      </section>*/}
    </div>
  )
}

export function LegalList({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-2 pl-5 marker:text-luva-amber">{children}</ul>
}

export function LegalNotice({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 font-semibold text-amber-950">{children}</div>
}
