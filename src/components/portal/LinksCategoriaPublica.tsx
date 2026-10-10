import Link from 'next/link'

export function LinksCategoriaPublica({
  categorias,
  atual,
  href,
}: {
  categorias: { id: string; nome: string }[]
  atual: string | null
  href: (id: string) => string
}) {
  if (categorias.length <= 1) {
    return categorias[0] ? <p className="text-sm font-bold text-slate-300">Categoria: {categorias[0].nome}</p> : null
  }
  return (
    <nav className="flex flex-wrap gap-2" aria-label="Categoria">
      {categorias.map((categoria) => {
        const ativa = categoria.id === atual
        return (
          <Link
            key={categoria.id}
            href={href(categoria.id)}
            aria-current={ativa ? 'page' : undefined}
            className={`rounded-full px-4 py-2 text-sm font-black ${ativa ? 'bg-[#ffb331] text-slate-950' : 'border border-white/15 text-white'}`}
          >
            {categoria.nome}
          </Link>
        )
      })}
    </nav>
  )
}
