import fs from 'node:fs'

if (process.env.NODE_ENV === 'production') {
  throw new Error('A recriação da simulação não roda em produção.')
}

const arquivo = fs.readFileSync('.env.local', 'utf8')
for (const linha of arquivo.split(/\r?\n/)) {
  const separado = linha.match(/^([A-Z0-9_]+)=(.*)$/)
  if (!separado || process.env[separado[1]]) continue
  process.env[separado[1]] = separado[2].trim().replace(/^['"]|['"]$/g, '')
}

import('../src/lib/simulacao-dados')
  .then(({ recriarSimulacao }) => recriarSimulacao())
  .then((resultado) => {
    console.log('simulacao criada', resultado.andamento)
  })
  .catch((erro) => {
    console.error(erro instanceof Error ? erro.message : erro)
    process.exit(1)
  })
