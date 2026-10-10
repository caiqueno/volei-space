import assert from 'node:assert/strict'
import fs from 'node:fs'

const tela = fs.readFileSync('src/components/portal/PainelRanking.tsx', 'utf8')
const css = fs.readFileSync('src/app/globals.css', 'utf8')
const leitura = fs.readFileSync('src/lib/classificacao-jogadores-leitura.ts', 'utf8')
const mvp = fs.readFileSync('src/app/api/portal/rankings/route.ts', 'utf8')
const votos = fs.readFileSync('src/app/api/rankings/route.ts', 'utf8')

const corte = css.match(/@media \(max-width: 767px\) \{([\s\S]*?)\n\}/)
assert.ok(corte, 'o corte de rolagem horizontal do celular precisa continuar no CSS')
assert.match(corte[1], /html body \.overflow-x-auto \{\s*overflow-x: clip/)

assert.match(tela, /data-stack/, 'no celular a tabela empilha cada fundamento')
assert.match(tela, /data-label="Total"/)
assert.match(tela, /data-label=\{item\.rotulo\}/)
assert.match(tela, /data-label="Ataque"|data-label=\{item\.rotulo\}/)
assert.doesNotMatch(tela, /min-w-\[40rem\]/, 'largura mínima empurra ataque, bloqueio, saque e total para fora da tela')
assert.doesNotMatch(tela, /className="[^"]*overflow-x-auto/, 'essa classe é cortada no celular e esconde os pontos')
assert.match(tela, /linha\.numero == null \? linha\.nome : `#\$\{linha\.numero\} \$\{linha\.nome\}`/)

for (const fonte of [leitura, mvp, votos]) {
  const listas = fonte.match(/'[^'\n]*'/g) ?? []
  for (const lista of listas) {
    assert.doesNotMatch(lista, /createdAt|updatedAt|criadoEm|atualizadoEm/, 'a consulta do ranking só pede colunas que existem')
  }
}
assert.match(leitura, /tipo,jogadorId,descricao,partida:Partida!inner\(ligaId,categoriaCampeonatoId\)/)

console.log('ranking tela ok')
