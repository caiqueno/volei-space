type ErroBanco = { message?: string; code?: string } | null

type ClienteBanco = {
  from: (tabela: string) => any
}

export const COLUNAS_PRESENCA = 'id,jogadorId,equipeId,presente,numero'

export type LinhaPresenca = {
  id: number
  jogadorId: number
  equipeId: number
  presente: boolean | null
  numero: number | null
}

const TENTATIVAS_ID = 5

function comoLinha(data: unknown): LinhaPresenca | null {
  const linha = Array.isArray(data) ? data[0] : data
  if (!linha || typeof linha !== 'object') return null
  const registro = linha as Partial<LinhaPresenca>
  if (registro.id == null) return null
  return {
    id: Number(registro.id),
    jogadorId: Number(registro.jogadorId),
    equipeId: Number(registro.equipeId),
    presente: registro.presente ?? null,
    numero: registro.numero ?? null,
  }
}

export async function reservarId(
  supabase: ClienteBanco,
  tabela: string,
): Promise<{ id: number | null; error: ErroBanco }> {
  const leitura = await supabase
    .from(tabela)
    .select('id')
    .order('id', { ascending: false })
    .limit(1)
  if (leitura.error) return { id: null, error: leitura.error }
  const linhas = Array.isArray(leitura.data) ? leitura.data : []
  const atual = Number(linhas[0]?.id ?? 0)
  if (!Number.isFinite(atual) || atual < 0) return { id: 1, error: null }
  return { id: Math.floor(atual) + 1, error: null }
}

export async function inserirSumulaPresenca(
  supabase: ClienteBanco,
  campos: {
    partidaId: number
    jogadorId: number
    equipeId: number
    presente: boolean | null
    numero?: number | null
  },
): Promise<{ data: LinhaPresenca | null; error: ErroBanco }> {
  let ultimo: ErroBanco = { message: 'Não foi possível reservar um id para a presença.', code: '23505' }
  for (let tentativa = 0; tentativa < TENTATIVAS_ID; tentativa += 1) {
    const reservado = await reservarId(supabase, 'SumulaPresenca')
    if (reservado.error || reservado.id == null) return { data: null, error: reservado.error }
    const criado = await supabase
      .from('SumulaPresenca')
      .insert({
        id: reservado.id + tentativa,
        partidaId: campos.partidaId,
        jogadorId: campos.jogadorId,
        equipeId: campos.equipeId,
        presente: campos.presente,
        ...(campos.numero !== undefined ? { numero: campos.numero } : {}),
      })
      .select(COLUNAS_PRESENCA)
      .single()
    const linha = comoLinha(criado.data)
    if (!criado.error && linha) return { data: linha, error: null }
    ultimo = criado.error ?? ultimo
    if (criado.error?.code !== '23505') return { data: null, error: criado.error }
  }
  return { data: null, error: ultimo }
}

export async function gravarPresenca(
  supabase: ClienteBanco,
  entrada: { partidaId: number; jogadorId: number; equipeId: number; presente: boolean },
): Promise<{ data: LinhaPresenca | null; error: ErroBanco }> {
  for (let tentativa = 0; tentativa < TENTATIVAS_ID; tentativa += 1) {
    const leitura = await supabase
      .from('SumulaPresenca')
      .select(COLUNAS_PRESENCA)
      .eq('partidaId', entrada.partidaId)
      .eq('jogadorId', entrada.jogadorId)
    if (leitura.error) return { data: null, error: leitura.error }

    const lidas = (Array.isArray(leitura.data) ? leitura.data : []) as unknown[]
    const existentes = lidas
      .map((linha) => comoLinha(linha))
      .filter((linha): linha is LinhaPresenca => linha != null)
    if (existentes.length > 0) {
      const gravado = await supabase
        .from('SumulaPresenca')
        .update({ presente: entrada.presente })
        .in('id', existentes.map((linha) => linha.id))
        .select(COLUNAS_PRESENCA)
      if (gravado.error) return { data: null, error: gravado.error }
      const gravadas = (Array.isArray(gravado.data) ? gravado.data : [gravado.data]) as unknown[]
      const linhas = gravadas
        .map((linha) => comoLinha(linha))
        .filter((linha): linha is LinhaPresenca => linha != null)
        .sort((a, b) => a.id - b.id)
      const linha = linhas[0] ?? null
      return {
        data: linha,
        error: linha ? null : { message: 'A presença não voltou depois da atualização.' },
      }
    }

    const criado = await inserirSumulaPresenca(supabase, {
      partidaId: entrada.partidaId,
      jogadorId: entrada.jogadorId,
      equipeId: entrada.equipeId,
      presente: entrada.presente,
    })
    if (!criado.error && criado.data) return criado
    if (criado.error?.code === '23505') continue
    return criado
  }
  return { data: null, error: { message: 'Não foi possível reservar um id para a presença.', code: '23505' } }
}

export async function registrarOcorrencia(
  supabase: ClienteBanco,
  linha: { partidaId: number; tipo: string; jogadorId?: number | null; descricao: string },
): Promise<void> {
  for (let tentativa = 0; tentativa < TENTATIVAS_ID; tentativa += 1) {
    const reservado = await reservarId(supabase, 'OcorrenciaPartida')
    if (reservado.error || reservado.id == null) {
      console.error('[ocorrencia] id', reservado.error)
      return
    }
    const criado = await supabase.from('OcorrenciaPartida').insert({
      id: reservado.id + tentativa,
      partidaId: linha.partidaId,
      tipo: linha.tipo,
      jogadorId: linha.jogadorId ?? null,
      descricao: linha.descricao,
    })
    if (!criado.error) return
    if (criado.error.code === '23505') continue
    console.error('[ocorrencia] insert', criado.error)
    return
  }
}
