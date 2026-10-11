import type { UIEvent } from 'react'
import { TeamIdentity } from '@/components/equipes/TeamIdentity'
import estilos from '@/components/classificacao/scouts.module.css'
import { pontosDoAtleta, type AtletaQuadro } from '@/lib/quadro-publico'

export const COLUNAS_RANKING = ['#', 'Atleta', 'PTS', 'ATQ', 'BLQ', 'ACE'] as const

export function nomeDoAtleta(atleta: Pick<AtletaQuadro, 'nome' | 'numero'>) {
  return atleta.numero == null ? atleta.nome : `${atleta.nome} #${atleta.numero}`
}

export function LinhaScout({ atleta, indice, onScroll }: { atleta: AtletaQuadro; indice: number; onScroll?: (evento: UIEvent<HTMLElement>) => void }) {
  return (
    <div className={estilos.linha}>
      <div className={estilos.identidade}>
        <span className={estilos.posicao}>{indice + 1}</span>
        <TeamIdentity nome={atleta.equipe} cor={atleta.corHex} logoUrl={atleta.logoUrl} compact showName={false} />
        <span className={estilos.pessoa}>
          <strong className={estilos.nome}>{atleta.nome}</strong>
          {atleta.numero != null && <span className={estilos.camisa}>#{atleta.numero}</span>}
        </span>
      </div>
      <div className={estilos.numeros} data-rolagem-numeros onScroll={onScroll}>
        <span className={estilos.pts}>{pontosDoAtleta(atleta)}</span>
        <span>{atleta.ataque}</span>
        <span>{atleta.bloqueio}</span>
        <span>{atleta.saque}</span>
      </div>
    </div>
  )
}
