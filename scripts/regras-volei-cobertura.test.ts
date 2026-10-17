/**
 * Cobertura de regras: todo ID de regra indoor do docs/analise/03-regras-validaveis.md que NÃO é [M] deve aparecer
 * no NOME de pelo menos um caso de teste do motor (scripts/regras-volei-*.test.ts e scripts/sumula-eventos*.test.ts).
 * O teste falha listando os IDs sem teste.
 *
 * Exceções (documentadas aqui, conferidas contra o 03 para não ficarem velhas):
 *  1. EXCECOES_M: regras cuja bullet no 03 traz o marcador [M] (de memória / não verificado). Pela regra de ouro do
 *     projeto, [M] fica CONFIGURÁVEL e SEM teste que o fixe como oficial; por isso não se exige cobertura.
 *     Se alguma tiver teste, ele cobre só a parte verificada [V]/[G] (ver "exceções com teste" no relatório).
 *  2. Prefixo RG-PRA-: vôlei de praia. O produto ainda não decidiu se terá praia (docs/analise/23 e HANDOFF-CURSOR);
 *     o motor é só indoor.
 *  3. PENDENTES_PDF_OU_PAPEL: regras que descrevem o preenchimento da súmula em PAPEL, o layout do PDF ou a redação do
 *     quadro de observações (não são comportamento validável pelo motor puro). NÃO são [M]: são dívida de teste do gerador
 *     de PDF/tela. A lista só pode encolher: o teste falha se um ID dela passar a ter teste ou se sumir do 03.
 */
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

const RAIZ = path.resolve(__dirname, '..')
const DOC = path.join(RAIZ, 'docs', 'analise', '03-regras-validaveis.md')

/** [M] no 03: ficam configuráveis e sem teste que os fixe como oficiais. Conferido contra o 03 a cada execução. */
const EXCECOES_M: readonly string[] = [
  'RG-SUB-002', // [M] contar por jogador em vez de por pedido
  'RG-TMP-009', // [M] tempo técnico indoor é do regulamento
  'RG-SAN-010', // [M] quem saca em 0x0 após penalidade entre sets
  'RG-PRO-002', // [M] não aceite de protesto sobre fato não anunciado
  'RG-PRO-004', // [M] decisão de protesto técnico é do órgão do regulamento
  'RG-WO-001', // [M] pontuação do WO em melhor de 3 / regulamento estadual
]

/**
 * Regras do 03 que descrevem o preenchimento da súmula em PAPEL, o layout do PDF ou a UI, sem comportamento
 * validável pelo motor puro. Cada uma precisa de um teste do gerador de PDF/tela; enquanto não houver, ficam aqui.
 */
const PENDENTES_PDF_OU_PAPEL: readonly string[] = [
  'RG-ELE-003', // ordem crescente, capitão circulado (papel)
  'RG-ELE-006', // formato do nome na súmula (PDF)
  'RG-ELE-007', // mandante à esquerda, letras A/B (PDF)
  'RG-FOR-010', // horário de início e marcação do saque (papel)
  'RG-FOR-011', // layout do 5º set (PDF)
  'RG-PTO-003', // ampulheta/circular último ponto (papel)
  'RG-SUB-005', // circular número do substituto (papel)
  'RG-SUB-015', // escrever número abaixo do titular (papel)
  'RG-TMP-004', // anotar tempo abaixo da coluna de pontos (papel)
  'RG-INT-006', // redação do quadro de observações
  'RG-INT-007', // sem rasura, súmula reserva (papel)
]

function lerIdsDoDocumento(): { todos: string[]; marcadosM: string[] } {
  const linhas = readFileSync(DOC, 'utf8').split(/\r?\n/)
  const todos: string[] = []
  const marcadosM: string[] = []
  for (const linha of linhas) {
    const m = /^- \*\*(RG-[A-Z]+-\d{3})\*\*/.exec(linha)
    if (!m) continue
    const id = m[1]!
    if (!todos.includes(id)) todos.push(id)
    if (linha.includes('[M')) marcadosM.push(id)
  }
  return { todos, marcadosM }
}

/** Expande "RG-ROT-001/002" e "RG-PRO-001..003" nos IDs individuais. */
function expandirIds(nome: string): string[] {
  const ids: string[] = []
  const re = /(RG-[A-Z]+-)(\d{3})((?:(?:\/|\.\.)\d{3})*)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(nome)) !== null) {
    const prefixo = m[1]!
    let anterior = Number(m[2])
    ids.push(`${prefixo}${m[2]}`)
    const resto = m[3] ?? ''
    const partes = resto.match(/(\/|\.\.)\d{3}/g) ?? []
    for (const parte of partes) {
      const n = Number(parte.slice(parte.startsWith('..') ? 2 : 1))
      if (parte.startsWith('..')) {
        for (let k = anterior + 1; k <= n; k += 1) ids.push(`${prefixo}${String(k).padStart(3, '0')}`)
      } else {
        ids.push(`${prefixo}${String(n).padStart(3, '0')}`)
      }
      anterior = n
    }
  }
  return ids
}

function arquivosDeTeste(): string[] {
  const dir = path.join(RAIZ, 'scripts')
  return readdirSync(dir)
    .filter((f) => /^(regras-volei-.*|sumula-eventos.*)\.test\.ts$/.test(f) && f !== 'regras-volei-cobertura.test.ts')
    .map((f) => path.join(dir, f))
}

function coberturaPorTeste(): Map<string, string[]> {
  const mapa = new Map<string, string[]>()
  const reCaso = /caso\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g
  for (const arquivo of arquivosDeTeste()) {
    const fonte = readFileSync(arquivo, 'utf8')
    let m: RegExpExecArray | null
    while ((m = reCaso.exec(fonte)) !== null) {
      for (const id of expandirIds(m[2]!)) {
        const lista = mapa.get(id) ?? []
        lista.push(`${path.basename(arquivo)}: ${m[2]}`)
        mapa.set(id, lista)
      }
    }
  }
  return mapa
}

const erros: string[] = []
const { todos, marcadosM } = lerIdsDoDocumento()
const cobertura = coberturaPorTeste()

if (todos.length < 100) erros.push(`O 03 devia trazer mais de 100 regras; li ${todos.length}. O formato do documento mudou?`)

// 1. As exceções [M] precisam bater com o 03 (nenhum [M] novo sem estar na lista, nenhuma exceção velha).
for (const id of marcadosM) {
  if (!EXCECOES_M.includes(id) && !id.startsWith('RG-PRA-')) {
    erros.push(`${id} está marcado [M] no 03 mas não consta em EXCECOES_M (documente a exceção).`)
  }
}
for (const id of EXCECOES_M) {
  if (!marcadosM.includes(id)) erros.push(`${id} está em EXCECOES_M mas não é mais [M] no 03: remova da lista e cubra com teste.`)
}
for (const id of PENDENTES_PDF_OU_PAPEL) {
  if (!todos.includes(id)) erros.push(`${id} está em PENDENTES_PDF_OU_PAPEL mas não existe mais no 03.`)
  if (cobertura.has(id)) erros.push(`${id} agora tem teste: remova de PENDENTES_PDF_OU_PAPEL.`)
}

// 2. Cobertura: cada ID não [M], não praia e não pendente de PDF/papel tem pelo menos um caso de teste.
const exigidos = todos.filter((id) => !EXCECOES_M.includes(id) && !id.startsWith('RG-PRA-') && !PENDENTES_PDF_OU_PAPEL.includes(id))
const semTeste = exigidos.filter((id) => !cobertura.has(id))
if (semTeste.length > 0) erros.push(`IDs do 03 sem nenhum caso de teste (${semTeste.length}): ${semTeste.join(', ')}`)

// 3. Os testes não podem citar ID que não existe no 03 (erro de digitação esconderia a falta de cobertura).
const desconhecidos = Array.from(cobertura.keys()).filter((id) => !todos.includes(id) && !id.startsWith('RG-LOG-'))
if (desconhecidos.length > 0) erros.push(`Testes citam IDs que não existem no 03 (nem são RG-LOG): ${desconhecidos.join(', ')}`)

const isentosComTeste = [...EXCECOES_M].filter((id) => cobertura.has(id))
console.log(`Regras no 03: ${todos.length}. Exigidas: ${exigidos.length}. Cobertas: ${exigidos.length - semTeste.length}.`)
console.log(`Exceções [M]: ${EXCECOES_M.length} (com teste só da parte verificada: ${isentosComTeste.join(', ') || 'nenhuma'}).`)
console.log(`Pendentes de PDF/papel (sem teste de motor): ${PENDENTES_PDF_OU_PAPEL.length}. Praia (RG-PRA, fora do motor): ${todos.filter((i) => i.startsWith('RG-PRA-')).length}.`)

if (erros.length > 0) {
  console.error('\nFALHOU a checagem de cobertura de regras:')
  for (const e of erros) console.error(`  - ${e}`)
  process.exit(1)
}
console.log('regras-volei-cobertura: ok.')
