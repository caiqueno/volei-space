'use client'

import { RotateCcw, ShieldAlert } from 'lucide-react'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="sport-grid flex min-h-screen items-center justify-center px-4">
      <div className="glass-panel w-full max-w-md rounded-[2rem] p-8 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-600 text-white">
          <ShieldAlert size={28} />
        </span>
        <h1 className="mt-5 text-2xl font-black text-white">Não foi possível carregar</h1>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-200">
          Tivemos uma falha temporária ao buscar as informações. Tente novamente em instantes.
        </p>
        {process.env.NODE_ENV === 'development' && (
          <pre className="mt-5 overflow-auto rounded-2xl border border-red-200 bg-red-50 p-3 text-left text-xs text-red-700">
            {error.message}
          </pre>
        )}
        <button onClick={reset} className="mt-5 inline-flex items-center justify-center gap-2 rounded-2xl bg-[#ffb331] px-5 py-3 text-sm font-black text-white transition hover:bg-[#ffb331]">
          <RotateCcw size={16} />
          Tentar novamente
        </button>
      </div>
    </main>
  )
}
