import Link from 'next/link'
import { EstadoVazio } from '@/components/ui/EstadoVazio'

export const dynamic = 'force-dynamic'

export default function InscricaoRapidaPage() {
  return (
    <main className="luva-shell min-h-screen px-4 py-12 text-white">
      <EstadoVazio
        titulo="Esta página precisa do link da sua categoria"
        descricao="Não é possível inscrever uma equipe sem o link. Peça ao organizador o link da categoria (ele costuma chegar por WhatsApp) e abra-o neste aparelho. Por esse link a equipe é cadastrada direto, sem aprovação. Já começou a inscrição? Use o link do rascunho que você guardou."
        acao={(
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/" className="inline-flex min-h-[44px] items-center rounded-full bg-[#ffb331] px-5 py-2 text-sm font-black text-slate-950">Ir para o início</Link>
            <Link href="/login" className="inline-flex min-h-[44px] items-center rounded-full border border-white/20 px-5 py-2 text-sm font-black text-white">Sou organizador: entrar</Link>
          </div>
        )}
      />
    </main>
  )
}
