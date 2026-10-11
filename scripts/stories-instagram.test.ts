import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ALTURA_LINHA_RANKING, LIMITE_GRUPO, LIMITE_RANKING, cartazClassificacao, cartazJogo, cartazMataMata, cartazPartida, cartazRanking, linkCurto, montarSumulaPublica } from '../src/lib/stories-cartaz'
import { AVISO_STORIES_FALLBACK, compartilharStories, deepLinkStories, type AmbienteShare } from '../src/lib/stories-compartilhar'
import { deveAquecerSafari, STORIES_ALTURA, STORIES_LARGURA, STORIES_MARGEM, STORIES_RODAPE_FIM, STORIES_RODAPE_INICIO, STORIES_ZONA_TOPO } from '../src/lib/stories-imagem'
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

const ranking = cartazRanking(atletas, 'ataque', 'https://volei.space/rankings?ligaId=65', 'Winners Oficial')
assert.equal(ranking.tipo, 'ranking')
assert.equal(ranking.fundamento, 'ataque')
assert.equal(ranking.kicker, 'Ranking')
assert.equal(ranking.titulo, 'Top Atacantes')
assert.equal(ranking.campeonato, 'Winners Oficial')
assert.equal(ranking.link, 'volei.space/rankings?ligaId=65')
assert.equal(ranking.atletas.length, LIMITE_RANKING)
assert.equal(ranking.atletas.length, 5)
assert.equal(ranking.atletas[0].nome, 'Ana')
assert.equal(ranking.atletas[0].pontos, 10)
assert.equal(ranking.atletas.some((atleta) => atleta.nome === 'Felipe'), false)
assert.equal(ALTURA_LINHA_RANKING, 180)

const bloqueio = cartazRanking(atletas, 'bloqueio', 'https://volei.space/rankings')
assert.equal(bloqueio.titulo, 'Top Bloqueadores')
assert.equal(bloqueio.atletas[0].nome, 'Bia')
assert.equal(bloqueio.atletas.every((atleta) => atleta.pontos > 0), true)

const linhasGrupo = Array.from({ length: 9 }, (_, indice) => ({
  equipe: `Time ${indice + 1}`,
  pontos: 9 - indice,
  vitorias: 1,
  derrotas: 0,
  setsPro: 2,
  setsContra: 1,
}))
const tabela = cartazClassificacao([
  { nome: 'Grupo A', vagas: 2, linhas: linhasGrupo },
  { nome: 'Grupo B', linhas: [{ equipe: 'Aurora', pontos: 6 }] },
], 'https://volei.space/classificacao', { equipe: 'Time 1', pontos: 9 }, 'Grupo A', 'Winners Oficial')
assert.equal(tabela.tipo, 'grupo')
assert.equal(tabela.titulo, 'Grupo A')
assert.equal(tabela.campeonato, 'Winners Oficial')
assert.equal(tabela.grupo?.linhas.length, LIMITE_GRUPO)
assert.equal(tabela.grupo?.linhas.length, 8)
assert.equal(tabela.grupo?.linhas.some((linha) => linha.equipe === 'Time 9'), false)
assert.equal(tabela.lider?.equipe, 'Time 1')
assert.equal(tabela.grupos.length, 2)

const jogo = cartazJogo({
  nomeA: 'Winners Pride',
  nomeB: 'Target',
  corA: '#3B82F6',
  corB: '#FFB331',
  status: 'ENCERRADA',
  setsPorA: 1,
  setsPorB: 2,
  parciais: [{ numero: 1, pontosA: 21, pontosB: 25 }, { numero: 2, pontosA: 25, pontosB: 20 }, { numero: 3, pontosA: 11, pontosB: 15 }],
  campeonato: 'Winners Oficial',
  rotulo: 'Rodada 1',
  data: '10 de out., 08:30',
  local: 'Quadra 01',
}, 'https://volei.space/jogos')
assert.equal(jogo.tipo, 'jogo')
assert.equal(jogo.campeonato, 'Winners Oficial')
assert.equal(jogo.jogo.status, 'Encerrada')
assert.equal(jogo.jogo.rotulo, 'Rodada 1')
assert.equal(jogo.jogo.setsPorA, 1)
assert.equal(jogo.jogo.setsPorB, 2)
assert.equal(jogo.jogo.parciais.length, 3)
assert.equal(jogo.jogo.data, '10 de out., 08:30')
assert.equal(jogo.jogo.local, 'Quadra 01')
assert.equal(jogo.jogo.encerrado, true)

const agendado = cartazJogo({
  nomeA: 'Winners Pride',
  nomeB: 'Target',
  status: 'AGENDADA',
  setsPorA: null,
  setsPorB: null,
  rotulo: 'Rodada 1',
}, 'https://volei.space/jogos', 'Teste')
assert.equal(agendado.tipo, 'jogo')
assert.equal(agendado.jogo.status, 'Agendada')
assert.equal(agendado.jogo.encerrado, false)
assert.equal(agendado.jogo.aoVivo, false)
assert.equal(agendado.campeonato, 'Teste')

const chave = cartazMataMata({
  rounds: [
    {
      fase: 'SEMIFINAL',
      label: 'Semifinal',
      slots: [
        { partida: { status: 'ENCERRADA', equipeA: { id: 1, nome: 'Aurora' }, equipeB: { id: 2, nome: 'Bruma' }, setsPorA: 2, setsPorB: 1, sets: [{ pontosA: 25, pontosB: 20 }, { pontosA: 23, pontosB: 25 }, { pontosA: 15, pontosB: 10 }] } },
        { partida: { status: 'ENCERRADA', equipeA: { id: 3, nome: 'Cais' }, equipeB: { id: 4, nome: 'Duna' }, setsPorA: 2, setsPorB: 0 } },
      ],
    },
    {
      fase: 'FINAL',
      label: 'Final',
      slots: [{ partida: { status: 'ENCERRADA', equipeA: { id: 1, nome: 'Aurora' }, equipeB: { id: 3, nome: 'Cais' }, setsPorA: 2, setsPorB: 0 } }],
    },
  ],
  thirdPlace: {
    fase: 'TERCEIRO_LUGAR',
    partida: { status: 'ENCERRADA', equipeA: { id: 2, nome: 'Bruma' }, equipeB: { id: 4, nome: 'Duna' }, setsPorA: 2, setsPorB: 1 },
  },
}, 'https://volei.space/portal?ligaId=65', 'Winners Oficial')
assert.equal(chave.tipo, 'chave')
assert.equal(chave.campeonato, 'Winners Oficial')
assert.equal(chave.semis.length, 2)
assert.equal(chave.rotuloSemis, 'Semifinais')
assert.equal(chave.final?.ladoA.nome, 'Aurora')
assert.equal(chave.final?.setsPorA, 2)
assert.equal(chave.terceiro?.ladoA.nome, 'Bruma')
assert.equal(chave.semis[0].parciais.map((set) => `${set.pontosA}-${set.pontosB}`).join(' · '), '25-20 · 23-25 · 15-10')
assert.equal(chave.semis[0].vencedor, 'A')

const resultado = cartazPartida({
  nomeA: 'Angels',
  nomeB: 'Tayo',
  setsPorA: 2,
  setsPorB: 1,
  parciais: [{ numero: 1, pontosA: 25, pontosB: 21 }, { numero: 2, pontosA: 22, pontosB: 25 }, { numero: 3, pontosA: 15, pontosB: 12 }],
  vencedor: 'Angels',
  mvp: 'Lia',
  aoVivo: false,
}, 'https://volei.space/partidas/10/ao-vivo', null, 'Winners Oficial')
assert.equal(resultado.tipo, 'resultado')
assert.equal(resultado.kicker, 'Fim de jogo')
assert.equal(resultado.titulo, 'Fim de jogo')
assert.equal(resultado.campeonato, 'Winners Oficial')
assert.equal(resultado.fraseVencedor, 'ANGELS venceu')
assert.equal(resultado.resultado.mvp, 'Lia')
assert.equal(resultado.resultado.parciais[0].pontosA, 25)
assert.equal(resultado.sumula, null)

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
assert.equal(sumula.fundamentos[0].ataque, 1)
assert.equal(sumula.fundamentos[0].saque, 1)
assert.equal(sumula.fundamentos[1].bloqueio, 1)
assert.equal(sumula.cartoes.some((cartao) => cartao.tipo === 'Advertência' && cartao.nome === 'Lia'), true)
assert.equal(sumula.cartoes.some((cartao) => cartao.tipo === 'Expulsão' && cartao.nome === 'Teo'), true)
const comSumula = cartazPartida({
  nomeA: 'Angels',
  nomeB: 'Tayo',
  setsPorA: 2,
  setsPorB: 1,
  parciais: [{ numero: 1, pontosA: 25, pontosB: 21 }],
  vencedor: 'Angels',
  mvp: null,
  aoVivo: false,
}, 'https://volei.space/partidas/10/ao-vivo', sumula)
assert.equal(comSumula.sumula?.fundamentos[0].equipe, 'Angels')

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
assert.equal(aoVivo.tipo, 'aovivo')
assert.equal(aoVivo.kicker, 'Ao vivo')
assert.equal(aoVivo.resultado.pontosA, 12)
assert.equal(aoVivo.fraseVencedor, null)

assert.equal(PALETAS_STORIES.length >= 6 && PALETAS_STORIES.length <= 8, true)
assert.equal(PALETAS_STORIES[0].id, PALETA_OFICIAL_ID)
assert.equal(paletaOficial().nome, 'Preto e azul')
assert.equal(paletaOficial().fundoA, '#070D1A')
assert.equal(paletaOficial().primaria, '#3B82F6')
assert.equal(paletaOficial().destaque, '#FFB331')
assert.equal(paletaOficial().superficie, '#0F1A2E')
assert.ok(contraste(paletaOficial().fundoA, paletaOficial().texto) >= 4.5)
for (const paleta of PALETAS_STORIES) assert.equal(paletaTemContraste(paleta), true, paleta.nome)
for (const cor of ['#000000', '#ffffff', '#ffff00', '#ff00aa', '#185FA5', '#22C55E']) {
  assert.equal(paletaTemContraste(paletaDaCorLivre(cor)), true, cor)
}
assert.equal(paletaDaCorLivre('azul').id, PALETA_OFICIAL_ID)

assert.equal(linkCurto('https://volei.space/jogos'), 'volei.space/jogos')
assert.equal(deepLinkStories(), null)
assert.equal(STORIES_LARGURA, 1080)
assert.equal(STORIES_ALTURA, 1920)
assert.equal(STORIES_MARGEM, 72)
assert.equal(STORIES_ZONA_TOPO, 250)
assert.equal(STORIES_RODAPE_INICIO, 1520)
assert.equal(STORIES_RODAPE_FIM, 1640)
assert.equal(deveAquecerSafari('Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15'), true)
assert.equal(deveAquecerSafari('Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36'), false)

const arquivo = new File([new Uint8Array([1, 2, 3])], 'volei-space-story.png', { type: 'image/png' })

async function fluxo(parcial: Partial<AmbienteShare> & Pick<AmbienteShare, 'canShare' | 'share'>) {
  let baixou = false
  let copiou = ''
  const resultadoShare = await compartilharStories(arquivo, 'https://volei.space/rankings', 'Ranking', {
    baixar: () => { baixou = true },
    copiar: async (texto) => { copiou = texto },
    ...parcial,
  })
  return { resultado: resultadoShare, baixou, copiou }
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
  'src/components/stories/CartazVisual.tsx',
]) {
  const fonte = readFileSync(arquivoFonte, 'utf8')
  assert.equal(fonte.includes('localStorage'), false, arquivoFonte)
  assert.equal(fonte.includes('sessionStorage'), false, arquivoFonte)
  assert.equal(fonte.includes('fillText'), false, arquivoFonte)
  assert.equal(fonte.includes('getContext'), false, arquivoFonte)
}

const visual = readFileSync('src/components/stories/CartazVisual.tsx', 'utf8')
const cabecalho = visual.slice(visual.indexOf('estilos.cabecalho'), visual.indexOf('estilos.miolo'))
assert.match(cabecalho, /cartaz\.campeonato/)
assert.match(cabecalho, /cartaz\.logoCampeonato/)
assert.match(cabecalho, /estilos\.faixa/)
assert.equal(cabecalho.includes('cartaz.titulo'), false)
assert.equal(visual.includes('{cartaz.titulo}</h1>'), false)
const rodape = visual.slice(visual.indexOf('estilos.rodape'), visual.indexOf('function Ranking'))
assert.equal(rodape.includes('cartaz.link'), false)
assert.match(rodape, /volei-space_simbolo-orbital_transparente\.png/)
assert.equal(visual.includes('brightness(0)'), false)

const imagem = readFileSync('src/lib/stories-imagem.ts', 'utf8')
assert.match(imagem, /document\.fonts/)
assert.match(imagem, /html-to-image/)
assert.match(imagem, /deveAquecerSafari/)

const css = readFileSync('src/components/stories/cartaz.module.css', 'utf8')
assert.match(css, /top:\s*250px/)
assert.match(css, /top:\s*450px/)
assert.match(css, /top:\s*1520px/)
assert.match(css, /left:\s*72px/)
assert.match(css, /height:\s*180px/)
assert.match(css, /\.cabecalho[\s\S]*background:\s*var\(--story-primaria\)/)
assert.match(css, /\.topoJogo[\s\S]*background:\s*var\(--story-primaria\)/)
assert.match(css, /\.topoRanking[\s\S]*background:\s*var\(--story-primaria\)/)
assert.match(css, /\.topoChave[\s\S]*background:\s*var\(--story-primaria\)/)
assert.equal(css.includes('#070D1A'), false)
assert.equal(css.includes('#16243D'), false)
assert.equal(/font-size:\s*(?:[0-9]|1[0-9]|2[0-7])px/.test(css), false)

const botaoCss = readFileSync('src/components/stories/stories.module.css', 'utf8')
assert.match(botaoCss, /prefers-reduced-motion:\s*reduce/)
assert.match(botaoCss, /button\.botaoLinha\[type='button'\]/)
assert.match(botaoCss, /appearance:\s*none/)
assert.match(botaoCss, /min-height:\s*42px/)
assert.match(botaoCss, /border-radius:\s*14px/)
assert.match(botaoCss, /background-image:\s*linear-gradient/)

const botao = readFileSync('src/components/stories/BotaoStoriesInstagram.tsx', 'utf8')
assert.match(botao, /aria-label="Compartilhar nos stories do Instagram"/)
assert.match(botao, /setPaletaId\(PALETA_OFICIAL_ID\)/)
assert.match(botao, /setCorLivre\(null\)/)
assert.match(botao, /Incluir súmula/)
assert.match(botao, /capturarCartaz/)
assert.equal(botao.includes('BotaoJogosStories'), false)
assert.equal(botao.includes('<canvas'), false)

const card = readFileSync('src/components/partidas/PartidaCard.tsx', 'utf8')
assert.match(card, /variante="linha"/)
assert.match(card, /cartazJogo/)
assert.match(card, /logoUrl=\{equipe\?\.logoUrl\}/)
assert.match(card, /partida\.liga\?\.logoUrl/)
assert.match(card, /compartilhar = false/)
assert.match(card, /items-center gap-2/)

const jogos = readFileSync('src/components/portal/JogosPublicos.tsx', 'utf8')
assert.equal(jogos.includes('BotaoJogosStories'), false)
assert.match(jogos, /compartilhar/)
assert.match(jogos, /Escolher outro campeonato/)
assert.match(jogos, /ligaId/)

const paginaJogos = readFileSync('src/app/jogos/page.tsx', 'utf8')
assert.match(paginaJogos, /EscolhaCampeonato/)
assert.match(paginaJogos, /basePath="\/jogos"/)
assert.match(paginaJogos, /JogosPublicos filtro=\{params\.filtro\} pagina=\{params\.pagina\} ligaId=\{ligaId\}/)

const quadro = readFileSync('src/components/portal/QuadroPublico.tsx', 'utf8')
assert.equal(quadro.includes('cartazQuadro'), false)
assert.equal(quadro.includes('BotaoStoriesInstagram'), false)

const top = readFileSync('src/components/classificacao/TopCinco.tsx', 'utf8')
assert.match(top, /cartazRanking\(atletas, quadro\.chave/)

const grupos = readFileSync('src/components/classificacao/TabelaGrupos.tsx', 'utf8')
assert.match(grupos, /cartazClassificacao/)
