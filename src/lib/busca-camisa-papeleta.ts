/** Dígitos aceitos no campo da posição vazia. A camisa da partida vai de 0 a 99. */
export const LIMITE_DIGITOS_CAMISA = 2

export type JogadorDaPapeleta = {
  /** Número do cadastro, o mesmo que a lista grava na posição. */
  numero: string
  /** Camisa da súmula, a mesma exibida na lista. */
  camisa: string
  libero: boolean
}

export type AvisoBuscaCamisa = 'inexistente' | 'repetido' | 'libero'

export type ResultadoBuscaCamisa =
  | { ok: true; numero: string }
  | { ok: false; aviso: AvisoBuscaCamisa }

export const AVISO_CAMISA: Record<AvisoBuscaCamisa, string> = {
  inexistente: 'Número não encontrado.',
  repetido: 'Este atleta já está em outra posição.',
  libero: 'Líbero não entra nesta posição.',
}

export function apenasDigitosCamisa(valor: string, limite = LIMITE_DIGITOS_CAMISA) {
  return String(valor ?? '').replace(/\D/g, '').slice(0, limite)
}

/** '01' e '1' são a mesma camisa. '00' vale 0. Sem dígito, fica vazio. */
export function normalizarCamisa(valor: string) {
  const digitos = String(valor ?? '').replace(/\D/g, '')
  if (!digitos) return ''
  return digitos.replace(/^0+(?=\d)/, '')
}

export function camisasEquivalentes(a: string, b: string) {
  const esquerda = normalizarCamisa(a)
  const direita = normalizarCamisa(b)
  return esquerda !== '' && esquerda === direita
}

export function buscarJogadorPorCamisa(
  digitado: string,
  elenco: readonly JogadorDaPapeleta[],
  ocupados: readonly string[],
  liberoSelecionado = '',
): ResultadoBuscaCamisa {
  const alvo = normalizarCamisa(digitado)
  if (!alvo) return { ok: false, aviso: 'inexistente' }
  const achados = elenco.filter((jogador) => camisasEquivalentes(jogador.camisa, alvo))
  if (achados.length !== 1) return { ok: false, aviso: 'inexistente' }
  const jogador = achados[0]
  if (ocupados.includes(jogador.numero)) return { ok: false, aviso: 'repetido' }
  if (jogador.libero || (liberoSelecionado !== '' && jogador.numero === liberoSelecionado)) {
    return { ok: false, aviso: 'libero' }
  }
  return { ok: true, numero: jogador.numero }
}

function temContinuacao(digitos: string, elenco: readonly JogadorDaPapeleta[]) {
  const alvo = normalizarCamisa(digitos)
  if (!alvo) return false
  return elenco.some((jogador) => {
    const camisa = normalizarCamisa(jogador.camisa)
    return camisa.length > alvo.length && camisa.startsWith(alvo)
  })
}

export type DecisaoCamisa =
  | { acao: 'esperar' }
  | { acao: 'avisar'; aviso: AvisoBuscaCamisa }
  | { acao: 'escalar'; numero: string }

export function decidirCamisa(input: {
  digitado: string
  elenco: readonly JogadorDaPapeleta[]
  ocupados: readonly string[]
  liberoSelecionado?: string
  forcar?: boolean
}): DecisaoCamisa {
  const digitos = apenasDigitosCamisa(input.digitado)
  if (!digitos) return { acao: 'esperar' }
  const completo = Boolean(input.forcar) || digitos.length >= LIMITE_DIGITOS_CAMISA
  if (!completo && (digitos === '0' || temContinuacao(digitos, input.elenco))) {
    return { acao: 'esperar' }
  }
  const busca = buscarJogadorPorCamisa(digitos, input.elenco, input.ocupados, input.liberoSelecionado ?? '')
  if (!busca.ok) return { acao: 'avisar', aviso: busca.aviso }
  return { acao: 'escalar', numero: busca.numero }
}

/** Próxima posição vazia depois da atual, voltando ao início da papeleta. */
export function proximaPosicaoVazia(escalacao: readonly string[], indiceAtual: number) {
  const total = escalacao.length
  if (total === 0) return null
  for (let passo = 1; passo <= total; passo += 1) {
    const indice = (indiceAtual + passo) % total
    if (!String(escalacao[indice] ?? '').trim()) return indice
  }
  return null
}
