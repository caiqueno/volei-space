'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ArrowRight, ClipboardList, Trophy, UsersRound } from 'lucide-react'

type Ajuda = 'time' | 'convite' | null

const botao = 'flex min-h-[64px] w-full items-center gap-3 rounded-2xl border border-white/15 bg-white/[0.06] px-4 py-3 text-left transition hover:border-luva-amber/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-luva-amber'

/** Tela de /cadastro sem parâmetro: pergunta o objetivo antes de levar a qualquer fluxo. */
export function EscolhaInicial() {
  const [ajuda, setAjuda] = useState<Ajuda>(null)

  return (
    <main className="min-h-screen bg-[#020611] px-5 py-10 text-white">
      <div className="mx-auto flex w-full max-w-md flex-col gap-4">
        <h1 className="font-display text-3xl font-black leading-tight">O que você quer fazer hoje?</h1>
        <p className="text-sm font-semibold text-slate-300">Escolha uma opção e a gente leva você ao lugar certo.</p>

        <button type="button" onClick={() => setAjuda('time')} aria-expanded={ajuda === 'time'} className={botao}>
          <UsersRound size={22} className="shrink-0 text-luva-amber" />
          <span className="flex-1"><strong className="block text-base font-black">Cadastrar meu time</strong><span className="text-xs font-semibold text-slate-300">Inscrever sua equipe em uma categoria</span></span>
        </button>
        <Link href="/meu-time" className={botao}>
          <UsersRound size={22} className="shrink-0 text-luva-amber" />
          <span className="flex-1"><strong className="block text-base font-black">Ir para o Meu Time</strong><span className="text-xs font-semibold text-slate-300">Atletas, comissão técnica e inscrições do seu time</span></span>
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
        <Link href="/seja-membro" className={botao}>
          <Trophy size={22} className="shrink-0 text-luva-amber" />
          <span className="flex-1"><strong className="block text-base font-black">Organizar um campeonato</strong><span className="text-xs font-semibold text-slate-300">Criar campeonato, categorias e convidar equipes</span></span>
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
        <button type="button" onClick={() => setAjuda('convite')} aria-expanded={ajuda === 'convite'} className={botao}>
          <ClipboardList size={22} className="shrink-0 text-luva-amber" />
          <span className="flex-1"><strong className="block text-base font-black">Recebi um convite</strong><span className="text-xs font-semibold text-slate-300">O organizador me mandou um link</span></span>
        </button>

        {ajuda && (
          <p role="status" className="rounded-2xl border border-luva-amber/40 bg-luva-amber/10 px-4 py-3 text-sm font-semibold leading-6 text-amber-50">
            {ajuda === 'time'
              ? 'A inscrição acontece pelo link da categoria que o organizador envia. Peça esse link e abra por ele: você cadastra a equipe e os atletas na hora, sem esperar aprovação.'
              : 'Abra o link do convite que você recebeu (por exemplo, no WhatsApp). Ele leva direto ao cadastro da sua equipe na categoria certa.'}
          </p>
        )}

        <p className="mt-2 text-center text-sm font-semibold text-slate-300">
          Já tem conta? <Link href="/login" className="font-black text-luva-amber underline">Entrar</Link>
        </p>
      </div>
    </main>
  )
}
