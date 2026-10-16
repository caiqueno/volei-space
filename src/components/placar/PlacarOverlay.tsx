'use client'

import { useEffect, useRef, useState } from 'react'
import { useBancoAoVivo } from '@/lib/use-banco-ao-vivo'
import { TeamIdentity } from '@/components/equipes/TeamIdentity'
import './placar.css'

type Equipe = { id: number; nome: string; vaga?: boolean; corHex?: string | null; logoUrl?: string | null } | null

// Somente campos públicos: nomes de equipe, logo, cor, sets e pontos. Sem atletas.
type Partida = {
  id: number
  status: string
  setsPorA?: number | null
  setsPorB?: number | null
  pontosPorA?: number | null
  pontosPorB?: number | null
  equipeA: Equipe
  equipeB: Equipe
  liga?: { nome?: string | null } | null
  sets?: Array<{ id: number; numero: number; pontosA: number; pontosB: number }>
}

function rotuloStatus(status: string) {
  const s = String(status ?? '').toUpperCase()
  if (s === 'EM_ANDAMENTO') return { texto: 'Ao vivo', vivo: true }
  if (s === 'ENCERRADA' || s === 'FINALIZADA' || s === 'WO') return { texto: 'Encerrada', vivo: false }
  return { texto: 'Em breve', vivo: false }
}

export default function PlacarOverlay({ partidaId, transparente = false }: { partidaId: string; transparente?: boolean }) {
  const [partida, setPartida] = useState<Partida | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [instavel, setInstavel] = useState(false)
  const recarregar = useRef<() => void>(() => {})
  const numero = Number(partidaId)
  const valido = Number.isInteger(numero) && numero > 0

  useEffect(() => {
    if (!valido) { setCarregando(false); return }
    let vivo = true
    async function carregar() {
      try {
        const res = await fetch(`/api/partidas/${partidaId}/ao-vivo?t=${Date.now()}`, { cache: 'no-store' })
        const json = await res.json()
        if (!res.ok) throw new Error('falha')
        if (vivo) { setPartida(json.data); setInstavel(false); setCarregando(false) }
      } catch {
        // Mantém o último placar na tela; só avisa de forma discreta.
        if (vivo) { setInstavel(true); setCarregando(false) }
      }
    }
    recarregar.current = () => { void carregar() }
    void carregar()
    return () => { vivo = false }
  }, [partidaId, valido])

  useBancoAoVivo(
    valido ? `placar-${numero}` : '',
    valido ? [{ tabela: 'Partida', filtro: `id=eq.${numero}` }, { tabela: 'SetPartida', filtro: `partidaId=eq.${numero}` }] : [],
    () => recarregar.current(),
  )

  const classe = `placar-root${transparente ? ' is-transparente' : ''}`
  const fundo = transparente ? 'transparente' : 'solido'

  if (!partida || !partida.equipeA || !partida.equipeB) {
    return (
      <main className={classe} data-fundo={fundo}>
        <p className="placar-estado" role="status">
          {carregando ? 'Carregando placar' : valido ? 'Placar indisponível no momento' : 'Partida não encontrada'}
        </p>
      </main>
    )
  }

  const { texto, vivo } = rotuloStatus(partida.status)
  const sets = [...(partida.sets ?? [])].sort((a, b) => a.numero - b.numero)
  const atual = sets.length > 0 ? sets[sets.length - 1] : null
  const pontosA = atual?.pontosA ?? partida.pontosPorA ?? 0
  const pontosB = atual?.pontosB ?? partida.pontosPorB ?? 0
  const setsA = partida.setsPorA ?? 0
  const setsB = partida.setsPorB ?? 0
  const nomeA = partida.equipeA.nome || (partida.equipeA.vaga ? 'A definir' : 'Equipe A')
  const nomeB = partida.equipeB.nome || (partida.equipeB.vaga ? 'A definir' : 'Equipe B')

  return (
    <main className={classe} data-fundo={fundo} aria-label={`Placar: ${nomeA} contra ${nomeB}`}>
      <section className="placar-card">
        <header className="placar-topo">
          <span className={`placar-status${vivo ? ' is-vivo' : ''}`}>{vivo && <i aria-hidden="true" />}{texto}</span>
          {partida.liga?.nome && <span className="placar-liga">{partida.liga.nome}</span>}
          {atual && <span className="placar-set">Set {atual.numero}</span>}
        </header>
        <div className="placar-corpo" role="group" aria-live="polite">
          <div className="placar-lado">
            <div className="placar-logo"><TeamIdentity nome={nomeA} cor={partida.equipeA.corHex} logoUrl={partida.equipeA.logoUrl} compact showName={false} /></div>
            <strong className="placar-nome">{nomeA}</strong>
            <span className="placar-sets" aria-label={`Sets de ${nomeA}`}>{setsA}</span>
          </div>
          <div className="placar-pontos">
            <b aria-label={`Pontos de ${nomeA}`}>{pontosA}</b>
            <span aria-hidden="true">x</span>
            <b aria-label={`Pontos de ${nomeB}`}>{pontosB}</b>
          </div>
          <div className="placar-lado">
            <div className="placar-logo"><TeamIdentity nome={nomeB} cor={partida.equipeB.corHex} logoUrl={partida.equipeB.logoUrl} compact showName={false} /></div>
            <strong className="placar-nome">{nomeB}</strong>
            <span className="placar-sets" aria-label={`Sets de ${nomeB}`}>{setsB}</span>
          </div>
        </div>
        {sets.length > 1 && (
          <ol className="placar-parciais" aria-label="Parciais dos sets">
            {sets.slice(0, -1).map((s) => (
              <li key={s.id}><span>Set {s.numero}</span> <b>{s.pontosA} x {s.pontosB}</b></li>
            ))}
          </ol>
        )}
        {instavel && <p className="placar-aviso" role="status">Reconectando</p>}
      </section>
    </main>
  )
}
