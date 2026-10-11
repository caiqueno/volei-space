'use client'

import { useLayoutEffect, useRef, useState, type UIEvent } from 'react'
import { LinhaScout } from '@/components/classificacao/LinhaScout'
import estilos from '@/components/classificacao/scouts.module.css'
import { ordenarScouts, type AtletaQuadro } from '@/lib/quadro-publico'

const PASSO = 10
const COLUNAS = ['PTS', 'ATQ', 'BLQ', 'ACE'] as const

export function TabelaScouts({ atletas }: { atletas: AtletaQuadro[] }) {
  const [visiveis, setVisiveis] = useState(PASSO)
  const raiz = useRef<HTMLElement>(null)
  const linhas = ordenarScouts(atletas)
  const mostradas = linhas.slice(0, visiveis)

  useLayoutEffect(() => {
    const paineis = raiz.current?.querySelectorAll<HTMLElement>('[data-rolagem-numeros]')
    const esquerda = paineis?.[0]?.scrollLeft ?? 0
    paineis?.forEach((painel) => {
      if (painel.scrollLeft !== esquerda) painel.scrollLeft = esquerda
    })
  }, [visiveis])

  function sincronizar(evento: UIEvent<HTMLElement>) {
    const origem = evento.currentTarget
    const esquerda = origem.scrollLeft
    const paineis = raiz.current?.querySelectorAll<HTMLElement>('[data-rolagem-numeros]')
    paineis?.forEach((painel) => {
      if (painel !== origem && painel.scrollLeft !== esquerda) painel.scrollLeft = esquerda
    })
  }

  return (
    <section ref={raiz} aria-labelledby="scouts-gerais" className={`${estilos.quadro} scouts-gerais`}>
      <header className={estilos.topo}>
        <h3 id="scouts-gerais" className={estilos.titulo}>Scouts gerais</h3>
        <p className={estilos.subtitulo}>Pontos, ataques, bloqueios e aces acumulados no campeonato</p>
      </header>
      {linhas.length === 0 ? (
        <p className={estilos.vazio}>Sem dados ainda</p>
      ) : (
        <>
          <div className={estilos.cabeca}>
            <span className={estilos.rotuloAtleta}>Atleta</span>
            <div className={`${estilos.numeros} ${estilos.rotulos}`} data-rolagem-numeros onScroll={sincronizar}>
              {COLUNAS.map((coluna) => <span key={coluna}>{coluna}</span>)}
            </div>
          </div>
          <ol className={estilos.lista}>
            {mostradas.map((atleta, indice) => (
              <li key={atleta.jogadorId}>
                <LinhaScout atleta={atleta} indice={indice} onScroll={sincronizar} />
              </li>
            ))}
          </ol>
          {mostradas.length < linhas.length && (
            <button type="button" className={estilos.mais} onClick={() => setVisiveis((atual) => atual + PASSO)}>
              Ver mais
            </button>
          )}
        </>
      )}
    </section>
  )
}
