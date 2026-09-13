'use client'

import { Plus } from 'lucide-react'

// Mesmo formato/dimensões de ChampionshipCard (item 12) — não o botão
// redondo antigo (VolleyballActionButton). É o elemento de maior destaque
// da tela quando a organização ainda não tem nenhum campeonato.
export function EmptyChampionshipCard({ onCreate, creating }: { onCreate: () => void; creating: boolean }) {
  return (
    <button
      type="button"
      onClick={onCreate}
      disabled={creating}
      className="group flex h-full w-full flex-col items-center justify-center gap-3 rounded-[2rem] border-2 border-dashed border-luva-amber/40 bg-luva-amber/[0.04] p-8 text-center transition hover:border-luva-amber/70 hover:bg-luva-amber/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-luva-amber text-[#050914] transition group-hover:scale-105">
        <Plus size={26} strokeWidth={2.5} />
      </span>
      <span className="font-display text-3xl font-black leading-tight text-[#ffffff]">
        {creating ? 'Criando...' : (
          <>
            + Novo
            <br />
            Campeonato
          </>
        )}
      </span>
    </button>
  )
}
