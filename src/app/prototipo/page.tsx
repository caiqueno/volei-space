import Link from 'next/link'
import { PERFIS, rotaPasso } from '@/lib/prototipo/roteiro'
import { AVISO_EXEMPLO } from '@/lib/prototipo/exemplo'

export default function PrototipoInicio() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6">
      <p className="inline-block rounded-full border border-vs-gold px-3 py-1 text-xs font-bold uppercase tracking-wide text-vs-gold">
        {AVISO_EXEMPLO}
      </p>
      <h1 className="mt-3 text-3xl font-bold">Conheça o volei.space</h1>
      <p className="mt-1 text-vs-muted">
        Escolha um perfil e percorra as telas. Tudo aqui é demonstração: nada é salvo e os dados são fictícios.
      </p>
      <ul className="mt-6 grid gap-3">
        {PERFIS.map((p) => (
          <li key={p.id}>
            <Link
              href={rotaPasso(p.id, p.passos[0].id)}
              className="flex min-h-[44px] flex-col gap-1 rounded-2xl border border-vs-border bg-vs-surface p-4 hover:border-vs-blue focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vs-gold"
            >
              <span className="text-lg font-bold">{p.nome}</span>
              <span className="text-vs-muted">{p.descricao}</span>
              <span className="text-sm text-vs-blue">{p.passos.length} {p.passos.length === 1 ? 'tela' : 'telas'}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
