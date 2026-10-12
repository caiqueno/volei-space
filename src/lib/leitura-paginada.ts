export const TAMANHO_LOTE = 1000

type RespostaPagina<T> = PromiseLike<{
  data: T[] | null
  error: { message: string } | null
}>

type ConsultaComRecorte<T> = {
  order: (coluna: string, opcoes?: { ascending?: boolean }) => {
    range: (inicio: number, fim: number) => RespostaPagina<T>
  }
}

/**
 * O PostgREST devolve no máximo 1000 linhas e, sem ordem, o recorte muda a cada carga.
 * `montar` precisa criar a consulta de novo a cada lote. A ordem é `id` crescente.
 */
export async function lerTodasAsLinhas<T>(montar: () => ConsultaComRecorte<T>, tamanho = TAMANHO_LOTE): Promise<T[]> {
  if (!Number.isInteger(tamanho) || tamanho < 1 || tamanho > TAMANHO_LOTE) {
    throw new Error('O lote de leitura precisa ter de 1 a 1000 linhas.')
  }
  const linhas: T[] = []
  let inicio = 0
  for (;;) {
    const { data, error } = await montar().order('id', { ascending: true }).range(inicio, inicio + tamanho - 1)
    if (error) throw error instanceof Error ? error : new Error(error.message)
    const lote = data ?? []
    linhas.push(...lote)
    if (lote.length < tamanho) return linhas
    inicio += tamanho
  }
}
