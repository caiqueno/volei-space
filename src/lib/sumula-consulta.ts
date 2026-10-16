import { ocorrenciaOperacional } from '@/lib/sumula-sessao'

// Projeção de leitura da súmula (somente consulta). Nunca devolve CPF, documento,
// nascimento, telefones, documentosUrls, qrCodeToken nem sumulaToken: cada campo
// é copiado de forma explícita, então coluna nova no banco não vaza por acidente.

/** Campos proibidos em qualquer resposta de consulta; usados pelos testes. */
export const CAMPOS_PROIBIDOS_CONSULTA = [
  'cpf',
  'documentoNumero',
  'documentoTipo',
  'dataNascimento',
  'telefone',
  'telefoneEmergencia',
  'documentosUrls',
  'qrCodeToken',
  'sumulaToken',
  'sumulaTokenExpira',
  'organizadorId',
  'email',
] as const

export const JOGADOR_CONSULTA_COLUNAS = 'id,nome,numero,posicao'

/** Seleção do PostgREST para a rota pública por id: só colunas que a projeção usa. */
export const PARTIDA_CONSULTA_COLUNAS = [
  'id,ligaId,rodada,fase,status,categoria,dataHora,localNome,setsPorA,setsPorB,pontosPorA,pontosPorB,vencedorId,sumulaAprovadaEm',
  'liga:Liga!Partida_ligaId_fkey(id,nome,status,simulacao)',
  `equipeA:Equipe!Partida_equipeAId_fkey(id,nome,logoUrl,corHex,jogadores:Jogador(${JOGADOR_CONSULTA_COLUNAS}))`,
  `equipeB:Equipe!Partida_equipeBId_fkey(id,nome,logoUrl,corHex,jogadores:Jogador(${JOGADOR_CONSULTA_COLUNAS}))`,
  `presencas:SumulaPresenca(id,presente,equipeId,jogadorId,numero,jogador:Jogador(${JOGADOR_CONSULTA_COLUNAS}))`,
  'sets:SetPartida(id,numero,pontosA,pontosB)',
  'ocorrencias:OcorrenciaPartida(id,tipo,descricao,set,jogadorId)',
  `destaques:DestaquesPartida(id,tipo,jogador:Jogador(${JOGADOR_CONSULTA_COLUNAS}))`,
  'escala:EscalaArbitro(id,cargo,arbitro:Arbitro(nome))',
].join(',')

function valorUnico<T>(valor: T | T[] | null | undefined) {
  return Array.isArray(valor) ? valor[0] ?? null : valor ?? null
}

function jogadorConsulta(jogador: any) {
  const item = valorUnico(jogador)
  if (!item) return null
  return {
    id: item.id,
    nome: item.nome,
    numero: item.numero ?? null,
    posicao: item.posicao ?? null,
    numeroHerdado: item.numeroHerdado ?? null,
  }
}

function equipeConsulta(equipe: any) {
  const item = valorUnico(equipe)
  if (!item) return null
  return {
    id: item.id,
    nome: item.nome,
    logoUrl: item.logoUrl ?? null,
    corHex: item.corHex ?? null,
    jogadores: (item.jogadores ?? []).map(jogadorConsulta).filter(Boolean),
  }
}

export function sumulaParaConsulta(partida: any) {
  const liga = valorUnico(partida.liga)
  return {
    id: partida.id,
    ligaId: partida.ligaId,
    rodada: partida.rodada,
    fase: partida.fase ?? null,
    status: partida.status,
    categoria: partida.categoria,
    dataHora: partida.dataHora,
    localNome: partida.localNome,
    setsPorA: partida.setsPorA,
    setsPorB: partida.setsPorB,
    pontosPorA: partida.pontosPorA,
    pontosPorB: partida.pontosPorB,
    vencedorId: partida.vencedorId,
    sumulaAprovadaEm: partida.sumulaAprovadaEm,
    liga: liga ? { id: liga.id, nome: liga.nome } : null,
    equipeA: equipeConsulta(partida.equipeA),
    equipeB: equipeConsulta(partida.equipeB),
    sets: [...(partida.sets ?? [])].sort((a: { numero: number }, b: { numero: number }) => Number(a.numero) - Number(b.numero)),
    presencas: (partida.presencas ?? []).map((item: any) => ({
      id: item.id,
      presente: item.presente,
      equipeId: item.equipeId,
      jogadorId: item.jogadorId,
      numero: item.numero ?? null,
      jogador: jogadorConsulta(item.jogador),
    })),
    ocorrencias: [...(partida.ocorrencias ?? [])]
      .filter((item: { tipo?: string | null; descricao?: string | null }) => !ocorrenciaOperacional(item))
      .map((item: any) => ({ id: item.id, tipo: item.tipo, descricao: item.descricao, set: item.set, jogadorId: item.jogadorId ?? null }))
      .sort((a: { id: number }, b: { id: number }) => Number(a.id) - Number(b.id)),
    destaques: (partida.destaques ?? []).map((item: any) => ({ id: item.id, tipo: item.tipo, jogador: jogadorConsulta(item.jogador) })),
    escala: (partida.escala ?? []).map((item: any) => {
      const arbitro = valorUnico(item.arbitro)
      return { id: item.id, cargo: item.cargo, arbitro: arbitro ? { nome: arbitro.nome } : null }
    }),
  }
}
