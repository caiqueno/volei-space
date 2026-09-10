import LoadingSpinner from './loading-spinner'

type Props = {
  label?: string
}

export default function PageLoading({ label = 'Carregando...' }: Props) {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-4 bg-[#010b18]/90 backdrop-blur-sm">
      <LoadingSpinner size={128} />
      <p className="text-sm font-semibold tracking-wide text-[#c9d5e4]">{label}</p>
    </div>
  )
}
