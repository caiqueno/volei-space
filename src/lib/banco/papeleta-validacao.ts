/**
 * Validação da papeleta do app de banco com o motor de regras (módulo PURO).
 * Devolve TODAS as violações, cada uma com código RG-xxx e mensagem em português.
 */
import { validarElenco, validarEntregaDaPapeleta } from '@/lib/regras-volei'

export type JogadorBanco = { jogadorId: number; nome: string; numero: number }
export type EntradaFormacao = { posicao: number; jogadorId: number }
export type Violacao = { codigo: string; mensagem: string }

export type EntradaPapeleta = {
  formacao: readonly EntradaFormacao[]
  liberoId?: number | null
  capitaoId?: number | null
}

export function validarPapeletaDoBanco(entrada: EntradaPapeleta, elenco: readonly JogadorBanco[]): Violacao[] {
  const violacoes: Violacao[] = []
  const ids = elenco.map((j) => j.jogadorId)
  const nomeDe = (id: number) => elenco.find((j) => j.jogadorId === id)?.nome ?? `jogador ${id}`

  const porPosicao = new Map<number, number>()
  for (const item of entrada.formacao) {
    if (!Number.isInteger(item.posicao) || item.posicao < 1 || item.posicao > 6) {
      violacoes.push({ codigo: 'RG-FOR-005', mensagem: `A posição ${item.posicao} não existe: use de I a VI (1 a 6).` })
    } else if (porPosicao.has(item.posicao)) {
      violacoes.push({ codigo: 'RG-FOR-005', mensagem: `A posição ${item.posicao} foi preenchida duas vezes.` })
    } else {
      porPosicao.set(item.posicao, item.jogadorId)
    }
  }
  const titulares = [1, 2, 3, 4, 5, 6].map((p) => porPosicao.get(p))
  if (titulares.some((t) => t === undefined)) {
    violacoes.push({ codigo: 'RG-FOR-005', mensagem: 'A papeleta precisa ter exatamente 6 jogadores, um em cada posição de I a VI.' })
  }
  const presentes = titulares.filter((t): t is number => t !== undefined)
  if (new Set(presentes).size !== presentes.length) {
    violacoes.push({ codigo: 'RG-FOR-005', mensagem: 'O mesmo jogador não pode ocupar duas posições: os seis titulares precisam ser distintos.' })
  }
  if (presentes.length === 6 && new Set(presentes).size === 6) {
    const r = validarEntregaDaPapeleta({ formacao: presentes, relacao: ids, assinada: true, antesDoSet: true })
    if (!r.ok) violacoes.push({ codigo: r.codigo, mensagem: r.mensagem })
  } else {
    for (const id of Array.from(new Set(presentes))) {
      if (!ids.includes(id)) violacoes.push({ codigo: 'RG-FOR-009', mensagem: `O jogador ${id} não consta na relação nominal desta equipe.` })
    }
  }

  // Camisa única na equipe (RG-ELE-004) e líbero da relação nominal (RG-LIB-001).
  const liberoId = entrada.liberoId ?? null
  const camisas = validarElenco(
    elenco.map((j) => ({ id: j.jogadorId, camisa: j.numero })),
    liberoId != null ? [liberoId] : [],
  )
  if (!camisas.ok) violacoes.push({ codigo: camisas.codigo, mensagem: camisas.mensagem })

  if (liberoId != null && presentes.includes(liberoId)) {
    violacoes.push({
      codigo: 'RG-LIB-002',
      mensagem: `${nomeDe(liberoId)} é o líbero e não pode estar entre os seis titulares da formação.`,
    })
  }

  // Capitão em jogo: precisa estar entre os titulares (RG-ELE-005).
  const capitaoId = entrada.capitaoId ?? null
  if (capitaoId != null) {
    if (!ids.includes(capitaoId)) {
      violacoes.push({ codigo: 'RG-FOR-009', mensagem: `O capitão ${capitaoId} não consta na relação nominal desta equipe.` })
    } else if (!presentes.includes(capitaoId)) {
      violacoes.push({
        codigo: 'RG-ELE-005',
        mensagem: `${nomeDe(capitaoId)} precisa estar entre os seis titulares para ser o capitão em jogo.`,
      })
    }
  }
  return violacoes
}

/** Formação ordenada por posição (I a VI), no formato guardado. */
export function formacaoOrdenada(formacao: readonly EntradaFormacao[]): EntradaFormacao[] {
  return [...formacao]
    .map((f) => ({ posicao: f.posicao, jogadorId: f.jogadorId }))
    .sort((a, b) => a.posicao - b.posicao)
}
