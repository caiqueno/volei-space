import Link from 'next/link'
import { ArrowRight, UsersRound } from 'lucide-react'

type Props = {
  ligaId?: number | string | null
  className?: string
}

export function CampeonatoInscricaoCTA({ ligaId, className = '' }: Props) {
  if (!ligaId) return null

  return (
    <section className={`mx-auto max-w-7xl px-4 ${className}`}>
      <div className="championship-card flex flex-col gap-4 rounded-[1.5rem] border p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="luva-kicker">Inscrições</p>
          <h2 className="mt-1 font-display text-2xl font-black text-white">Quer colocar sua equipe neste campeonato?</h2>
        </div>
        <Link
          href={`/cadastro?modo=cadastro&perfil=equipe&ligaId=${ligaId}`}
          className="public-primary-action inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-black transition"
        >
          <UsersRound size={18} />
          Inscrever equipe
          <ArrowRight size={18} />
        </Link>
      </div>
    </section>
  )
}
