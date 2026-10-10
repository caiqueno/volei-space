import assert from 'node:assert/strict'
import { gravarPresenca, inserirSumulaPresenca, registrarOcorrencia } from '../src/lib/sumula-presenca'

type Linha = {
  id: number
  partidaId: number
  jogadorId: number
  equipeId: number
  presente: boolean | null
  numero: number | null
}

function clienteMemoria(inicial: Linha[] = [], idsQueColidem: number[] = []) {
  const linhas = inicial.map((linha) => ({ ...linha }))
  const colisoes = new Set(idsQueColidem)
  const ocorrencias: Array<Record<string, unknown>> = []

  function from(tabela: string) {
    const filtros: Array<[string, number | number[]]> = []
    let modo: 'select' | 'update' | 'insert' = 'select'
    let pendente: Record<string, unknown> | null = null
    let ordemDesc = false
    let limite: number | null = null
    let unico = false

    const api = {
      select() { return api },
      eq(coluna: string, valor: number) { filtros.push([coluna, valor]); return api },
      in(coluna: string, valores: number[]) { filtros.push([coluna, valores]); return api },
      order(_coluna: string, opcoes: { ascending: boolean }) { ordemDesc = opcoes.ascending === false; return api },
      limit(quantidade: number) { limite = quantidade; return api },
      update(valores: Record<string, unknown>) { modo = 'update'; pendente = valores; return api },
      insert(valores: Record<string, unknown>) { modo = 'insert'; pendente = valores; return api },
      single() { unico = true; return api },
      then(resolve: (valor: unknown) => unknown, reject?: (motivo: unknown) => unknown) {
        return Promise.resolve(executar()).then(resolve, reject)
      },
    }

    function casa(linha: Record<string, unknown>) {
      return filtros.every(([coluna, valor]) => (
        Array.isArray(valor) ? valor.includes(Number(linha[coluna])) : Number(linha[coluna]) === valor
      ))
    }

    function executar() {
      if (tabela === 'OcorrenciaPartida') {
        if (modo === 'select') return { data: [{ id: ocorrencias.length }], error: null }
        const id = Number(pendente?.id)
        if (colisoes.has(id)) {
          colisoes.delete(id)
          return { data: null, error: { code: '23505', message: 'duplicate key' } }
        }
        ocorrencias.push({ ...(pendente ?? {}) })
        return { data: null, error: null }
      }

      if (modo === 'select') {
        let achadas = linhas.filter((linha) => casa(linha as unknown as Record<string, unknown>))
        achadas = [...achadas].sort((a, b) => (ordemDesc ? b.id - a.id : a.id - b.id))
        if (limite != null) achadas = achadas.slice(0, limite)
        return { data: achadas.map((linha) => ({ ...linha })), error: null }
      }

      if (modo === 'update') {
        const achadas = linhas.filter((linha) => casa(linha as unknown as Record<string, unknown>))
        for (const linha of achadas) Object.assign(linha, pendente)
        return { data: achadas.map((linha) => ({ ...linha })), error: null }
      }

      const id = Number(pendente?.id)
      if (linhas.some((linha) => linha.id === id) || colisoes.has(id)) {
        colisoes.delete(id)
        return { data: null, error: { code: '23505', message: 'duplicate key' } }
      }
      const nova: Linha = {
        id,
        partidaId: Number(pendente?.partidaId),
        jogadorId: Number(pendente?.jogadorId),
        equipeId: Number(pendente?.equipeId),
        presente: (pendente?.presente ?? null) as boolean | null,
        numero: (pendente?.numero ?? null) as number | null,
      }
      linhas.push(nova)
      const data = unico ? { ...nova } : [{ ...nova }]
      return { data, error: null }
    }

    return api
  }

  return { from, linhas, ocorrencias }
}

async function main() {
  const vazio = clienteMemoria()
  const criada = await gravarPresenca(vazio, { partidaId: 1096, jogadorId: 7, equipeId: 3, presente: true })
  assert.equal(criada.error, null)
  assert.equal(criada.data?.id, 1)
  assert.equal(criada.data?.presente, true)
  assert.equal(criada.data?.numero, null)
  assert.equal(vazio.linhas.length, 1)

  const ausente = await gravarPresenca(vazio, { partidaId: 1096, jogadorId: 7, equipeId: 3, presente: false })
  assert.equal(ausente.error, null)
  assert.equal(ausente.data?.id, 1)
  assert.equal(ausente.data?.presente, false)
  assert.equal(vazio.linhas.length, 1)

  const comNumero = clienteMemoria([{ id: 40, partidaId: 10, jogadorId: 2, equipeId: 8, presente: null, numero: 12 }])
  const confirmada = await gravarPresenca(comNumero, { partidaId: 10, jogadorId: 2, equipeId: 8, presente: true })
  assert.equal(confirmada.data?.presente, true)
  assert.equal(confirmada.data?.numero, 12)
  assert.equal(comNumero.linhas[0].numero, 12)

  const duplicada = clienteMemoria([
    { id: 4, partidaId: 10, jogadorId: 2, equipeId: 8, presente: false, numero: 9 },
    { id: 9, partidaId: 10, jogadorId: 2, equipeId: 8, presente: false, numero: 9 },
  ])
  const unificada = await gravarPresenca(duplicada, { partidaId: 10, jogadorId: 2, equipeId: 8, presente: true })
  assert.equal(unificada.data?.id, 4)
  assert.equal(duplicada.linhas.every((linha) => linha.presente === true), true)

  const colisao = clienteMemoria([{ id: 15, partidaId: 1, jogadorId: 1, equipeId: 1, presente: true, numero: null }], [16])
  const depois = await gravarPresenca(colisao, { partidaId: 1, jogadorId: 99, equipeId: 4, presente: true })
  assert.equal(depois.error, null)
  assert.equal(depois.data?.id, 17)
  assert.equal(colisao.linhas.some((linha) => linha.jogadorId === 99), true)

  const numero = await inserirSumulaPresenca(clienteMemoria(), {
    partidaId: 3,
    jogadorId: 8,
    equipeId: 1,
    presente: null,
    numero: 0,
  })
  assert.equal(numero.data?.numero, 0)
  assert.equal(numero.data?.presente, null)

  const comOcorrencia = clienteMemoria()
  await registrarOcorrencia(comOcorrencia, {
    partidaId: 1096,
    tipo: 'OBSERVACAO',
    jogadorId: 7,
    descricao: 'Registro de presença',
  })
  assert.equal(comOcorrencia.ocorrencias.length, 1)
  assert.equal(comOcorrencia.ocorrencias[0].id, 1)

  console.log('sumula-presenca ok')
}

main()
