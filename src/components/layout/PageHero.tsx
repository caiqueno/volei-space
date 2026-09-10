type PageHeroProps = {
  eyebrow: React.ReactNode
  title: string
  description: string
  aside?: React.ReactNode
}

export function PageHero({ eyebrow, title, description, aside }: PageHeroProps) {
  return (
    <section className="orange-wave">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 lg:grid-cols-[1fr_380px] lg:items-end">
        <div className="motion-in">
          <p className="luva-kicker flex items-center gap-2">{eyebrow}</p>
          <h1 className="mt-4 max-w-3xl font-display text-4xl font-black leading-none text-slate-950 md:text-6xl">{title}</h1>
          <p className="mt-5 max-w-2xl text-base font-semibold leading-8 text-slate-600">{description}</p>
        </div>
        {aside && <div className="motion-in-delay">{aside}</div>}
      </div>
    </section>
  )
}
