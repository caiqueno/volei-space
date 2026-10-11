export type PaletaStories = {
  id: string
  nome: string
  fundoA: string
  fundoB: string
  primaria: string
  destaque: string
  texto: string
  textoSuave: string
  sobreDestaque: string
}

export const PALETA_OFICIAL_ID = 'oficial'

const TEXTO_CLARO = '#F5F7FB'
const TEXTO_ESCURO = '#12141A'

export function normalizarHex(valor: string) {
  const texto = valor.trim()
  const curto = texto.match(/^#([0-9a-fA-F]{3})$/)
  if (curto) {
    const [r, g, b] = curto[1].split('')
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase()
  }
  const longo = texto.match(/^#([0-9a-fA-F]{6})$/)
  return longo ? `#${longo[1].toUpperCase()}` : null
}

export function luminancia(hex: string) {
  const cor = normalizarHex(hex) ?? TEXTO_ESCURO
  const canais = [1, 3, 5].map((inicio) => {
    const valor = parseInt(cor.slice(inicio, inicio + 2), 16) / 255
    return valor <= 0.03928 ? valor / 12.92 : ((valor + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * canais[0] + 0.7152 * canais[1] + 0.0722 * canais[2]
}

export function contraste(fundo: string, texto: string) {
  const clara = Math.max(luminancia(fundo), luminancia(texto))
  const escura = Math.min(luminancia(fundo), luminancia(texto))
  return (clara + 0.05) / (escura + 0.05)
}

export function misturar(origem: string, destino: string, quantidade: number) {
  const a = normalizarHex(origem) ?? TEXTO_ESCURO
  const b = normalizarHex(destino) ?? TEXTO_CLARO
  const peso = Math.min(1, Math.max(0, quantidade))
  const canal = (inicio: number) => Math.round(parseInt(a.slice(inicio, inicio + 2), 16) * (1 - peso) + parseInt(b.slice(inicio, inicio + 2), 16) * peso)
  return `#${[1, 3, 5].map((inicio) => canal(inicio).toString(16).padStart(2, '0')).join('')}`.toUpperCase()
}

function textoQuePassa(fundos: string[], preferida?: string) {
  const candidatas = [preferida, TEXTO_CLARO, '#FFFFFF', TEXTO_ESCURO, '#0B1220'].filter((item): item is string => Boolean(item))
  return candidatas.find((cor) => fundos.every((fundo) => contraste(fundo, cor) >= 4.5)) ?? TEXTO_CLARO
}

function fecharPaleta(bruta: {
  id: string
  nome: string
  fundoA: string
  fundoB: string
  primaria: string
  destaque: string
  texto?: string
  textoSuave?: string
}): PaletaStories {
  const fundos = [bruta.fundoA, bruta.fundoB]
  const texto = textoQuePassa(fundos, bruta.texto)
  const textoSuave = textoQuePassa(fundos, bruta.textoSuave ?? texto)
  let destaque = bruta.destaque
  let sobreDestaque = textoQuePassa([destaque], luminancia(destaque) > 0.4 ? TEXTO_ESCURO : TEXTO_CLARO)
  if (contraste(destaque, sobreDestaque) < 4.5) {
    destaque = luminancia(bruta.fundoA) < 0.4 ? '#D6E6FF' : '#12315F'
    sobreDestaque = textoQuePassa([destaque])
  }
  return {
    id: bruta.id,
    nome: bruta.nome,
    fundoA: bruta.fundoA,
    fundoB: bruta.fundoB,
    primaria: bruta.primaria,
    destaque,
    texto,
    textoSuave,
    sobreDestaque,
  }
}

export const PALETAS_STORIES: PaletaStories[] = [
  fecharPaleta({
    id: PALETA_OFICIAL_ID,
    nome: 'Preto e azul',
    fundoA: '#070D1A',
    fundoB: '#12315F',
    primaria: '#185FA5',
    destaque: '#8FC8FF',
    texto: TEXTO_CLARO,
    textoSuave: '#D5E2F4',
  }),
  fecharPaleta({
    id: 'verde',
    nome: 'Verde',
    fundoA: '#07140E',
    fundoB: '#0E3D2A',
    primaria: '#1F8A4C',
    destaque: '#8DFFC0',
    texto: '#F3FFF8',
    textoSuave: '#D5F6E4',
  }),
  fecharPaleta({
    id: 'vermelho',
    nome: 'Vermelho',
    fundoA: '#16080B',
    fundoB: '#5A1522',
    primaria: '#C7364A',
    destaque: '#FFC0CB',
    texto: '#FFF5F7',
    textoSuave: '#FFD9E0',
  }),
  fecharPaleta({
    id: 'laranja',
    nome: 'Laranja',
    fundoA: '#1A0E06',
    fundoB: '#5C2E0A',
    primaria: '#E07A1F',
    destaque: '#FFD0A1',
    texto: '#FFF8F1',
    textoSuave: '#FFE4CC',
  }),
  fecharPaleta({
    id: 'roxo',
    nome: 'Roxo',
    fundoA: '#120818',
    fundoB: '#3A1860',
    primaria: '#7C4DDB',
    destaque: '#D7C4FF',
    texto: '#F8F5FF',
    textoSuave: '#E6DCFF',
  }),
  fecharPaleta({
    id: 'amarelo',
    nome: 'Amarelo',
    fundoA: '#141004',
    fundoB: '#3D2E08',
    primaria: '#E0B000',
    destaque: '#FFE08A',
    texto: '#FFF9E8',
    textoSuave: '#FFEFC2',
  }),
  fecharPaleta({
    id: 'claro',
    nome: 'Branco',
    fundoA: '#F7F8FB',
    fundoB: '#D9E6F7',
    primaria: '#185FA5',
    destaque: '#0F2C52',
    texto: TEXTO_ESCURO,
    textoSuave: '#243044',
  }),
  fecharPaleta({
    id: 'dourado',
    nome: 'Dourado',
    fundoA: '#140E06',
    fundoB: '#3A2A10',
    primaria: '#FFB331',
    destaque: '#FFE0A3',
    texto: '#FFF8EC',
    textoSuave: '#FFE7C2',
  }),
]

export function paletaOficial() {
  return PALETAS_STORIES[0]
}

export function paletaPorId(id: string) {
  return PALETAS_STORIES.find((paleta) => paleta.id === id) ?? paletaOficial()
}

export function paletaDaCorLivre(cor: string) {
  const primaria = normalizarHex(cor)
  if (!primaria) return paletaOficial()
  if (luminancia(primaria) >= 0.45) {
    return fecharPaleta({
      id: 'livre',
      nome: 'Cor livre',
      fundoA: misturar(primaria, '#FFFFFF', 0.78),
      fundoB: misturar(primaria, '#F4F7FB', 0.5),
      primaria,
      destaque: misturar(primaria, '#070D1A', 0.45),
      texto: TEXTO_ESCURO,
    })
  }
  return fecharPaleta({
    id: 'livre',
    nome: 'Cor livre',
    fundoA: '#070D1A',
    fundoB: misturar(primaria, '#070D1A', 0.38),
    primaria,
    destaque: misturar(primaria, '#FFFFFF', 0.55),
    texto: TEXTO_CLARO,
  })
}

export function paletaTemContraste(paleta: PaletaStories) {
  const fundos = [paleta.fundoA, paleta.fundoB]
  return fundos.every((fundo) => contraste(fundo, paleta.texto) >= 4.5 && contraste(fundo, paleta.textoSuave) >= 4.5)
    && contraste(paleta.destaque, paleta.sobreDestaque) >= 4.5
}
