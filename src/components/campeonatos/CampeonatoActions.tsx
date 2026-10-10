'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowRight, LogIn, Send, UsersRound } from 'lucide-react'
import { FormAlert } from '@/components/parametrizacao/ui/FormAlert'
import { ActionBar } from '@/components/ui/action-bar'

type Session = {
  tipo: string
  candidaturaId?: string | null
}

type Feedback = {
  tipo: 'sucesso' | 'erro'
  texto: string
}

const AVISO_SEM_EQUIPE = 'Não encontramos a equipe desta sessão. Entre novamente para solicitar a inscrição.'

export function CampeonatoActions({
  ligaId,
  inscricoesAbertas = true,
  vagasDisponiveis = null,
  finalizado = false,
}: {
  ligaId: number
  inscricoesAbertas?: boolean
  vagasDisponiveis?: number | null
  finalizado?: boolean
}) {
  const [session, setSession] = useState<Session | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    try {
      setSession(JSON.parse(window.localStorage.getItem('luva_session') ?? 'null'))
    } catch {
      setSession(null)
    }
  }, [])

  async function solicitarInscricao() {
    if (!session?.candidaturaId) {
      setFeedback({ tipo: 'erro', texto: AVISO_SEM_EQUIPE })
      return
    }
    setLoading(true)
    setFeedback(null)
    try {
      const response = await fetch('/api/inscricoes-campeonato', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidaturaId: session.candidaturaId, ligaId }),
      })
      const json = await response.json().catch(() => ({})) as { error?: string }
      setFeedback(response.ok
        ? { tipo: 'sucesso', texto: 'Inscrição solicitada. A organização vai analisar sua equipe.' }
        : { tipo: 'erro', texto: json.error ?? 'Não foi possível solicitar inscrição.' })
    } catch {
      setFeedback({ tipo: 'erro', texto: 'Falha na conexão. Tente novamente em instantes.' })
    } finally {
      setLoading(false)
    }
  }

  if (!inscricoesAbertas) {
    return (
      <div className="championship-action-box grid gap-3 rounded-[1.5rem] border p-4">
        <p className="rounded-2xl border border-luva-amber/25 bg-luva-amber/10 px-4 py-3 text-sm font-bold text-slate-100">
          {finalizado
            ? 'Este campeonato está finalizado e não aceita novas inscrições.'
            : 'As inscrições estão fechadas ou o limite de equipes aprovadas foi atingido.'}
        </p>
        <Link href={`/portal?ligaId=${ligaId}`} className="landing-secondary inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-black">
          Abrir portal do campeonato
          <ArrowRight size={18} />
        </Link>
      </div>
    )
  }

  if (session?.tipo === 'equipe') {
    const semEquipe = !session.candidaturaId
    return (
      <div className="championship-action-box grid gap-3 rounded-[1.5rem] border p-4">
        <ActionBar onClick={solicitarInscricao} loading={loading} loadingLabel="Enviando" disabled={!inscricoesAbertas || semEquipe} className="landing-primary inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-60">
          <Send size={18} />
          Solicitar inscrição da equipe
        </ActionBar>
        <Link href={`/portal?ligaId=${ligaId}`} className="landing-secondary inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-black">
          Abrir portal do campeonato
          <ArrowRight size={18} />
        </Link>
        {vagasDisponiveis !== null && (
          <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-100">
            {vagasDisponiveis} vaga(s) aprovadas disponível(is).
          </p>
        )}
        {semEquipe && <FormAlert variant="error">{AVISO_SEM_EQUIPE}</FormAlert>}
        {feedback && <FormAlert variant={feedback.tipo === 'sucesso' ? 'success' : 'error'}>{feedback.texto}</FormAlert>}
      </div>
    )
  }

  if (session) {
    return (
      <div className="championship-action-box grid gap-3 rounded-[1.5rem] border p-4">
        <Link href={`/portal?ligaId=${ligaId}`} className="landing-primary inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-black">
          Abrir portal do campeonato
          <ArrowRight size={18} />
        </Link>
      </div>
    )
  }

  return (
    <div className="championship-action-box grid gap-3 rounded-[1.5rem] border p-4">
      <Link href={`/cadastro?modo=cadastro&perfil=equipe&ligaId=${ligaId}`} className="landing-primary inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-black">
        <UsersRound size={18} />
        Inscrever equipe
      </Link>
      <Link href="/login" className="landing-secondary inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-black">
        <LogIn size={18} />
        Já tenho conta
      </Link>
    </div>
  )
}
