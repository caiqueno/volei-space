// Leitor mínimo de PDF para os testes: valida cabeçalho, xref e trailer e extrai o texto de cada página.
import assert from 'node:assert/strict'

export type PdfLido = { texto: string; paginas: string[]; objetos: number }

function decodificarLiteral(corpo: string): string {
  let saida = ''
  for (let i = 0; i < corpo.length; i++) {
    const c = corpo[i]
    if (c !== '\\') {
      saida += c
      continue
    }
    const prox = corpo[i + 1]
    if (/[0-7]/.test(prox)) {
      const octal = corpo.slice(i + 1, i + 4).match(/^[0-7]{1,3}/)![0]
      saida += String.fromCharCode(parseInt(octal, 8)) // Latin-1 == Unicode nessa faixa
      i += octal.length
    } else {
      saida += prox
      i += 1
    }
  }
  return saida
}

export function lerPdf(bytes: Buffer): PdfLido {
  const arquivo = bytes.toString('latin1')
  assert.ok(arquivo.startsWith('%PDF-1.4'), 'começa com %PDF-1.4')
  assert.ok(arquivo.trimEnd().endsWith('%%EOF'), 'termina com %%EOF')

  const inicio = Number(arquivo.match(/startxref\n(\d+)\n%%EOF/)?.[1])
  assert.ok(Number.isInteger(inicio), 'startxref presente')
  assert.ok(arquivo.slice(inicio).startsWith('xref\n'), 'startxref aponta para a tabela xref')
  const [, cabecalho, resto] = arquivo.slice(inicio).match(/^xref\n(\d+ \d+)\n([\s\S]*?)trailer/)!
  const [primeiro, total] = cabecalho.split(' ').map(Number)
  assert.equal(primeiro, 0)
  const entradas = resto.split('\n').filter(Boolean)
  assert.equal(entradas.length, total, 'uma entrada por objeto')
  assert.ok(entradas.every((e) => e.length === 20 || e.length === 19), 'entradas do xref de 20 bytes (com espaço final)')
  assert.match(entradas[0], /^0000000000 65535 f/)
  for (let id = 1; id < total; id++) {
    const offset = Number(entradas[id].slice(0, 10))
    assert.ok(arquivo.slice(offset).startsWith(`${id} 0 obj\n`), `xref do objeto ${id} aponta para o offset real ${offset}`)
    assert.ok(entradas[id].includes(' n'), 'objeto em uso')
  }
  assert.match(arquivo.slice(inicio), new RegExp(`trailer\\n<< /Size ${total} /Root 1 0 R`))

  // Páginas: cada fluxo de conteúdo; Length confere com o fluxo.
  const paginas: string[] = []
  for (const m of arquivo.matchAll(/<< \/Length (\d+) >>\nstream\n([\s\S]*?)\nendstream/g)) {
    assert.equal(Number(m[1]), m[2].length, 'Length do fluxo confere')
    const textos = [...m[2].matchAll(/\(((?:\\.|[^\\)])*)\) Tj/g)].map((t) => decodificarLiteral(t[1]))
    paginas.push(textos.join('\n'))
  }
  const quantidade = Number(arquivo.match(/\/Type \/Pages \/Count (\d+)/)?.[1])
  assert.equal(paginas.length, quantidade, 'Count da árvore = páginas com conteúdo')
  return { texto: paginas.join('\n'), paginas, objetos: total - 1 }
}
