/**
 * Ordem dos eventos da súmula: UMA função compartilhada pelo replay da tela e pela súmula impressa
 * (achado M4 do doc 24). Módulo PURO.
 *
 * Contexto: a tela guarda os eventos do mais novo para o mais antigo (addMatchEvent faz
 * `[item, ...atual]`) e o PUT grava o array nessa ordem, então os ids do banco crescem do mais novo
 * para o mais antigo. Quem lê com a premissa "id crescente = cronológico" (impressão, presença
 * oficial) inverte a sequência sem erro visível. Aqui a ordem é sempre declarada:
 *
 *  - 'novo-primeiro'  : a lista está do mais novo ao mais antigo (formato gravado pela tela);
 *  - 'antigo-primeiro': a lista já é cronológica (outras rotas, fila por eventos, fixtures);
 *  - 'auto'           : descobre o sentido por âncoras do próprio conteúdo (número do set, depois
 *                       início e fim de set) e, sem âncora, assume o formato gravado pela tela.
 *
 * O desempate nunca usa o carimbo HH:MM (não é único e atravessa a meia-noite).
 */

export type SentidoDaLista = 'novo-primeiro' | 'antigo-primeiro' | 'auto'

export type ItemOrdenavel = {
  id?: string | number | null
  set?: number | string | null
  tipo?: string | null
  type?: string | null
}

function numeroDoId(id: unknown): number | null {
  if (typeof id === 'number' && Number.isFinite(id)) return id
  if (typeof id === 'string') {
    const m = id.match(/(\d+)$/)
    if (m && /^(saved-)?\d+$/.test(id)) return Number(m[1])
  }
  return null
}

function tipoDe(item: ItemOrdenavel) {
  return String(item.tipo ?? item.type ?? '').toLowerCase()
}

function numeroDoSet(item: ItemOrdenavel): number | null {
  const n = Number(item.set)
  return Number.isInteger(n) && n > 0 ? n : null
}

/** Sentido em que a lista (já na ordem de gravação) está. Sem âncora, o formato gravado pela tela. */
export function detectarSentido(naOrdemDeGravacao: ReadonlyArray<ItemOrdenavel>): Exclude<SentidoDaLista, 'auto'> {
  // 1) número do set: em ordem cronológica nunca diminui.
  let sobe = 0
  let desce = 0
  let anterior: number | null = null
  for (const item of naOrdemDeGravacao) {
    const n = numeroDoSet(item)
    if (n == null) continue
    if (anterior != null) {
      if (n > anterior) sobe += 1
      else if (n < anterior) desce += 1
    }
    anterior = n
  }
  if (sobe !== desce) return sobe > desce ? 'antigo-primeiro' : 'novo-primeiro'

  // 2) dentro do set: o início vem antes do fim.
  const posicao = (tipo: string) => naOrdemDeGravacao.findIndex((item) => tipoDe(item) === tipo)
  const inicio = posicao('set_start')
  const fim = posicao('set_end')
  if (inicio >= 0 && fim >= 0 && inicio !== fim) return inicio < fim ? 'antigo-primeiro' : 'novo-primeiro'

  return 'novo-primeiro'
}

/**
 * Devolve uma cópia em ordem cronológica (do mais antigo ao mais novo). Quando os itens têm id
 * numérico, a ordem de gravação é o id crescente; senão, a posição na lista. A ordenação é estável.
 */
export function emOrdemCronologica<T extends ItemOrdenavel>(itens: ReadonlyArray<T>, sentido: SentidoDaLista = 'auto'): T[] {
  const indexados = itens.map((item, indice) => ({ item, indice, id: numeroDoId(item.id) }))
  const todosComId = indexados.length > 0 && indexados.every((x) => x.id != null)
  const gravacao = [...indexados].sort((a, b) => (todosComId ? (a.id as number) - (b.id as number) : 0) || a.indice - b.indice)
  const lista = gravacao.map((x) => x.item)
  const efetivo = sentido === 'auto' ? detectarSentido(lista) : sentido
  return efetivo === 'novo-primeiro' ? lista.reverse() : lista
}
