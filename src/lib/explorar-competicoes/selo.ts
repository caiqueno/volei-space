// Selo de elegibilidade (R18): "este time pode participar desta categoria?". Cálculo puro, feito no servidor,
// sempre com o motivo em texto simples e sem dado pessoal (nenhum nome ou data de nascimento nos detalhes).
import type { ElegibilidadeCategoria } from '@/lib/elegibilidade-categoria'
import { validarInscricao, type AtletaDoBanco, type Naipe, type RegraElencoDados } from '@/lib/meu-time/regras'

export type NivelSelo = 'OK' | 'AVISO' | 'BLOQUEIO'
export type Selo = { nivel: NivelSelo; texto: string; detalhes: string[] }

export type EntradaSelo = {
  /** Naipe do time. Nulo = nenhum time escolhido. */
  naipeEquipe: Naipe | null
  /** Atletas do banco do time (só os campos usados nas regras; nome não é usado). */
  atletas: AtletaDoBanco[]
  /** FEMININO | MASCULINO | MISTO | nulo (categoria sem naipe definido). */
  naipeCategoria: string | null
  regra: RegraElencoDados
  elegibilidade: ElegibilidadeCategoria | null
  janelaAberta: boolean
  janelaMotivo?: string | null
  vagasRestantes: number | null
  jaInscrita: boolean
  hoje?: Date
}

function plural(n: number, singular: string, pluralTexto: string) {
  return `${n} ${n === 1 ? singular : pluralTexto}`
}

const NOME_NAIPE: Record<string, string> = { MASCULINO: 'masculino', FEMININO: 'feminino', MISTO: 'misto' }

/** Atletas do time que passam na idade e no sexo da categoria, e quantos ficaram de fora por idade/sexo. */
export function atletasAptos(entrada: Pick<EntradaSelo, 'atletas' | 'regra' | 'elegibilidade' | 'naipeEquipe' | 'hoje'>) {
  const selecao = entrada.atletas.slice(0, 100).map((atleta, indice) => ({ atletaId: atleta.id, numero: indice }))
  const banco = new Map(entrada.atletas.map((atleta) => [atleta.id, atleta]))
  const resultado = validarInscricao(selecao, {
    naipeEquipe: entrada.naipeEquipe ?? 'MISTO',
    regra: entrada.regra,
    elegibilidade: entrada.elegibilidade,
    banco,
    jaInscritosNaCategoria: new Set(),
    totalComissao: 0,
    hoje: entrada.hoje,
  })
  const fora = new Set(resultado.erros.filter((e) => e.codigo === 'FORA_DA_IDADE' || e.codigo === 'NAIPE_INCOMPATIVEL').map((e) => e.atletaId))
  const semNascimento = resultado.pendencias.filter((p) => /falta a data de nascimento/.test(p)).length
  return { total: entrada.atletas.length, aptos: entrada.atletas.length - fora.size, foraDaRegra: fora.size, semNascimento }
}

export function calcularSelo(entrada: EntradaSelo): Selo {
  if (entrada.jaInscrita) return { nivel: 'OK', texto: 'Seu time já está inscrito nesta categoria', detalhes: [] }
  if (!entrada.naipeEquipe) {
    return { nivel: 'AVISO', texto: 'Escolha um time para ver se ele pode participar', detalhes: [] }
  }

  const naipe = String(entrada.naipeCategoria ?? '').toUpperCase()
  if ((naipe === 'MASCULINO' || naipe === 'FEMININO') && naipe !== entrada.naipeEquipe) {
    return {
      nivel: 'BLOQUEIO',
      texto: `Competição só para o naipe ${NOME_NAIPE[naipe]}`,
      detalhes: [`O naipe do seu time é ${NOME_NAIPE[entrada.naipeEquipe] ?? 'diferente'}.`],
    }
  }
  if (!entrada.janelaAberta) {
    return { nivel: 'BLOQUEIO', texto: 'Inscrições encerradas', detalhes: entrada.janelaMotivo ? [entrada.janelaMotivo] : [] }
  }
  if (entrada.vagasRestantes != null && entrada.vagasRestantes <= 0) {
    return { nivel: 'BLOQUEIO', texto: 'Não há mais vagas nesta categoria', detalhes: [] }
  }

  const { total, aptos, foraDaRegra, semNascimento } = atletasAptos(entrada)
  const detalhes: string[] = []
  if (total === 0) {
    return { nivel: 'AVISO', texto: 'Seu time ainda não tem atletas cadastrados', detalhes: ['Cadastre os atletas no banco do time para se inscrever.'] }
  }
  if (foraDaRegra > 0) detalhes.push(`${plural(foraDaRegra, 'atleta está', 'atletas estão')} fora da idade ou do naipe da categoria.`)
  if (semNascimento > 0) detalhes.push(`${plural(semNascimento, 'atleta sem data de nascimento', 'atletas sem data de nascimento')}: não foi possível conferir a idade.`)

  const minimo = entrada.regra.atletasMin
  if (minimo != null && aptos < minimo) {
    const faltam = minimo - aptos
    const texto = foraDaRegra > 0
      ? `Faltam ${plural(faltam, 'atleta', 'atletas')} na idade permitida`
      : `Faltam ${plural(faltam, 'atleta', 'atletas')} para o mínimo de ${minimo}`
    return { nivel: 'AVISO', texto, detalhes: [`${aptos} de ${total} atletas do time atendem às regras da categoria.`, ...detalhes] }
  }
  if (semNascimento > 0) return { nivel: 'AVISO', texto: 'Confira a data de nascimento dos atletas', detalhes }
  return { nivel: 'OK', texto: 'Seu time pode participar', detalhes }
}
