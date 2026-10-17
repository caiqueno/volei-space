import assert from 'node:assert/strict'
import { erroDeChaveDuplicada } from '../src/lib/sumula-gravacao'
import { ausenteExplicito, idsPresentesNaSumula, MENSAGEM_MINIMO_ATLETAS, motivoMinimoAtletas, presenteNoPayload } from '../src/lib/presenca-oficial'
import { gravarPresenca, inserirSumulaPresenca, registrarOcorrencia } from '../src/lib/sumula-presenca'

type Linha = {
  id: number
  partidaId: number
  jogadorId: number
  equipeId: number
  presente: boolean | null
  numero: number | null
}

function clienteMemoria(inicial: Linha[] = [], idsQueColidem: number[] = [], falhasIdentity = 0) {
  const linhas = inicial.map((linha) => ({ ...linha }))
  const colisoes = new Set(idsQueColidem)
  const ocorrencias: Array<Record<string, unknown>> = []
  let identityAtras = falhasIdentity

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
        if (pendente && Object.prototype.hasOwnProperty.call(pendente, 'id')) {
          return { data: null, error: { code: '23505', message: 'id explicito' } }
        }
        if (identityAtras > 0) {
          identityAtras -= 1
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
  assert.equal(Object.prototype.hasOwnProperty.call(comOcorrencia.ocorrencias[0], 'id'), false)
  assert.equal(comOcorrencia.ocorrencias[0].partidaId, 1096)
  assert.equal(comOcorrencia.ocorrencias[0].descricao, 'Registro de presença')

  const atrasada = clienteMemoria([], [], 2)
  await registrarOcorrencia(atrasada, {
    partidaId: 1096,
    tipo: 'OBSERVACAO',
    descricao: 'Registro de presença depois da sequence',
  })
  assert.equal(atrasada.ocorrencias.length, 1)
  assert.equal(Object.prototype.hasOwnProperty.call(atrasada.ocorrencias[0], 'id'), false)

  assert.equal(erroDeChaveDuplicada({ code: '23505', message: 'duplicate key value violates unique constraint "OcorrenciaPartida_pkey"' }), true)
  assert.equal(erroDeChaveDuplicada({ message: 'column CategoriaConfiguracao.setsPorPartidaQuartas does not exist' }), false)

  assert.equal(presenteNoPayload(1, [1], []), true)
  assert.equal(presenteNoPayload(2, [1], []), null)
  assert.equal(presenteNoPayload(3, [], []), null)
  assert.equal(presenteNoPayload(4, [], [4]), false)
  assert.equal(presenteNoPayload(5, [5], [5]), true)

  const atletasA = [
    { id: 1, equipeId: 10, numero: 10 },
    { id: 2, equipeId: 10, numero: 2 },
    { id: 3, equipeId: 10, numero: 3 },
    { id: 4, equipeId: 10, numero: 4 },
    { id: 5, equipeId: 10, numero: 5 },
    { id: 6, equipeId: 10, numero: 6 },
    { id: 7, equipeId: 10, numero: 13 },
  ]
  const atletasB = [
    { id: 11, equipeId: 20, numero: 11 },
    { id: 12, equipeId: 20, numero: 12 },
    { id: 13, equipeId: 20, numero: 13 },
    { id: 14, equipeId: 20, numero: 14 },
    { id: 15, equipeId: 20, numero: 15 },
    { id: 16, equipeId: 20, numero: 9 },
    { id: 17, equipeId: 20, numero: 17 },
  ]
  const atletas = [...atletasA, ...atletasB]
  const equipes = [{ id: 10, nome: 'WINNERS - SP' }, { id: 20, nome: 'RS' }]
  const presencasTrocadas = [
    { jogadorId: 1, equipeId: 10, presente: null, numero: 13 },
    { jogadorId: 7, equipeId: 10, presente: null, numero: null },
    ...[2, 3, 4, 5, 6].map((id) => ({ jogadorId: id, equipeId: 10, presente: null, numero: null })),
    ...[11, 12, 13, 14, 15].map((id) => ({ jogadorId: id, equipeId: 20, presente: false, numero: null })),
    { jogadorId: 16, equipeId: 20, presente: null, numero: 20 },
    { jogadorId: 17, equipeId: 20, presente: null, numero: null },
  ]
  const papeleta = 'Papeleta do set 1 confirmada. [[ROT:1:teamA:10,2,3,4,5,6:11,12,13,14,15,]]'
  const soPapeleta = idsPresentesNaSumula({
    equipeAId: 10,
    equipeBId: 20,
    equipes,
    atletas,
    presencas: presencasTrocadas,
    ocorrencias: [{ tipo: 'set_start', descricao: papeleta, set: 1 }],
  })
  assert.deepEqual(Array.from(soPapeleta.get(10) ?? []).sort((a, b) => a - b), [1, 2, 3, 4, 5, 6])
  assert.equal(soPapeleta.get(10)?.has(7), false)
  assert.deepEqual(Array.from(soPapeleta.get(20) ?? []).sort((a, b) => a - b), [11, 12, 13, 14, 15])

  const comSubstituicao = idsPresentesNaSumula({
    equipeAId: 10,
    equipeBId: 20,
    equipes,
    atletas,
    presencas: presencasTrocadas,
    ocorrencias: [
      { tipo: 'set_start', descricao: papeleta, set: 1 },
      { tipo: 'substitution', descricao: 'Substituição RS: sai #11 Ana, entra #20 Bia. [[ROT:2:teamB:10,2,3,4,5,6:16,12,13,14,15,]]', set: 1 },
    ],
  })
  assert.equal(comSubstituicao.get(20)?.has(16), true)
  assert.equal(comSubstituicao.get(20)?.has(17), false)
  assert.equal(motivoMinimoAtletas({
    equipeAId: 10,
    equipeBId: 20,
    equipes,
    atletas,
    presencas: presencasTrocadas,
    ocorrencias: [
      { tipo: 'set_start', descricao: papeleta, set: 1 },
      { tipo: 'substitution', descricao: 'Substituição RS: sai #11 Ana, entra #20 Bia.', set: 1 },
    ],
  }), null)

  const umValidado = motivoMinimoAtletas({
    equipeAId: 10,
    equipeBId: 20,
    equipes,
    atletas,
    presencas: [
      { jogadorId: 1, equipeId: 10, presente: true, numero: 13 },
      ...[2, 3, 4, 5, 6, 7].map((id) => ({ jogadorId: id, equipeId: 10, presente: null, numero: null })),
      ...atletasB.map((atleta) => ({ jogadorId: atleta.id, equipeId: 20, presente: null, numero: null })),
    ],
    ocorrencias: [],
  })
  assert.equal(umValidado, MENSAGEM_MINIMO_ATLETAS)

  const semJogar = idsPresentesNaSumula({
    equipeAId: 10,
    equipeBId: 20,
    equipes,
    atletas,
    presencas: [{ jogadorId: 1, equipeId: 10, presente: null, numero: 13 }],
    ocorrencias: [],
  })
  assert.equal(semJogar.get(10)?.size ?? 0, 0)

  assert.equal(ausenteExplicito(4, [
    { id: 1, descricao: 'Registro de presença pelo árbitro 2 em 2026-10-11T12:00:00.000Z: atleta 4 ausente' },
  ]), true)
  assert.equal(ausenteExplicito(4, [
    { id: 1, descricao: 'Registro de presença pelo árbitro 2 em 2026-10-11T12:00:00.000Z: atleta 4 ausente' },
    { id: 2, descricao: 'Registro de presença pelo árbitro 2 em 2026-10-11T12:05:00.000Z: atleta 4 confirmado' },
  ]), false)
  assert.equal(ausenteExplicito(4, [{ id: 3, descricao: 'Registro de número de camisa: atleta 4 passou de 4 para 8' }]), false)

  // Ordem das ocorrências: o instante do registro manda, não o id nem a posição.
  const reg = (id: number, hora: string, estado: 'ausente' | 'confirmado') => ({
    id,
    descricao: `Registro de presença pelo árbitro 2 em 2026-10-11T${hora}.000Z: atleta 4 ${estado}`,
  })
  const ausenteReg = reg(1, '12:00:00', 'ausente')
  const confirmadoReg = reg(2, '12:05:00', 'confirmado')
  // lista cronológica (rota de presença)
  assert.equal(ausenteExplicito(4, [ausenteReg, confirmadoReg]), false)
  assert.equal(ausenteExplicito(4, [confirmadoReg, ausenteReg]), false)
  // lista do mais novo ao mais antigo (formato gravado pela tela): ids crescem do novo ao antigo
  assert.equal(ausenteExplicito(4, [{ ...confirmadoReg, id: 10 }, { ...ausenteReg, id: 11 }]), false)
  assert.equal(ausenteExplicito(4, [{ ...ausenteReg, id: 10 }, { ...confirmadoReg, id: 11 }].reverse()), false)
  // o último é ausenteReg, nas duas ordens de id
  const ausenteDepois = reg(5, '12:10:00', 'ausente')
  assert.equal(ausenteExplicito(4, [{ ...ausenteDepois, id: 1 }, { ...confirmadoReg, id: 2 }]), true)
  assert.equal(ausenteExplicito(4, [{ ...confirmadoReg, id: 1 }, { ...ausenteDepois, id: 2 }]), true)
  // caso misto: bloco da tela (novo primeiro) seguido de registro novo da rota (id maior, mais recente)
  assert.equal(ausenteExplicito(4, [
    { ...confirmadoReg, id: 20 }, { ...ausenteReg, id: 21 },
    reg(30, '12:20:00', 'ausente'),
  ]), true)
  assert.equal(ausenteExplicito(4, [
    { ...ausenteReg, id: 20 }, { descricao: 'Registro de número de camisa: atleta 4 passou de 4 para 8', id: 21 },
    reg(30, '12:20:00', 'confirmado'),
  ]), false)
  // sem instante no texto: cai na ordem cronológica compartilhada (padrão da tela, novo primeiro)
  assert.equal(ausenteExplicito(4, [
    { id: 1, descricao: 'atleta 4 confirmado' }, { id: 2, descricao: 'atleta 4 ausente' },
  ]), false)

  console.log('sumula-presenca ok')
}

main()
