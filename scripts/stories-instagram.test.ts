import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { cartazClassificacao, cartazJogos, cartazMataMata, cartazPartida, cartazQuadro, cartazRanking, cartazResultado, linkCurto, montarSumulaPublica } from '../src/lib/stories-cartaz'
import { AVISO_STORIES_FALLBACK, compartilharStories, deepLinkStories, type AmbienteShare } from '../src/lib/stories-compartilhar'
import { PALETA_OFICIAL_ID, PALETAS_STORIES, contraste, paletaDaCorLivre, paletaOficial, paletaTemContraste } from '../src/lib/stories-paleta'
import type { AtletaQuadro } from '../src/lib/quadro-publico'

const atletas: AtletaQuadro[] = [
  { jogadorId: 1, nome: 'Ana', equipe: 'Aurora', numero: 7, ataque: 10, bloqueio: 2, saque: 1 },
  { jogadorId: 2, nome: 'Bia', equipe: 'Bruma', numero: 4, ataque: 4, bloqueio: 4, saque: 4 },
  { jogadorId: 3, nome: 'Caio', equipe: 'Cais', numero: 9, ataque: 3, bloqueio: 1, saque: 0 },
  { jogadorId: 4, nome: 'Duda', equipe: 'Duna', numero: 2, ataque: 2, bloqueio: 0, saque: 1 },
  { jogadorId: 5, nome: 'Eva', equipe: 'Estrela', numero: 11, ataque: 1, bloqueio: 0, saque: 0 },
  { jogadorId: 6, nome: 'Felipe', equipe: 'Farol', numero: 8, ataque: 0, bloqueio: 0, saque: 0 },
]

const ranking = cartazRanking(atletas, 'https://volei.space/rankings?ligaId=65')
assert.equal(ranking.kicker, 'Ranking')
assert.equal(ranking.titulo, 'Top 5')
assert.equal(ranking.link, 'volei.space/rankings?ligaId=65')
assert.equal(ranking.linhas.filter((linha) => linha.tipo === 'posto').length, 5)
assert.match(ranking.linhas[0].texto, /^1º /)
assert.match(ranking.linhas[4].texto, /^5º /)
assert.equal(ranking.linhas.some((linha) => linha.texto.includes('Felipe')), false)
assert.equal(ranking.linhas[0].texto.includes('Ana'), true)

const tabela = cartazClassificacao([
  { nome: 'Grupo A', linhas: [{ equipe: 'Aurora', pontos: 6, vitorias: 2, derrotas: 0, setsPro: 4, setsContra: 1 }] },
], 'https://volei.space/classificacao', { equipe: 'Aurora', pontos: 6 })
assert.equal(tabela.linhas.some((linha) => linha.texto.includes('1º Aurora')), true)
assert.equal(tabela.linhas.some((linha) => linha.texto.startsWith('Líder:')), true)

const quadro = cartazQuadro({
  lider: { equipe: 'Aurora', pontos: 6 },
  atletas,
  grupos: [{ nome: 'Grupo A', linhas: [{ equipe: 'Aurora', pontos: 6, vitorias: 2, derrotas: 0, setsPro: 4, setsContra: 1 }] }],
}, 'https://volei.space/classificacao')
assert.equal(quadro.kicker, 'Quadro')
assert.equal(quadro.linhas.some((linha) => linha.texto === 'Top 5'), true)

const jogos = cartazJogos([
  { nomeA: 'Aurora', nomeB: 'Bruma', status: 'EM_ANDAMENTO', setsPorA: 1, setsPorB: 0 },
  { nomeA: 'Cais', nomeB: 'Duna', status: 'AGENDADA', setsPorA: null, setsPorB: null },
], 'https://volei.space/jogos')
assert.equal(jogos.linhas[0].valor, '1 x 0')
assert.equal(jogos.linhas[1].valor, 'Agendado')

const chave = cartazMataMata({
  rounds: [
    {
      fase: 'SEMIFINAL',
      label: 'Semifinal',
      slots: [
        { partida: { status: 'ENCERRADA', equipeA: { nome: 'Aurora' }, equipeB: { nome: 'Bruma' }, setsPorA: 2, setsPorB: 1, sets: [{ pontosA: 25, pontosB: 20 }, { pontosA: 23, pontosB: 25 }, { pontosA: 15, pontosB: 10 }] } },
        { partida: { status: 'ENCERRADA', equipeA: { nome: 'Cais' }, equipeB: { nome: 'Duna' }, setsPorA: 2, setsPorB: 0 } },
      ],
    },
    {
      fase: 'FINAL',
      label: 'Final',
      slots: [{ partida: { status: 'ENCERRADA', equipeA: { nome: 'Aurora' }, equipeB: { nome: 'Cais' }, setsPorA: 2, setsPorB: 0 } }],
    },
  ],
  thirdPlace: {
    fase: 'TERCEIRO_LUGAR',
    partida: { status: 'ENCERRADA', equipeA: { nome: 'Bruma' }, equipeB: { nome: 'Duna' }, setsPorA: 2, setsPorB: 1 },
  },
}, 'https://volei.space/portal?ligaId=65')
assert.equal(chave.linhas.some((linha) => linha.texto === 'Semifinais'), true)
assert.equal(chave.linhas.some((linha) => linha.texto === '3º lugar'), true)
assert.equal(chave.linhas.some((linha) => linha.texto === 'Final'), true)
assert.equal(chave.linhas.some((linha) => linha.texto.includes('Aurora x Bruma') && linha.valor === '2 x 1'), true)
assert.equal(chave.linhas.some((linha) => linha.detalhe === '25-20 · 23-25 · 15-10'), true)

const resultado = cartazResultado({
  nomeA: 'Angels',
  nomeB: 'Tayo',
  setsPorA: 2,
  setsPorB: 1,
  parciais: [{ numero: 1, pontosA: 25, pontosB: 21 }, { numero: 2, pontosA: 22, pontosB: 25 }, { numero: 3, pontosA: 15, pontosB: 12 }],
  vencedor: 'Angels',
  mvp: 'Lia',
  aoVivo: false,
}, 'https://volei.space/partidas/10/ao-vivo')
assert.equal(resultado.kicker, 'Fim de jogo')
assert.equal(resultado.titulo, 'Fim de jogo')
assert.equal(resultado.linhas.some((linha) => linha.texto === 'ANGELS venceu'), true)
assert.equal(resultado.linhas.some((linha) => linha.texto === 'Angels' && linha.valor === '2'), true)
assert.equal(resultado.linhas.some((linha) => linha.texto === 'Set 1' && linha.valor === '25 x 21'), true)
assert.equal(resultado.linhas.some((linha) => linha.texto === 'MVP Lia'), true)
assert.equal(resultado.linhas.some((linha) => linha.texto === 'Súmula'), false)

const sumula = montarSumulaPublica({
  nomeA: 'Angels',
  nomeB: 'Tayo',
  parciais: [{ numero: 1, pontosA: 25, pontosB: 21 }],
  ocorrencias: [
    { tipo: 'attack', jogadorId: 1 },
    { tipo: 'block', jogadorId: 2 },
    { tipo: 'ace', jogadorId: 1 },
    { tipo: 'ADVERTENCIA', jogadorId: 1 },
    { tipo: 'CARTAO_VERMELHO', jogadorId: 2 },
  ],
  jogadoresA: [{ id: 1, nome: 'Lia' }],
  jogadoresB: [{ id: 2, nome: 'Teo' }],
})
const comSumula = cartazResultado({
  nomeA: 'Angels',
  nomeB: 'Tayo',
  setsPorA: 2,
  setsPorB: 1,
  parciais: [{ numero: 1, pontosA: 25, pontosB: 21 }],
  vencedor: 'Angels',
  mvp: null,
  aoVivo: false,
}, 'https://volei.space/partidas/10/ao-vivo', sumula)
assert.equal(comSumula.linhas.some((linha) => linha.texto === 'Fundamentos'), true)
assert.equal(comSumula.linhas.some((linha) => linha.texto === 'Angels' && linha.detalhe === 'Ataque 1 · Bloqueio 0 · Saque 1'), true)
assert.equal(comSumula.linhas.some((linha) => linha.texto === 'Advertência · Lia'), true)
assert.equal(comSumula.linhas.some((linha) => linha.texto === 'Expulsão · Teo'), true)

const aoVivo = cartazPartida({
  nomeA: 'Angels',
  nomeB: 'Tayo',
  setsPorA: 1,
  setsPorB: 0,
  parciais: [{ numero: 2, pontosA: 12, pontosB: 8 }],
  vencedor: null,
  mvp: null,
  aoVivo: true,
  pontosA: 12,
  pontosB: 8,
}, 'https://volei.space/partidas/10/ao-vivo')
assert.equal(aoVivo.kicker, 'Ao vivo')
assert.equal(aoVivo.linhas[0].valor, '12 x 8')
assert.equal(aoVivo.linhas.some((linha) => linha.texto === 'Fim de jogo'), false)

assert.equal(PALETAS_STORIES.length >= 6 && PALETAS_STORIES.length <= 8, true)
assert.equal(PALETAS_STORIES[0].id, PALETA_OFICIAL_ID)
assert.equal(paletaOficial().nome, 'Preto e azul')
assert.equal(paletaOficial().fundoA, '#070D1A')
assert.equal(paletaOficial().primaria, '#185FA5')
assert.ok(contraste(paletaOficial().fundoA, paletaOficial().destaque) > 1)
for (const paleta of PALETAS_STORIES) assert.equal(paletaTemContraste(paleta), true, paleta.nome)
for (const cor of ['#000000', '#ffffff', '#ffff00', '#ff00aa', '#185FA5', '#22C55E']) {
  assert.equal(paletaTemContraste(paletaDaCorLivre(cor)), true, cor)
}
assert.equal(paletaDaCorLivre('azul').id, PALETA_OFICIAL_ID)

assert.equal(linkCurto('https://volei.space/jogos'), 'volei.space/jogos')
assert.equal(deepLinkStories(), null)

const arquivo = new File([new Uint8Array([1, 2, 3])], 'volei-space-story.png', { type: 'image/png' })

async function fluxo(parcial: Partial<AmbienteShare> & Pick<AmbienteShare, 'canShare' | 'share'>) {
  let baixou = false
  let copiou = ''
  const resultado = await compartilharStories(arquivo, 'https://volei.space/rankings', 'Ranking', {
    baixar: () => { baixou = true },
    copiar: async (texto) => { copiou = texto },
    ...parcial,
  })
  return { resultado, baixou, copiou }
}

async function conferirShare() {
  const nativo = await fluxo({ canShare: () => true, share: async () => {} })
  assert.equal(nativo.resultado, 'nativo')
  assert.equal(nativo.baixou, false)

  const cancelado = await fluxo({
    canShare: () => true,
    share: async () => {
      const erro = new Error('cancelado')
      erro.name = 'AbortError'
      throw erro
    },
  })
  assert.equal(cancelado.resultado, 'cancelado')
  assert.equal(cancelado.baixou, false)

  const fallback = await fluxo({ canShare: () => false, share: async () => { throw new Error('nao') } })
  assert.equal(fallback.resultado, 'fallback')
  assert.equal(fallback.baixou, true)
  assert.equal(fallback.copiou, 'https://volei.space/rankings')
  assert.equal(AVISO_STORIES_FALLBACK, 'Imagem salva e link copiado: abra o Instagram e poste nos stories')
}

conferirShare().catch((erro) => {
  console.error(erro)
  process.exit(1)
})

for (const arquivoFonte of [
  'src/lib/stories-paleta.ts',
  'src/lib/stories-cartaz.ts',
  'src/lib/stories-imagem.ts',
  'src/lib/stories-compartilhar.ts',
  'src/components/stories/BotaoStoriesInstagram.tsx',
]) {
  const fonte = readFileSync(arquivoFonte, 'utf8')
  assert.equal(fonte.includes('localStorage'), false, arquivoFonte)
  assert.equal(fonte.includes('sessionStorage'), false, arquivoFonte)
}
const botao = readFileSync('src/components/stories/BotaoStoriesInstagram.tsx', 'utf8')
assert.match(botao, /aria-label="Compartilhar nos stories do Instagram"/)
assert.match(botao, /setPaletaId\(PALETA_OFICIAL_ID\)/)
assert.match(botao, /setCorLivre\(null\)/)
assert.match(botao, /Incluir súmula/)
assert.match(readFileSync('src/components/stories/stories.module.css', 'utf8'), /prefers-reduced-motion:\s*reduce/)
