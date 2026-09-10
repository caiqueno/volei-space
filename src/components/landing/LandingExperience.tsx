'use client'

import { useEffect, useMemo, useState } from 'react'

const plays = [
  { action: 'Ponto Ultra Volleyball', scoreA: 15, scoreB: 14, note: '15 x 14 - Ponto registrado para Ultra Volleyball no 2º set.' },
  { action: 'Ace Ultra Volleyball', scoreA: 16, scoreB: 14, note: '16 x 14 - Ace confirmado para Ultra Volleyball no 2º set.' },
  { action: 'Ponto Ultra Volleyball', scoreA: 17, scoreB: 14, note: '17 x 14 - Ponto registrado para Ultra Volleyball no 2º set.' },
  { action: 'Ponto Ultra Volleyball', scoreA: 18, scoreB: 14, note: '18 x 14 - Ponto registrado para Ultra Volleyball no 2º set.' },
]

const teams = [
  { name: 'Ultra Volleyball', pts: 15, wins: 6, delta: '+3 pts', rising: true },
  { name: 'Kimura Vôlei', pts: 17, wins: 5 },
  { name: 'Arena Sul', pts: 12, wins: 4 },
]

export function LandingExperience() {
  const [index, setIndex] = useState(0)
  const play = plays[index]

  useEffect(() => {
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % plays.length)
    }, 2800)

    return () => window.clearInterval(id)
  }, [])

  const events = useMemo(() => {
    const previousEvents = plays.slice(0, index + 1).reverse()
    return previousEvents.length < 3 ? [...previousEvents, ...plays.slice(0, 3 - previousEvents.length)] : previousEvents.slice(0, 3)
  }, [index])

  return (
    <div className="match-simulator landing-animate">
      <div className="sim-main">
        <div className="analog-scoreboard" aria-label="Placar da partida">
          <div className="score-sets" aria-label="Resultado dos sets">
            <span>
              <small>Sets</small>
              <b>1</b>
              <i>x</i>
              <b>0</b>
            </span>
          </div>
          <span className="score-meta score-meta-left">
            <b>Poss</b>
            <i />
            <b>Bonus</b>
          </span>
          <span className="score-meta score-meta-right">
            <b>Poss</b>
            <i />
            <b>Bonus</b>
          </span>
          <div className="analog-team">
            <span>Home</span>
            <strong>{String(play.scoreA).padStart(2, '0')}</strong>
          </div>
          <div className="analog-center">
            <small>Set</small>
            <b>2</b>
          </div>
          <div className="analog-team">
            <span>Guest</span>
            <strong>{String(play.scoreB).padStart(2, '0')}</strong>
          </div>
        </div>

        <div className="sim-court" aria-label="Simulação visual de uma jogada de vôlei">
          <span className="sim-net" />
          <span className="sim-zone left" />
          <span className="sim-zone right" />
          <span className="sim-player sim-player-a" />
          <span className="sim-player sim-player-b" />
          <span className="sim-player sim-player-c" />
          <span className="sim-ball" />
          <span className="sim-path" />
        </div>

        <div className="sim-play">
          <span>Jogada atual</span>
          <strong>{play.action}</strong>
          <p>{play.note}</p>
        </div>
      </div>

      <aside className="sim-side">
        <section>
          <h3>Súmula digital</h3>
          <div className="sim-feed">
            {events.map((event, eventIndex) => (
              <article key={`${event.action}-${eventIndex}`}>
                <span>{event.scoreA}:{event.scoreB}</span>
                <p>{event.note}</p>
              </article>
            ))}
          </div>
        </section>

        <section>
          <h3>Classificação</h3>
          <div className="sim-ranking">
            <div className="sim-ranking-table" role="table" aria-label="Classificação da liga">
              <div className="sim-ranking-head" role="row">
                <span>#</span>
                <span>Equipe</span>
                <span>Pts</span>
                <span>V</span>
              </div>
              {teams.map((team, teamIndex) => {
                const boosted = teamIndex === 0 && index === plays.length - 1
                const teamPoints = team.pts + (boosted ? 3 : 0)

                return (
                  <article key={team.name} className={`sim-ranking-row ${team.rising ? 'is-rising' : ''}`} role="row">
                    <span className="rank-pos">{teamIndex + 1}</span>
                    <div className="rank-team">
                      <strong>{team.name}</strong>
                      {team.rising && <span className="rank-up">&uarr;</span>}
                    </div>
                    {team.delta && <b className={`rank-delta ${boosted ? 'is-active' : ''}`}>{team.delta}</b>}
                    <em>{teamPoints}</em>
                    <span>{team.wins}</span>
                  </article>
                )
              })}
            </div>
          </div>
        </section>
      </aside>
    </div>
  )
}
