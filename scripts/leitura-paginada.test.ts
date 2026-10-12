import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { lerTodasAsLinhas, TAMANHO_LOTE } from '../src/lib/leitura-paginada'

type Linha = { id: number }

function consulta(linhas: Linha[], falhaNoLote?: number) {
  const chamadas: Array<{ coluna: string; inicio: number; fim: number }> = []
  let lote = 0
  const montar = () => ({
    order(coluna: string) {
      return {
        async range(inicio: number, fim: number) {
          lote += 1
          chamadas.push({ coluna, inicio, fim })
          if (falhaNoLote === lote) return { data: null, error: { message: 'falha de leitura' } }
          return { data: linhas.slice(inicio, fim + 1), error: null }
        },
      }
    },
  })
  return { montar, chamadas }
}

async function main() {
  const total = 1169
  const linhas = Array.from({ length: total }, (_, indice) => ({ id: indice + 1 }))
  const primeira = consulta(linhas)
  const lidas = await lerTodasAsLinhas(primeira.montar)
  assert.equal(lidas.length, total)
  assert.deepEqual(lidas.map((linha) => linha.id), linhas.map((linha) => linha.id))
  assert.deepEqual(primeira.chamadas, [
    { coluna: 'id', inicio: 0, fim: TAMANHO_LOTE - 1 },
    { coluna: 'id', inicio: TAMANHO_LOTE, fim: TAMANHO_LOTE * 2 - 1 },
  ])
  assert.equal(primeira.chamadas[1].fim - primeira.chamadas[1].inicio + 1, TAMANHO_LOTE)
  assert.ok(lidas.filter((_, indice) => indice >= TAMANHO_LOTE).length < TAMANHO_LOTE)

  const vazia = consulta([])
  assert.deepEqual(await lerTodasAsLinhas(vazia.montar), [])
  assert.deepEqual(vazia.chamadas, [{ coluna: 'id', inicio: 0, fim: 999 }])

  const exata = consulta(Array.from({ length: TAMANHO_LOTE }, (_, indice) => ({ id: indice + 1 })))
  const cheia = await lerTodasAsLinhas(exata.montar)
  assert.equal(cheia.length, TAMANHO_LOTE)
  assert.equal(exata.chamadas.length, 2)
  assert.equal(exata.chamadas[1].inicio, TAMANHO_LOTE)

  const quebrada = consulta(linhas, 2)
  await assert.rejects(() => lerTodasAsLinhas(quebrada.montar), /falha de leitura/)
  assert.equal(quebrada.chamadas.length, 2)

  await assert.rejects(() => lerTodasAsLinhas(consulta([]).montar, 1001), /1 a 1000/)

  const fontes = [
    'src/lib/player-scouts.ts',
    'src/lib/classificacao-jogadores-leitura.ts',
    'src/app/api/portal/rankings/route.ts',
    'src/app/api/rankings/route.ts',
    'src/app/api/partidas/[id]/ao-vivo/route.ts',
    'src/lib/sancoes-partida.ts',
    'src/lib/massa-qa.ts',
    'src/lib/sumula-gravacao.ts',
  ]
  for (const arquivo of fontes) {
    const fonte = readFileSync(arquivo, 'utf8')
    assert.match(fonte, /lerTodasAsLinhas/, arquivo)
    assert.equal(fonte.includes('.range('), false, arquivo)
  }
  const scouts = readFileSync('src/lib/player-scouts.ts', 'utf8')
  assert.match(scouts, /from\('OcorrenciaPartida'\)/)
  assert.match(scouts, /from\('Jogador'\)/)
  assert.match(scouts, /from\('Partida'\)/)

  console.log('leitura paginada ok')
}

main()
