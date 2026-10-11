import { NomeEquipe } from '@/components/equipes/NomeEquipe'
import { TeamIdentity } from '@/components/equipes/TeamIdentity'
import { classificaNaVaga, saldoComSinal, type LinhaGrupo } from '@/lib/quadro-publico'
import type { LinhaTabelaCartaz } from '@/lib/stories-cartaz'
import estilos from '@/components/classificacao/tabela-grupo.module.css'

export const COLUNAS_GRUPO = ['#', 'Equipe', 'P', 'J', 'V', 'D', 'SP', 'SC', 'DS', 'DP', 'PE'] as const

export const NUMEROS_GRUPO = COLUNAS_GRUPO.slice(2)

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

export function valoresDaLinha(linha: Partial<LinhaTabela> & { pontos?: number }) {
  const numeros = numerosDaLinha(linha)
  return [
    numeros.pontos,
    numeros.jogos,
    numeros.vitorias,
    numeros.derrotas,
    numeros.setsPro,
    numeros.setsContra,
    saldoComSinal(numeros.saldoSets),
    saldoComSinal(numeros.saldoPontos),
    numeros.punicoes > 0 ? numeros.punicoes : '—',
  ]
}

export function LinhaGrupoTabela({ linha, indice, vagas }: { linha: LinhaGrupo; indice: number; vagas: number }) {
  const classifica = classificaNaVaga(indice, vagas)
  const valores = valoresDaLinha(linha)
  return (
    <tr>
      <th scope="row" className={`${estilos.fixa} ${classifica ? estilos.vaga : ''}`}>
        <span className={estilos.equipe}>
          <span className={`${estilos.circulo} ${classifica ? estilos.circuloVaga : ''}`}>{indice + 1}</span>
          <span className={estilos.marca}>
            <TeamIdentity nome={linha.equipe} cor={linha.corHex} logoUrl={linha.logoUrl} compact showName={false} />
          </span>
          <span className={estilos.nome}><NomeEquipe nome={linha.equipe} /></span>
          {classifica && <span className="sr-only">classificado</span>}
        </span>
      </th>
      {valores.map((valor, coluna) => (
        <td key={NUMEROS_GRUPO[coluna]} className={`${estilos.numero} ${classifica ? estilos.vaga : ''}`}>
          <span className={coluna === 0 ? 'font-bold' : undefined}>{valor}</span>
        </td>
      ))}
    </tr>
  )
}

function numero(valor: number | undefined) {
  return Number.isFinite(valor) ? Number(valor) : 0
}
