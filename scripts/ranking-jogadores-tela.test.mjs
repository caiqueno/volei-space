import assert from 'node:assert/strict'
import fs from 'node:fs'

const ranking = fs.readFileSync('src/components/portal/PainelRanking.tsx', 'utf8')
const quadro = fs.readFileSync('src/components/portal/QuadroPublico.tsx', 'utf8')
const scouts = fs.readFileSync('src/components/classificacao/TabelaScouts.tsx', 'utf8')
const linha = fs.readFileSync('src/components/classificacao/LinhaScout.tsx', 'utf8')
const chave = fs.readFileSync('src/components/mata-mata/ChaveamentoMataMata.tsx', 'utf8')
const top = fs.readFileSync('src/components/classificacao/TopCinco.tsx', 'utf8')
const css = fs.readFileSync('src/app/globals.css', 'utf8')
const leitura = fs.readFileSync('src/lib/classificacao-jogadores-leitura.ts', 'utf8')
const mvp = fs.readFileSync('src/app/api/portal/rankings/route.ts', 'utf8')
const votos = fs.readFileSync('src/app/api/rankings/route.ts', 'utf8')

const corte = css.match(/@media \(max-width: 767px\) \{([\s\S]*?)\n\}/)
assert.ok(corte, 'o corte de rolagem horizontal do celular precisa continuar no CSS')
assert.match(corte[1], /html body \.overflow-x-auto \{\s*overflow-x: clip/)

assert.match(ranking, /QuadroPublico/)
assert.match(quadro, /INTERVALO_RANKING_JOGADORES_MS/)
assert.match(scouts, /data-stack/)
assert.match(scouts, /LinhaScout/)
assert.match(linha, /data-label="PTS"/)
assert.match(linha, /data-label="ATQ"/)
assert.match(linha, /data-label="ACE"/)
assert.doesNotMatch(scouts, /overflow-x-auto/)
assert.doesNotMatch(linha, /overflow-x-auto/)
assert.match(linha, /numero == null \? atleta\.nome : `\$\{atleta\.nome\} #\$\{atleta\.numero\}`/)
assert.match(chave, /role="tablist"/)
assert.match(chave, /lg:grid/)
assert.match(chave, /Resumo da partida/)
assert.match(chave, /Trophy/)
assert.match(chave, /A definir/)
assert.match(top, /Top Atacantes/)
assert.match(top, /Top Bloqueadores/)
assert.match(top, /Top Sacadores/)
assert.match(top, /Sem dados ainda/)

for (const fonte of [leitura, mvp, votos]) {
  const listas = fonte.match(/'[^'\n]*'/g) ?? []
  for (const lista of listas) {
    assert.doesNotMatch(lista, /createdAt|updatedAt|criadoEm|atualizadoEm/, 'a consulta do ranking só pede colunas que existem')
  }
}
assert.match(leitura, /tipo,jogadorId,descricao,partida:Partida!inner\(ligaId,categoriaCampeonatoId\)/)

console.log('ranking tela ok')
