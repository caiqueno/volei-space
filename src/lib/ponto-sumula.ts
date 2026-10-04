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

export function lerRotuloPonto(texto: string) {
  return texto.match(/\+1 Ponto de (?:Saque|Bloqueio|Ataque)/)?.[0] ?? null
}

export function lerJogadorPonto(texto: string) {
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
