'use client'

import { useEffect, useMemo, useState } from 'react'
import { ClipboardCheck, QrCode, Trophy, UserRoundCheck } from 'lucide-react'

const steps = [
  {
    label: 'Cadastro',
    icon: UserRoundCheck,
    title: 'Cadastro sem improviso.',
    text: 'Equipes se cadastram, organizadores publicam campeonatos e fornecedores registram quadras em um fluxo preparado para análise e operação.',
    points: ['Equipe identificada', 'Dados centralizados', 'Inscrição pronta para análise'],
  },
  {
    label: 'Validação',
    icon: QrCode,
    title: 'Pré-jogo conferido.',
    text: 'No dia da partida, o árbitro valida atletas por QR Code, acompanha o progresso por equipe e libera o jogo com elenco conferido.',
    points: ['QR Code por atleta', 'Progresso por time', 'Liberação de partida'],
  },
  {
    label: 'Súmula',
    icon: ClipboardCheck,
    title: 'Partida registrada ao vivo.',
    text: 'Pontos, sets, escalações, tempos e ocorrências ficam registrados na súmula digital oficial durante a rodada.',
    points: ['Pontuação em tempo real', 'Eventos de arbitragem', 'Resultado oficial'],
  },
  {
    label: 'Ranking',
    icon: Trophy,
    title: 'Tabela atualizada.',
    text: 'Depois do jogo, classificação, rankings, destaques e histórico da temporada ficam prontos para consulta pública.',
    points: ['Classificação automática', 'Destaques da rodada', 'Histórico da temporada'],
  },
]

export function LandingFlowCard() {
  const [activeIndex, setActiveIndex] = useState(0)
  const active = steps[activeIndex]
  const Icon = active.icon
  const progressStyle = useMemo(() => ({ width: `${((activeIndex + 1) / steps.length) * 100}%` }), [activeIndex])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % steps.length)
    }, 4200)

    return () => window.clearInterval(timer)
  }, [])

  return (
    <div className="landing-volley-card landing-flow-card" data-active-step={active.label.toLowerCase()}>
      <div className="landing-path-preview" role="tablist" aria-label="Fluxo da plataforma">
        {steps.map((step, index) => {
          const StepIcon = step.icon
          const selected = index === activeIndex

          return (
            <button
              key={step.label}
              type="button"
              className={`path-node ${selected ? 'is-active' : ''}`}
              role="tab"
              aria-selected={selected}
              onClick={() => setActiveIndex(index)}
            >
              <StepIcon size={22} />
              <span>{step.label}</span>
            </button>
          )
        })}
      </div>

      <div className="flow-progress" aria-hidden="true">
        <span style={progressStyle} />
      </div>

      <div className="volley-card-content" key={active.label}>
        <span className="flow-step-kicker">
          <Icon size={18} />
          {active.label}
        </span>
        <strong>{active.title}</strong>
        <p>{active.text}</p>
      </div>

      <div className="volley-card-proof">
        {active.points.map((point, index) => (
          <span key={point}>
            <strong>{String(index + 1).padStart(2, '0')}</strong>
            {point}
          </span>
        ))}
      </div>
    </div>
  )
}
