import { CircleOff } from 'lucide-react'

type Props = {
  titulo: string
  descricao?: string
  icone?: React.ReactNode
  acao?: React.ReactNode
}

export function EstadoVazio({ titulo, descricao, icone, acao }: Props) {
  return (
    <div className="luva-surface flex min-h-72 flex-col items-center justify-center rounded-2xl px-6 py-14 text-center motion-in">
      <span className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/8 text-luva-amber">
        {icone ?? <CircleOff size={26} />}
      </span>
      <h3 className="font-display text-xl font-black text-white">{titulo}</h3>
      {descricao && <p className="mt-3 max-w-md text-sm font-semibold leading-7 text-slate-200">{descricao}</p>}
      {acao && <div className="mt-6">{acao}</div>}
    </div>
  )
}
