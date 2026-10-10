export type OrigemPonto = 'ace' | 'attack' | 'block'

export const ROTULO_PONTO: Record<OrigemPonto, string> = {
  ace: '+1 Ponto de Saque',
  attack: '+1 Ponto de Ataque',
  block: '+1 Ponto de Bloqueio',
}

export function textoPonto(origem: OrigemPonto, equipe: string, numero: string, jogador: string) {
  const rotulo = ROTULO_PONTO[origem]
  const verbo = origem === 'ace' ? 'ACE' : origem === 'block' ? 'Bloqueio' : 'Ataque'
  const camisa = numero ? `#${numero} ` : ''
  return `${rotulo} — ${jogador}. ${verbo} para ${equipe}: ${camisa}${jogador}.`
}

export function textoPontoSemJogador(equipe: string) {
  return `+1 — Sem jogador. Ponto para ${equipe} sem jogador atribuído.`
}

const PONTO_SEM_JOGADOR = /^\+1\s+[—–-]\s+Sem jogador\./

export function ehPontoSemJogador(texto: string) {
  return PONTO_SEM_JOGADOR.test(texto.trim())
}

export function lerRotuloPonto(texto: string) {
  if (ehPontoSemJogador(texto)) return '+1'
  return texto.match(/\+1 Ponto de (?:Saque|Bloqueio|Ataque)/)?.[0] ?? null
}

export function lerJogadorPonto(texto: string) {
  if (ehPontoSemJogador(texto)) return 'Sem jogador'
  const atual = texto.match(/\+1 Ponto de (?:Saque|Bloqueio|Ataque)\s+[—-]\s+(.+?)\./)
  if (atual) return atual[1]
  const antigo = texto.match(/(?:ACE|Ataque|Bloqueio)\s+para\s+.+?:\s*#\S+\s+(.+?)(?:\.|$)/i)
  return antigo?.[1]?.trim() ?? null
}

export function linhasUltimosPontos(eventosDoMaisAntigoAoMaisNovo: Array<{ origem: OrigemPonto; jogador: string }>) {
  return [...eventosDoMaisAntigoAoMaisNovo].reverse().map((evento) => `${ROTULO_PONTO[evento.origem]} — ${evento.jogador}`)
}

export function contarOrigens(origens: OrigemPonto[]) {
  return {
    saque: origens.filter((origem) => origem === 'ace').length,
    bloqueio: origens.filter((origem) => origem === 'block').length,
    ataque: origens.filter((origem) => origem === 'attack').length,
  }
}

export function resumirPontos(eventos: Array<{ type: string; text?: string | null }>) {
  let atribuidos = 0
  let semAtleta = 0
  for (const evento of eventos) {
    if (evento.type === 'attack' || evento.type === 'block' || evento.type === 'ace') atribuidos += 1
    else if (evento.type === 'point' || ehPontoSemJogador(String(evento.text ?? ''))) semAtleta += 1
  }
  return { atribuidos, semAtleta }
}

export function textoResumoScout(resumo: { atribuidos: number; semAtleta: number }) {
  const atribuido = `${resumo.atribuidos} ponto(s) atribuído(s) a atletas`
  if (resumo.semAtleta === 0) return atribuido
  return `${atribuido} · ${resumo.semAtleta} sem atleta`
}
