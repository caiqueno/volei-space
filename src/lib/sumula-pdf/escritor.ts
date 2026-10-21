/**
 * Escritor mínimo de PDF 1.4, sem dependência. Módulo PURO.
 *
 * Recursos: páginas A4 (595x842 pt), fontes padrão Helvetica e Helvetica-Bold (WinAnsi), texto com quebra de
 * linha por largura medida, linhas, retângulos com preenchimento cinza, tabela com grade e cabeçalho repetido,
 * quebra de página automática e rodapé com número de página. O arquivo gerado é 100% ASCII (caracteres acima de
 * 0x7F saem como escapes octais na string do PDF), então os offsets do xref são o comprimento da string.
 */

export const LARGURA_A4 = 595
export const ALTURA_A4 = 842

export type Fonte = 'regular' | 'negrito'

/* --------------------------- larguras (AFM, 1/1000 em) --------------------------- */

const LARGURA_REGULAR_ASCII =
  '278 278 355 556 556 889 667 191 333 333 389 584 278 333 278 278 ' + // 32-47
  '556 556 556 556 556 556 556 556 556 556 278 278 584 584 584 556 ' + // 48-63
  '1015 667 667 722 722 667 611 778 722 278 500 667 556 833 722 778 ' + // 64-79
  '667 778 722 667 611 722 667 944 667 667 611 278 278 278 469 556 ' + // 80-95
  '333 556 556 500 556 556 278 556 556 222 222 500 222 833 556 556 ' + // 96-111
  '556 556 333 500 278 556 500 722 500 500 500 334 260 334 584' // 112-126

const LARGURA_NEGRITO_ASCII =
  '278 333 474 556 556 889 722 238 333 333 389 584 278 333 278 278 ' +
  '556 556 556 556 556 556 556 556 556 556 333 333 584 584 584 611 ' +
  '975 722 722 722 722 667 611 778 722 278 556 722 611 833 722 778 ' +
  '667 778 722 667 611 722 667 944 667 667 611 333 278 333 584 556 ' +
  '333 556 611 556 611 556 333 611 611 278 278 556 278 889 611 611 ' +
  '611 611 389 556 333 611 556 778 556 556 500 389 280 389 584'

const tabelaAscii = (s: string) => s.split(' ').map(Number)
const ASCII = { regular: tabelaAscii(LARGURA_REGULAR_ASCII), negrito: tabelaAscii(LARGURA_NEGRITO_ASCII) }

/** Código WinAnsi (cp1252) dos caracteres fora do Latin-1 imprimíveis na faixa 0x80-0x9F. */
const CP1252: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87,
  0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91,
  0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98,
  0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
}

/** Larguras de símbolos fora do alfabeto base (aproximadas das métricas AFM). */
const LARGURA_ESPECIAL: Record<number, [number, number]> = {
  0x80: [556, 556], 0x85: [1000, 1000], 0x91: [222, 278], 0x92: [222, 278], 0x93: [333, 500], 0x94: [333, 500],
  0x95: [350, 350], 0x96: [556, 556], 0x97: [1000, 1000], 0x99: [1000, 1000],
  0xa0: [278, 278], 0xa9: [737, 737], 0xaa: [370, 370], 0xba: [365, 365], 0xb7: [278, 278], 0xd7: [584, 584], 0xf7: [584, 584],
  0xc6: [1000, 1000], 0xe6: [889, 889], 0xd0: [722, 722], 0xf0: [556, 611], 0xde: [667, 667], 0xfe: [556, 611], 0xdf: [611, 611],
}

/** Letra base de um caractere acentuado do Latin-1 (À → A, ç → c), para reaproveitar a largura. */
function letraBase(codigo: number): number | null {
  const base = String.fromCharCode(codigo).normalize('NFD').charCodeAt(0)
  return base >= 0x41 && base <= 0x7a ? base : null
}

/** Bytes WinAnsi do texto; o que não existe na codificação vira '?'. Quebras e tabs viram espaço. */
export function codificarWinAnsi(texto: string): number[] {
  const saida: number[] = []
  for (const simbolo of String(texto ?? '').normalize('NFC')) {
    const cp = simbolo.codePointAt(0) ?? 63
    if (cp === 0x09 || cp === 0x0a || cp === 0x0d) saida.push(0x20)
    else if (cp >= 0x20 && cp <= 0x7e) saida.push(cp)
    else if (cp >= 0xa0 && cp <= 0xff) saida.push(cp)
    else if (CP1252[cp] != null) saida.push(CP1252[cp])
    else saida.push(0x3f)
  }
  return saida
}

function larguraDoByte(byte: number, fonte: Fonte): number {
  if (byte >= 0x20 && byte <= 0x7e) return ASCII[fonte][byte - 0x20]
  const especial = LARGURA_ESPECIAL[byte]
  if (especial) return especial[fonte === 'regular' ? 0 : 1]
  if (byte >= 0xc0) {
    const base = letraBase(byte)
    if (base != null) return ASCII[fonte][base - 0x20]
  }
  return fonte === 'regular' ? 556 : 611
}

/** Largura do texto em pontos, na fonte e no tamanho dados. */
export function larguraDoTexto(texto: string, fonte: Fonte, tamanho: number): number {
  let total = 0
  for (const b of codificarWinAnsi(texto)) total += larguraDoByte(b, fonte)
  return (total * tamanho) / 1000
}

/** Divide o texto em linhas que cabem em `larguraMax`; palavra maior que a linha é cortada por caractere. */
export function quebrarTexto(texto: string, fonte: Fonte, tamanho: number, larguraMax: number): string[] {
  const linhas: string[] = []
  for (const paragrafo of String(texto ?? '').split(/\r?\n/)) {
    const palavras = paragrafo.split(/\s+/).filter(Boolean)
    if (palavras.length === 0) {
      linhas.push('')
      continue
    }
    let atual = ''
    const empurrar = () => {
      linhas.push(atual)
      atual = ''
    }
    for (const palavra of palavras) {
      const tentativa = atual ? `${atual} ${palavra}` : palavra
      if (larguraDoTexto(tentativa, fonte, tamanho) <= larguraMax) {
        atual = tentativa
        continue
      }
      if (atual) empurrar()
      if (larguraDoTexto(palavra, fonte, tamanho) <= larguraMax) {
        atual = palavra
        continue
      }
      for (const simbolo of palavra) {
        if (atual && larguraDoTexto(atual + simbolo, fonte, tamanho) > larguraMax) empurrar()
        atual += simbolo
      }
    }
    if (atual) linhas.push(atual)
  }
  return linhas
}

/* ------------------------------- serialização ------------------------------- */

const n = (v: number) => {
  const s = v.toFixed(2)
  return s.replace(/\.?0+$/, '') || '0'
}

/** String literal do PDF em ASCII puro: parênteses e contrabarra escapados, bytes altos em octal. */
export function literalPdf(texto: string): string {
  let saida = '('
  for (const b of codificarWinAnsi(texto)) {
    if (b === 0x28 || b === 0x29 || b === 0x5c) saida += `\\${String.fromCharCode(b)}`
    else if (b >= 0x20 && b <= 0x7e) saida += String.fromCharCode(b)
    else saida += `\\${b.toString(8).padStart(3, '0')}`
  }
  return `${saida})`
}

/* --------------------------------- escritor --------------------------------- */

export type Celula = string | { t: string; negrito?: boolean; fundo?: number; centro?: boolean }
export type Coluna = { titulo: string; peso: number; alinhar?: 'esq' | 'centro' | 'dir' }

export type OpcoesEscritor = {
  titulo: string
  /** Texto do rodapé, à esquerda; à direita sai "Página N de M". */
  rodape: string
  margem?: number
}

export class EscritorPdf {
  readonly margem: number
  /** Posição vertical atual, medida do topo da página, em pontos. */
  y: number
  private readonly paginas: string[][] = []
  private readonly rodapeTexto: string
  private readonly tituloDoc: string
  private readonly margemInferior = 40

  constructor(opcoes: OpcoesEscritor) {
    this.margem = opcoes.margem ?? 36
    this.rodapeTexto = opcoes.rodape
    this.tituloDoc = opcoes.titulo
    this.y = this.margem
    this.novaPagina()
  }

  get larguraUtil() {
    return LARGURA_A4 - this.margem * 2
  }

  get totalDePaginas() {
    return this.paginas.length
  }

  novaPagina() {
    this.paginas.push([])
    this.y = this.margem
  }

  private emitir(cmd: string) {
    this.paginas[this.paginas.length - 1].push(cmd)
  }

  /** Quebra de página quando `altura` não cabe mais. */
  garantirEspaco(altura: number) {
    if (this.y + altura > ALTURA_A4 - this.margemInferior) this.novaPagina()
  }

  private emitirTexto(x: number, yTopo: number, texto: string, fonte: Fonte, tamanho: number) {
    const ref = fonte === 'negrito' ? 'F2' : 'F1'
    const yBase = ALTURA_A4 - yTopo - tamanho * 0.85
    this.emitir(`BT /${ref} ${n(tamanho)} Tf 0 g ${n(x)} ${n(yBase)} Td ${literalPdf(texto)} Tj ET`)
  }

  /** Texto numa posição absoluta (y do topo da linha), sem mexer no cursor. */
  texto(x: number, yTopo: number, texto: string, fonte: Fonte = 'regular', tamanho = 9) {
    this.emitirTexto(x, yTopo, texto, fonte, tamanho)
  }

  linha(x1: number, y1: number, x2: number, y2: number, espessura = 0.5) {
    this.emitir(`${n(espessura)} w 0 G ${n(x1)} ${n(ALTURA_A4 - y1)} m ${n(x2)} ${n(ALTURA_A4 - y2)} l S`)
  }

  /** Retângulo (y do topo). `fundo` é um cinza de 0 (preto) a 1 (branco); `borda` desenha o contorno. */
  retangulo(x: number, yTopo: number, largura: number, altura: number, opcoes: { fundo?: number; borda?: boolean } = {}) {
    const caminho = `${n(x)} ${n(ALTURA_A4 - yTopo - altura)} ${n(largura)} ${n(altura)} re`
    if (opcoes.fundo != null) this.emitir(`${n(opcoes.fundo)} g ${caminho} f 0 g`)
    if (opcoes.borda) this.emitir(`0.5 w 0 G ${caminho} S`)
  }

  /** Parágrafo com quebra de linha; avança o cursor. */
  paragrafo(texto: string, opcoes: { fonte?: Fonte; tamanho?: number; recuo?: number; espacoDepois?: number } = {}) {
    const fonte = opcoes.fonte ?? 'regular'
    const tamanho = opcoes.tamanho ?? 9
    const recuo = opcoes.recuo ?? 0
    const entre = tamanho * 1.3
    for (const l of quebrarTexto(texto, fonte, tamanho, this.larguraUtil - recuo)) {
      this.garantirEspaco(entre)
      if (l) this.emitirTexto(this.margem + recuo, this.y, l, fonte, tamanho)
      this.y += entre
    }
    this.y += opcoes.espacoDepois ?? 3
  }

  /** Título de seção: mantém ao menos algumas linhas junto, para não ficar órfão no fim da página. */
  titulo(texto: string, nivel: 1 | 2 | 3 = 2) {
    const tamanho = nivel === 1 ? 16 : nivel === 2 ? 11.5 : 9.5
    this.garantirEspaco(tamanho * 1.3 + (nivel === 3 ? 30 : 56))
    this.y += nivel === 1 ? 0 : 6
    this.emitirTexto(this.margem, this.y, texto, 'negrito', tamanho)
    this.y += tamanho * 1.3
    if (nivel === 2) {
      this.linha(this.margem, this.y, this.margem + this.larguraUtil, this.y, 0.8)
      this.y += 4
    }
  }

  espaco(pontos: number) {
    this.y += pontos
  }

  /**
   * Tabela com grade. Cada linha tem a altura da célula mais alta; o cabeçalho (cinza) repete ao quebrar a página.
   * Retorna sem desenhar nada quando não há linhas.
   */
  tabela(colunas: Coluna[], linhas: Celula[][], opcoes: { tamanho?: number; cabecalhoExtra?: Celula[][] } = {}) {
    if (linhas.length === 0) return
    const tamanho = opcoes.tamanho ?? 8
    const entre = tamanho * 1.25
    const pad = 2.5
    const pesoTotal = colunas.reduce((t, c) => t + c.peso, 0)
    const larguras = colunas.map((c) => (c.peso / pesoTotal) * this.larguraUtil)
    const xs = larguras.reduce<number[]>((acc, w, i) => [...acc, i === 0 ? this.margem : acc[i - 1] + larguras[i - 1]], [])

    const medir = (celulas: Celula[], negritoPadrao: boolean) =>
      celulas.map((c, i) => {
        const obj = typeof c === 'string' ? { t: c } : c
        const fonte: Fonte = obj.negrito || negritoPadrao ? 'negrito' : 'regular'
        return { obj, fonte, linhas: quebrarTexto(obj.t, fonte, tamanho, larguras[i] - pad * 2) }
      })

    const desenhar = (celulas: Celula[], cabecalho: boolean) => {
      const medidas = medir(celulas, cabecalho)
      const altura = Math.max(...medidas.map((m) => m.linhas.length), 1) * entre + pad * 2
      this.garantirEspaco(altura)
      medidas.forEach((m, i) => {
        const fundo = cabecalho ? 0.85 : m.obj.fundo
        this.retangulo(xs[i], this.y, larguras[i], altura, { fundo, borda: true })
        const alinhar = m.obj.centro ? 'centro' : colunas[i].alinhar ?? 'esq'
        m.linhas.forEach((l, k) => {
          const w = larguraDoTexto(l, m.fonte, tamanho)
          const x = alinhar === 'dir' ? xs[i] + larguras[i] - pad - w : alinhar === 'centro' ? xs[i] + (larguras[i] - w) / 2 : xs[i] + pad
          if (l) this.emitirTexto(x, this.y + pad + k * entre, l, m.fonte, tamanho)
        })
      })
      this.y += altura
    }

    const cabecalho = () => desenhar(colunas.map((c) => c.titulo), true)
    const alturaDe = (celulas: Celula[]) => Math.max(...medir(celulas, false).map((m) => m.linhas.length), 1) * entre + pad * 2
    // Cabeçalho e a primeira linha ficam juntos.
    this.garantirEspaco(alturaDe(colunas.map((c) => c.titulo)) + alturaDe(linhas[0]))
    cabecalho()
    for (const linha of linhas) {
      const altura = alturaDe(linha)
      if (this.y + altura > ALTURA_A4 - this.margemInferior) {
        this.novaPagina()
        cabecalho()
      }
      desenhar(linha, false)
    }
    this.y += 6
  }

  /** Campo de assinatura: linha com o rótulo embaixo. Ocupa `altura` pontos. */
  campoAssinatura(x: number, largura: number, rotulo: string, nota?: string | null) {
    const yLinha = this.y + 26
    this.linha(x, yLinha, x + largura, yLinha, 0.7)
    const linhasRotulo = quebrarTexto(rotulo, 'regular', 8, largura)
    linhasRotulo.forEach((l, i) => this.emitirTexto(x, yLinha + 2 + i * 10, l, 'regular', 8))
    const linhasNota = nota ? quebrarTexto(nota, 'regular', 6.5, largura) : []
    linhasNota.forEach((l, i) => this.emitirTexto(x, yLinha + 2 + linhasRotulo.length * 10 + i * 8, l, 'regular', 6.5))
    return 26 + 4 + linhasRotulo.length * 10 + linhasNota.length * 8 + 8
  }

  /* ------------------------------- finalização ------------------------------- */

  /** Monta o arquivo. Pode ser chamado uma vez; o rodapé é carimbado em todas as páginas. */
  finalizar(): Buffer {
    const total = this.paginas.length
    this.paginas.forEach((cmds, i) => {
      const pagina = `Página ${i + 1} de ${total}`
      const direita = LARGURA_A4 - this.margem - larguraDoTexto(pagina, 'regular', 7.5)
      cmds.push(`0.5 w 0 G ${n(this.margem)} ${n(ALTURA_A4 - (ALTURA_A4 - 30))} m ${n(LARGURA_A4 - this.margem)} ${n(ALTURA_A4 - (ALTURA_A4 - 30))} l S`)
      cmds.push(`BT /F1 7.5 Tf 0 g ${n(this.margem)} 20 Td ${literalPdf(this.rodapeTexto)} Tj ET`)
      cmds.push(`BT /F1 7.5 Tf 0 g ${n(direita)} 20 Td ${literalPdf(pagina)} Tj ET`)
    })

    // Objetos: 1 catálogo, 2 árvore de páginas, 3 e 4 fontes, 5 informações; depois (página, conteúdo) por página.
    const objetos: string[] = []
    const idPagina = (i: number) => 6 + i * 2
    const idConteudo = (i: number) => 7 + i * 2
    objetos[1] = '<< /Type /Catalog /Pages 2 0 R >>'
    objetos[2] = `<< /Type /Pages /Count ${total} /Kids [${this.paginas.map((_, i) => `${idPagina(i)} 0 R`).join(' ')}] >>`
    objetos[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'
    objetos[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'
    objetos[5] = `<< /Title ${literalPdf(this.tituloDoc)} /Producer (volei.space) /Creator (volei.space) >>`
    this.paginas.forEach((cmds, i) => {
      objetos[idPagina(i)] =
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${LARGURA_A4} ${ALTURA_A4}] ` +
        `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${idConteudo(i)} 0 R >>`
      const fluxo = cmds.join('\n')
      objetos[idConteudo(i)] = `<< /Length ${fluxo.length} >>\nstream\n${fluxo}\nendstream`
    })

    let arquivo = '%PDF-1.4\n%âãÏÓ\n'
    const offsets: number[] = []
    for (let id = 1; id < objetos.length; id++) {
      offsets[id] = arquivo.length
      arquivo += `${id} 0 obj\n${objetos[id]}\nendobj\n`
    }
    const inicioXref = arquivo.length
    arquivo += `xref\n0 ${objetos.length}\n0000000000 65535 f \n`
    for (let id = 1; id < objetos.length; id++) arquivo += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`
    arquivo += `trailer\n<< /Size ${objetos.length} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${inicioXref}\n%%EOF\n`
    return Buffer.from(arquivo, 'latin1')
  }
}
