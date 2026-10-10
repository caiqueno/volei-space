'use client'

import { useState, type DragEvent } from 'react'
import { NomeEquipe } from '@/components/equipes/NomeEquipe'
import { normalizarNomeEquipe } from '@/lib/nome-equipe'

export type LadoQuadra = 'teamA' | 'teamB'

export type AtletaQuadra = {
  number: string
  name: string
  position?: string | null
  isLibero?: boolean
}

type Zona = {
  posicao: 'P1' | 'P2' | 'P3' | 'P4' | 'P5' | 'P6'
  indice: number
  linha: 1 | 2 | 3
  coluna: 1 | 2
}

// Índices da escalação já usada na súmula: 0 P4, 1 P3, 2 P2, 3 P5, 4 P6, 5 P1.
// Vista de cima, a equipe da esquerda olha para a rede à direita.
const ZONAS_ESQUERDA: Zona[] = [
  { posicao: 'P5', indice: 3, linha: 1, coluna: 1 },
  { posicao: 'P4', indice: 0, linha: 1, coluna: 2 },
  { posicao: 'P6', indice: 4, linha: 2, coluna: 1 },
  { posicao: 'P3', indice: 1, linha: 2, coluna: 2 },
  { posicao: 'P1', indice: 5, linha: 3, coluna: 1 },
  { posicao: 'P2', indice: 2, linha: 3, coluna: 2 },
]

// A equipe da direita olha para a rede à esquerda, então a frente fica junto da rede.
const ZONAS_DIREITA: Zona[] = [
  { posicao: 'P2', indice: 2, linha: 1, coluna: 1 },
  { posicao: 'P1', indice: 5, linha: 1, coluna: 2 },
  { posicao: 'P3', indice: 1, linha: 2, coluna: 1 },
  { posicao: 'P6', indice: 4, linha: 2, coluna: 2 },
  { posicao: 'P4', indice: 0, linha: 3, coluna: 1 },
  { posicao: 'P5', indice: 3, linha: 3, coluna: 2 },
]

export type LadoDaQuadra = {
  id: LadoQuadra
  nome: string
  atletas: AtletaQuadra[]
  escalacao: string[]
  sacando?: boolean
  indiceSaque?: number
  libero?: string
  editavel?: boolean
}

type Props = {
  esquerda: LadoDaQuadra
  direita: LadoDaQuadra
  modo: 'escalacao' | 'jogo'
  numeroExibido?: (teamId: LadoQuadra, numero: string) => string
  destaque?: { teamId: LadoQuadra; numero: string } | null
  onAtivar?: (teamId: LadoQuadra, indice: number) => void
  onSoltar?: (teamId: LadoQuadra, indice: number, numero: string) => void
  onAtaque?: (teamId: LadoQuadra, numero: string) => void
  onBloqueio?: (teamId: LadoQuadra, numero: string) => void
  onAce?: (teamId: LadoQuadra, numero: string) => void
  onSubstituicao?: (teamId: LadoQuadra, indice: number) => void
}

export function QuadraVolei({ esquerda, direita, modo, numeroExibido, destaque, onAtivar, onSoltar, onAtaque, onBloqueio, onAce, onSubstituicao }: Props) {
  return (
    <div className="volley-board">
      <div className="volley-names">
        <strong><NomeEquipe nome={esquerda.nome} />{esquerda.sacando ? ' · Sacando' : ''}</strong>
        <span>Rede</span>
        <strong>{direita.sacando ? 'Sacando · ' : ''}<NomeEquipe nome={direita.nome} /></strong>
      </div>
      <div className="volley-court" role="group" aria-label={`Quadra de ${normalizarNomeEquipe(esquerda.nome)} contra ${normalizarNomeEquipe(direita.nome)}`}>
        <img src="/images/quadra-padrao.png" alt="" />
        <div className="volley-play">
          <Metade lado="esquerda" dados={esquerda} zonas={ZONAS_ESQUERDA} modo={modo} numeroExibido={numeroExibido} destaque={destaque} onAtivar={onAtivar} onSoltar={onSoltar} onAtaque={onAtaque} onBloqueio={onBloqueio} onAce={onAce} onSubstituicao={onSubstituicao} />
          <Metade lado="direita" dados={direita} zonas={ZONAS_DIREITA} modo={modo} numeroExibido={numeroExibido} destaque={destaque} onAtivar={onAtivar} onSoltar={onSoltar} onAtaque={onAtaque} onBloqueio={onBloqueio} onAce={onAce} onSubstituicao={onSubstituicao} />
        </div>
      </div>
    </div>
  )
}

function Metade({
  lado,
  dados,
  zonas,
  modo,
  numeroExibido,
  destaque,
  onAtivar,
  onSoltar,
  onAtaque,
  onBloqueio,
  onAce,
  onSubstituicao,
}: {
  lado: 'esquerda' | 'direita'
  dados: LadoDaQuadra
  zonas: Zona[]
  modo: 'escalacao' | 'jogo'
  numeroExibido?: (teamId: LadoQuadra, numero: string) => string
  destaque?: { teamId: LadoQuadra; numero: string } | null
  onAtivar?: (teamId: LadoQuadra, indice: number) => void
  onSoltar?: (teamId: LadoQuadra, indice: number, numero: string) => void
  onAtaque?: (teamId: LadoQuadra, numero: string) => void
  onBloqueio?: (teamId: LadoQuadra, numero: string) => void
  onAce?: (teamId: LadoQuadra, numero: string) => void
  onSubstituicao?: (teamId: LadoQuadra, indice: number) => void
}) {
  const vazia = dados.escalacao.filter(Boolean).length === 0
  const [pulso, setPulso] = useState<string | null>(null)
  function dispararPulso(id: string) {
    setPulso(null)
    queueMicrotask(() => setPulso(id))
  }
  function limparPulso(event: { target: EventTarget | null; currentTarget: EventTarget | null; animationName: string }) {
    if (event.target !== event.currentTarget) return
    if (!event.animationName.startsWith('sumula-micro')) return
    setPulso(null)
  }
  return (
    <div className={`volley-half is-${lado} is-${dados.id} ${dados.sacando ? 'is-serving' : ''}`} aria-label={normalizarNomeEquipe(dados.nome)}>
      {vazia && <p className="volley-empty">{dados.editavel ? 'Escalação não informada. Toque em uma posição.' : 'Escalação não informada'}</p>}
      {zonas.map((zona) => {
        const numero = dados.escalacao[zona.indice] || ''
        const atleta = dados.atletas.find((item) => item.number === numero)
        const camisa = numero ? (numeroExibido?.(dados.id, numero) ?? numero) : ''
        const frente = zona.posicao === 'P2' || zona.posicao === 'P3' || zona.posicao === 'P4'
        const sacandoAqui = Boolean(dados.sacando && numero && zona.indice === dados.indiceSaque)
        const funcao = rotuloFuncao(atleta, numero, dados.libero)
        const brilhou = destaque?.teamId === dados.id && destaque.numero === numero
        return (
          <div
            key={zona.posicao}
            className={`volley-zone ${frente ? 'is-front' : 'is-back'} ${zona.coluna === 1 ? 'is-col-1' : 'is-col-2'} is-row-${zona.linha}`}
            style={{ gridRow: zona.linha, gridColumn: zona.coluna }}
            onDragOver={(event) => {
              if (!dados.editavel) return
              event.preventDefault()
            }}
            onDrop={(event) => soltar(event, dados, zona.indice, onSoltar)}
          >
            <div className="volley-slot">
            <span className="volley-pos">{zona.posicao}</span>
            {modo === 'escalacao' ? (
              <button
                type="button"
                className={`volley-marker ${numero ? 'is-filled' : ''} ${sacandoAqui ? 'is-server' : ''} ${funcao === 'Líbero' ? 'is-libero' : ''} ${pulso === `${zona.posicao}:tap` ? 'sumula-micro-tap' : ''}`}
                onAnimationEnd={limparPulso}
                draggable={Boolean(dados.editavel && numero)}
                onDragStart={(event) => {
                  if (!numero) return
                  event.dataTransfer.setData('text/plain', numero)
                  event.dataTransfer.effectAllowed = 'move'
                }}
                onClick={() => {
                  onAtivar?.(dados.id, zona.indice)
                  dispararPulso(`${zona.posicao}:tap`)
                }}
                aria-label={numero ? `${zona.posicao}, ${camisa}, ${nomeCurto(atleta?.name || 'Atleta')}` : `${zona.posicao} vazia de ${normalizarNomeEquipe(dados.nome)}`}
              >
                <Marcador numero={camisa} nome={atleta?.name} funcao={funcao} sacando={sacandoAqui} />
              </button>
            ) : (
              <div className={`volley-marker is-live ${numero ? 'is-filled' : ''} ${sacandoAqui ? 'is-server' : ''} ${funcao === 'Líbero' ? 'is-libero' : ''} ${brilhou ? 'is-scored' : ''} ${pulso === `${zona.posicao}:ace` ? 'sumula-micro-ace' : ''} ${pulso === `${zona.posicao}:block` ? 'sumula-micro-block' : ''}`} onAnimationEnd={limparPulso}>
                <Marcador numero={camisa} nome={atleta?.name} funcao={funcao} sacando={false} />
                {numero && (
                  <span className="volley-actions">
                    {acoesDaPosicao(zona.posicao, sacandoAqui).map((acao) => (
                      <button
                        key={acao}
                        type="button"
                        onClick={() => {
                          executarAcao(acao, dados.id, numero, zona.indice, { onAtaque, onBloqueio, onAce, onSubstituicao })
                          if (acao === 'A') dispararPulso(`${zona.posicao}:ace`)
                          else if (acao === 'B') dispararPulso(`${zona.posicao}:block`)
                        }}
                        aria-label={rotuloAcao(acao, camisa)}
                        title={rotuloAcao(acao, camisa)}
                      >
                        {acao}
                      </button>
                    ))}
                  </span>
                )}
                {brilhou && <b>+1</b>}
              </div>
            )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Marcador({ numero, nome, funcao, sacando }: { numero: string; nome?: string; funcao: string | null; sacando: boolean }) {
  if (!numero) return <small>Vazio</small>
  return (
    <>
      <strong>{numero}</strong>
      <em>{nomeCurto(nome || 'Atleta')}</em>
      {(funcao || sacando) && <i>{[sacando ? 'Saque' : '', funcao || ''].filter(Boolean).join(' · ')}</i>}
    </>
  )
}

function soltar(event: DragEvent<HTMLDivElement>, dados: LadoDaQuadra, indice: number, onSoltar?: (teamId: LadoQuadra, indice: number, numero: string) => void) {
  if (!dados.editavel) return
  event.preventDefault()
  const numero = event.dataTransfer.getData('text/plain').trim()
  if (!numero) return
  onSoltar?.(dados.id, indice, numero)
}

function nomeCurto(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (partes.length <= 1) return (partes[0] || 'Atleta').slice(0, 12)
  return `${partes[0]} ${partes[partes.length - 1].slice(0, 1)}.`
}

type AcaoQuadra = 'A' | 'P' | 'B' | 'S'

function acoesDaPosicao(posicao: Zona['posicao'], sacando: boolean): AcaoQuadra[] {
  if (sacando) return ['A', 'P', 'S']
  if (posicao === 'P2' || posicao === 'P3' || posicao === 'P4') return ['P', 'B', 'S']
  return ['P', 'S']
}

function rotuloAcao(acao: AcaoQuadra, camisa: string) {
  if (acao === 'A') return `ACE de ${camisa}`
  if (acao === 'P') return `Ponto de ataque de ${camisa}`
  if (acao === 'B') return `Bloqueio de ${camisa}`
  return `Substituição de ${camisa}`
}

function executarAcao(
  acao: AcaoQuadra,
  teamId: LadoQuadra,
  numero: string,
  indice: number,
  acoes: {
    onAtaque?: (teamId: LadoQuadra, numero: string) => void
    onBloqueio?: (teamId: LadoQuadra, numero: string) => void
    onAce?: (teamId: LadoQuadra, numero: string) => void
    onSubstituicao?: (teamId: LadoQuadra, indice: number) => void
  },
) {
  if (acao === 'A') acoes.onAce?.(teamId, numero)
  else if (acao === 'P') acoes.onAtaque?.(teamId, numero)
  else if (acao === 'B') acoes.onBloqueio?.(teamId, numero)
  else acoes.onSubstituicao?.(teamId, indice)
}

function rotuloFuncao(atleta: AtletaQuadra | undefined, numero: string, libero?: string) {
  if ((numero && libero && numero === libero) || atleta?.isLibero) return 'Líbero'
  if (/levant/i.test(String(atleta?.position || ''))) return 'Levantador'
  return null
}
