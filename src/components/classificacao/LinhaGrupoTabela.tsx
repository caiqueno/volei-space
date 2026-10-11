import { NomeEquipe } from '@/components/equipes/NomeEquipe'
import { TeamIdentity } from '@/components/equipes/TeamIdentity'
import { saldoComSinal, type LinhaGrupo } from '@/lib/quadro-publico'
import type { LinhaTabelaCartaz } from '@/lib/stories-cartaz'

export const COLUNAS_GRUPO = ['#', 'Equipe', 'P', 'J', 'V', 'D', 'SP', 'SC', 'DS', 'DP', 'PE'] as const

export type LinhaTabela = LinhaTabelaCartaz | LinhaGrupo

export function numerosDaLinha(linha: Partial<LinhaTabela> & { pontos?: number }) {
  const setsPro = numero(linha.setsPro)
  const setsContra = numero(linha.setsContra)
  const pontosPro = numero(linha.pontosPro)
  const pontosContra = numero(linha.pontosContra)
  return {
    pontos: numero(linha.pontos),
    jogos: numero(linha.jogos),
    vitorias: numero(linha.vitorias),
    derrotas: numero(linha.derrotas),
    setsPro,
    setsContra,
    saldoSets: linha.saldoSets ?? setsPro - setsContra,
    saldoPontos: linha.saldoPontos ?? pontosPro - pontosContra,
    punicoes: numero(linha.punicoes),
  }
}

export function LinhaGrupoTabela({ linha, indice, classifica }: { linha: LinhaGrupo; indice: number; classifica: boolean }) {
  const numeros = numerosDaLinha(linha)
  return (
    <tr className="border-t border-vs-border">
      <td data-label="#" className={`border-l-4 px-2 py-2 font-display font-bold tabular-nums ${classifica ? 'border-vs-gold text-vs-gold' : 'border-transparent'}`}>{indice + 1}</td>
      <td data-label="Equipe" className="px-2 py-2 font-bold">
        <span className="inline-flex min-w-0 items-center gap-2">
          <TeamIdentity nome={linha.equipe} cor={linha.corHex} logoUrl={linha.logoUrl} compact showName={false} />
          <NomeEquipe nome={linha.equipe} />
        </span>
      </td>
      <td data-label="P" className="px-2 py-2 text-right font-bold tabular-nums">{numeros.pontos}</td>
      <td data-label="J" className="px-2 py-2 text-right tabular-nums">{numeros.jogos}</td>
      <td data-label="V" className="px-2 py-2 text-right tabular-nums">{numeros.vitorias}</td>
      <td data-label="D" className="px-2 py-2 text-right tabular-nums">{numeros.derrotas}</td>
      <td data-label="SP" className="px-2 py-2 text-right tabular-nums">{numeros.setsPro}</td>
      <td data-label="SC" className="px-2 py-2 text-right tabular-nums">{numeros.setsContra}</td>
      <td data-label="DS" className="px-2 py-2 text-right tabular-nums">{saldoComSinal(numeros.saldoSets)}</td>
      <td data-label="DP" className="px-2 py-2 text-right tabular-nums">{saldoComSinal(numeros.saldoPontos)}</td>
      <td data-label="PE" className="px-2 py-2 text-right tabular-nums">{numeros.punicoes > 0 ? numeros.punicoes : '—'}</td>
    </tr>
  )
}

function numero(valor: number | undefined) {
  return Number.isFinite(valor) ? Number(valor) : 0
}
