/**
 * Validação da papeleta do app de banco com o motor de regras (módulo PURO).
 * Devolve TODAS as violações, cada uma com código RG-xxx, mensagem em português e `categoria`:
 *  - 'ELENCO': problema da relação nominal (tamanho, camisas, líberos);
 *  - 'FORMACAO': problema da escalação dos seis titulares, líbero fora da formação ou capitão.
 * Assim a tela pode separar "arrume o elenco" de "arrume a formação".
 */
import { opcoesElencoDoPerfil, validarElenco, validarEntregaDaPapeleta, type PerfilRegras } from '@/lib/regras-volei'

export type JogadorBanco = { jogadorId: number; nome: string; numero: number }
export type EntradaFormacao = { posicao: number; jogadorId: number }
export type CategoriaViolacao = 'ELENCO' | 'FORMACAO'
export type Violacao = { codigo: string; mensagem: string; categoria?: CategoriaViolacao }

export type EntradaPapeleta = {
  formacao: readonly EntradaFormacao[]
  liberoId?: number | null
  /**
   * Segundo líbero (opcional, RG-LIB-001). Validado com o motor (diferente do primeiro, fora dos titulares,
   * na relação nominal, e só aceito quando o perfil/elenco permite dois líberos) e gravado em "libero2Id".
   */
  libero2Id?: number | null
  /** Capitão da equipe: basta constar na relação nominal; pode ser o líbero ou estar no banco (RG-ELE-005). */
  capitaoId?: number | null
}

export type OpcoesPapeleta = {
  /** Perfil de regras da categoria/competição (12 ou 14 jogadores, camisa 1 a 20, dois líberos acima de 12). */
  perfil?: PerfilRegras | null
}

export function validarPapeletaDoBanco(entrada: EntradaPapeleta, elenco: readonly JogadorBanco[], opcoes: OpcoesPapeleta = {}): Violacao[] {
  const violacoes: Violacao[] = []
  const formacao = (codigo: string, mensagem: string) => violacoes.push({ codigo, mensagem, categoria: 'FORMACAO' })
  const ids = elenco.map((j) => j.jogadorId)
  const nomeDe = (id: number) => elenco.find((j) => j.jogadorId === id)?.nome ?? `jogador ${id}`

  const porPosicao = new Map<number, number>()
  for (const item of entrada.formacao) {
    if (!Number.isInteger(item.posicao) || item.posicao < 1 || item.posicao > 6) {
      formacao('RG-FOR-005', `A posição ${item.posicao} não existe: use de I a VI (1 a 6).`)
    } else if (porPosicao.has(item.posicao)) {
      formacao('RG-FOR-005', `A posição ${item.posicao} foi preenchida duas vezes.`)
    } else {
      porPosicao.set(item.posicao, item.jogadorId)
    }
  }
  const titulares = [1, 2, 3, 4, 5, 6].map((p) => porPosicao.get(p))
  if (titulares.some((t) => t === undefined)) {
    formacao('RG-FOR-005', 'A papeleta precisa ter exatamente 6 jogadores, um em cada posição de I a VI.')
  }
  const presentes = titulares.filter((t): t is number => t !== undefined)
  if (new Set(presentes).size !== presentes.length) {
    formacao('RG-FOR-005', 'O mesmo jogador não pode ocupar duas posições: os seis titulares precisam ser distintos.')
  }
  if (presentes.length === 6 && new Set(presentes).size === 6) {
    const r = validarEntregaDaPapeleta({ formacao: presentes, relacao: ids, assinada: true, antesDoSet: true })
    if (!r.ok) formacao(r.codigo, r.mensagem)
  } else {
    for (const id of Array.from(new Set(presentes))) {
      if (!ids.includes(id)) formacao('RG-FOR-009', `O jogador ${id} não consta na relação nominal desta equipe.`)
    }
  }

  // Elenco: tamanho (12 ou 14 pelo perfil), camisas únicas de 1 a 20 (RG-ELE-004) e líberos da relação nominal
  // (RG-LIB-001, dois líberos acima de 12 quando o perfil exige).
  const liberoId = entrada.liberoId ?? null
  const libero2Id = entrada.libero2Id ?? null
  const liberos = [liberoId, libero2Id].filter((x): x is number => x != null)
  if (liberoId != null && libero2Id != null && liberoId === libero2Id) {
    violacoes.push({ codigo: 'RG-LIB-001', mensagem: 'Os dois líberos precisam ser jogadores diferentes.', categoria: 'ELENCO' })
  } else {
    if (libero2Id != null && liberoId == null) {
      violacoes.push({ codigo: 'RG-LIB-001', mensagem: 'Informe o primeiro líbero antes do segundo.', categoria: 'ELENCO' })
    }
    const camisas = validarElenco(
      elenco.map((j) => ({ id: j.jogadorId, camisa: j.numero })),
      liberos,
      opcoes.perfil ? opcoesElencoDoPerfil(opcoes.perfil) : {},
    )
    if (!camisas.ok) violacoes.push({ codigo: camisas.codigo, mensagem: camisas.mensagem, categoria: 'ELENCO' })
  }

  for (const id of liberos) {
    if (presentes.includes(id)) {
      formacao('RG-LIB-002', `${nomeDe(id)} é líbero e não pode estar entre os seis titulares da formação.`)
    }
  }

  // Capitão: basta constar na relação nominal. Pode ser o líbero e pode estar no banco; se não estiver em
  // quadra, quem faz de capitão em jogo é designado no início do set (RG-ELE-005), sem bloquear a papeleta.
  const capitaoId = entrada.capitaoId ?? null
  if (capitaoId != null && !ids.includes(capitaoId)) {
    formacao('RG-FOR-009', `O capitão ${capitaoId} não consta na relação nominal desta equipe.`)
  }
  return violacoes
}

/**
 * Avisos que não bloqueiam a papeleta. Hoje: capitão fora dos seis titulares (a designação do capitão em
 * jogo é feita no início do set, RG-ELE-005).
 */
export function avisosDaPapeleta(entrada: EntradaPapeleta): Violacao[] {
  const capitaoId = entrada.capitaoId ?? null
  if (capitaoId == null) return []
  const titulares = entrada.formacao.map((f) => f.jogadorId)
  if (titulares.includes(capitaoId)) return []
  return [
    {
      codigo: 'RG-ELE-005',
      mensagem: 'O capitão não está entre os seis titulares: o capitão em jogo será designado no início do set.',
      categoria: 'FORMACAO',
    },
  ]
}

/** Formação ordenada por posição (I a VI), no formato guardado. */
export function formacaoOrdenada(formacao: readonly EntradaFormacao[]): EntradaFormacao[] {
  return [...formacao]
    .map((f) => ({ posicao: f.posicao, jogadorId: f.jogadorId }))
    .sort((a, b) => a.posicao - b.posicao)
}
