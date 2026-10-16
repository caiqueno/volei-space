import { agendaDaPartida } from '@/lib/format-partida'
import { normalizarNomeEquipe } from '@/lib/nome-equipe'
import { emOrdemCronologica } from '@/lib/sumula-ui/ordem'
import { lerOverride } from '@/lib/sumula-ui/override'
import {
  atletaPeloNumero,
  camisaDe,
  duracaoEntre,
  ehObservacao,
  ehSancao,
  ehSubstituicao,
  ehTempo,
  formacaoComNomes,
  ladoDoTexto,
  lerCapitaes,
  lerRotacao,
  liberoDoSet,
  normalizar,
  partesDaDescricao,
  textoBruto,
} from './interpretar'
import type {
  AtletaImpresso,
  EquipeImpressa,
  EquipeRegistro,
  EventoImpresso,
  Lado,
  ModeloImpressao,
  OcorrenciaRegistro,
  RegistroSumula,
  SetImpresso,
} from './tipos'

export const NAO_REGISTRADO = 'não registrado nesta versão'

/** Ordem cronológica pela função compartilhada com o replay da tela (M4 do doc 24). */
function ordenar(ocorrencias: OcorrenciaRegistro[]) {
  return emOrdemCronologica(ocorrencias, 'auto')
}

function evento(o: OcorrenciaRegistro, nomeA: string, nomeB: string): EventoImpresso {
  const partes = partesDaDescricao(o.descricao)
  return {
    id: o.id,
    hora: partes.hora,
    placar: partes.placar,
    texto: partes.texto,
    lado: ladoDoTexto(partes.texto, nomeA, nomeB),
    decisaoArbitro: decisaoDoArbitro(o.descricao),
  }
}

function decisaoDoArbitro(descricao?: string | null) {
  const decisao = lerOverride(textoBruto(descricao))
  return decisao ? `${decisao.codigo}: ${decisao.justificativa}` : null
}

/** Sanção sem marcador que repete outra com marcador (nota + evento gravados pela tela antiga) sai da lista. */
const temMarcaDeSancao = (o: OcorrenciaRegistro) => String(o.descricao ?? '').includes('[[SAN:')

function semSancaoRepetida(lista: OcorrenciaRegistro[]) {
  const comMarca = new Set(
    lista.filter((o) => temMarcaDeSancao(o)).map((o) => `${numeroDoSet(o)}|${partesDaDescricao(o.descricao).texto}`),
  )
  return lista.filter((o) => temMarcaDeSancao(o) || !comMarca.has(`${numeroDoSet(o)}|${partesDaDescricao(o.descricao).texto}`))
}

/** Observação gravada em dobro (mesma nota como item e como evento) aparece uma vez. */
function semObservacaoRepetida(lista: OcorrenciaRegistro[]) {
  const vistas = new Set<string>()
  return lista.filter((o) => {
    const p = partesDaDescricao(o.descricao)
    const chave = `${numeroDoSet(o)}|${p.hora}|${p.placar}|${p.texto}`
    if (vistas.has(chave)) return false
    vistas.add(chave)
    return true
  })
}

function numeroDoSet(o: OcorrenciaRegistro) {
  const n = Number(o.set)
  return Number.isInteger(n) && n > 0 ? n : 1
}

function montarEquipe(
  lado: Lado,
  equipe: EquipeRegistro,
  registro: RegistroSumula,
  capitao: string,
  liberos: Set<number>,
): EquipeImpressa {
  const presencas = registro.presencas ?? []
  const presentes = new Set(presencas.filter((p) => p.equipeId === equipe.id && p.presente).map((p) => p.jogadorId))
  const jogadores = (equipe.jogadores ?? []).filter((j) => presentes.size === 0 || presentes.has(j.id))
  const capitaoJogador = capitao ? atletaPeloNumero(equipe, capitao, presencas) : null
  const atletas: AtletaImpresso[] = jogadores.map((j) => ({
    jogadorId: j.id,
    camisa: camisaDe(j, presencas),
    nome: j.nome,
    capitao: capitaoJogador?.id === j.id,
    libero: liberos.has(j.id) || /l[ií]bero/i.test(String(j.posicao ?? '')),
  }))
  atletas.sort((a, b) => {
    const na = a.camisa === '' ? Infinity : Number(a.camisa)
    const nb = b.camisa === '' ? Infinity : Number(b.camisa)
    return na - nb || a.nome.localeCompare(b.nome, 'pt-BR')
  })
  return { lado, nome: normalizarNomeEquipe(equipe.nome), atletas }
}

function rotuloAtleta(equipe: EquipeRegistro, numero: string, presencas: RegistroSumula['presencas']) {
  const atleta = atletaPeloNumero(equipe, numero, presencas ?? [])
  if (!atleta) return numero ? `#${numero}` : null
  const camisa = camisaDe(atleta, presencas ?? [])
  return `${camisa ? `#${camisa} ` : ''}${atleta.nome}`
}

/** Constrói o modelo da súmula impressa só com o que a leitura da súmula já traz. */
export function montarSumulaImpressa(registro: RegistroSumula): ModeloImpressao | null {
  const equipeA = registro.equipeA
  const equipeB = registro.equipeB
  if (!equipeA || !equipeB) return null
  const nomeA = equipeA.nome
  const nomeB = equipeB.nome
  const presencas = registro.presencas ?? []
  const ocorrencias = ordenar(registro.ocorrencias ?? [])

  // Líberos que apareceram na papeleta de algum set marcam a relação nominal.
  const liberosPorSet = new Map<number, ReturnType<typeof liberoDoSet>>()
  const idsLibero = { A: new Set<number>(), B: new Set<number>() }
  for (const o of ocorrencias) {
    const set = numeroDoSet(o)
    if (liberosPorSet.has(set) || normalizar(String(o.tipo ?? '')) !== 'set_start') continue
    const lido = liberoDoSet([String(o.descricao ?? '')])
    if (!lido) continue
    liberosPorSet.set(set, lido)
    const a = atletaPeloNumero(equipeA, lido.liberoA, presencas)
    const b = atletaPeloNumero(equipeB, lido.liberoB, presencas)
    if (a) idsLibero.A.add(a.id)
    if (b) idsLibero.B.add(b.id)
  }
  for (const o of ocorrencias) {
    if (normalizar(String(o.tipo ?? '')) !== 'troca_libero') continue
    const m = textoBruto(o.descricao).match(/entra\s+#(\S+)/i)
    if (!m) continue
    const lado = ladoDoTexto(textoBruto(o.descricao), nomeA, nomeB)
    const equipe = lado === 'B' ? equipeB : equipeA
    const atleta = atletaPeloNumero(equipe, m[1].replace(/[.,]$/, ''), presencas)
    if (atleta && lado) idsLibero[lado].add(atleta.id)
  }

  const capitaes = lerCapitaes(ocorrencias, nomeA, nomeB)
  const modeloA = montarEquipe('A', equipeA, registro, capitaes.A, idsLibero.A)
  const modeloB = montarEquipe('B', equipeB, registro, capitaes.B, idsLibero.B)

  const setsOrdenados = [...(registro.sets ?? [])].sort((a, b) => Number(a.numero) - Number(b.numero))
  const sets: SetImpresso[] = setsOrdenados.map((s) => {
    const numero = Number(s.numero)
    const doSet = ocorrencias.filter((o) => numeroDoSet(o) === numero)
    const inicio = doSet.find((o) => normalizar(String(o.tipo ?? '')) === 'set_start')
    const fimEvento = [...doSet].reverse().find((o) => normalizar(String(o.tipo ?? '')) === 'set_end')
    const rot = inicio ? lerRotacao(inicio.descricao) : null
    const libero = liberosPorSet.get(numero) ?? null
    const horaInicio = inicio ? partesDaDescricao(inicio.descricao).hora || null : null
    const horaFim = fimEvento ? partesDaDescricao(fimEvento.descricao).hora || null : null
    const tempos = doSet.filter(ehTempo).map((o) => evento(o, nomeA, nomeB))
    const substituicoes = doSet.filter(ehSubstituicao).map((o) => evento(o, nomeA, nomeB))
    const regulares = doSet.filter((o) => ehSubstituicao(o) && normalizar(String(o.tipo ?? '')) !== 'troca_libero').map((o) => evento(o, nomeA, nomeB))
    const pontosA = Number(s.pontosA ?? 0)
    const pontosB = Number(s.pontosB ?? 0)
    return {
      numero,
      pontosA,
      pontosB,
      vencedor: pontosA === pontosB ? null : pontosA > pontosB ? 'A' : 'B',
      sacador: rot?.lado ?? null,
      formacaoA: rot ? formacaoComNomes(rot.formacaoA, equipeA, presencas) : null,
      formacaoB: rot ? formacaoComNomes(rot.formacaoB, equipeB, presencas) : null,
      liberoA: libero?.liberoA ? rotuloAtleta(equipeA, libero.liberoA, presencas) : null,
      liberoB: libero?.liberoB ? rotuloAtleta(equipeB, libero.liberoB, presencas) : null,
      inicio: horaInicio,
      fim: horaFim,
      duracaoMin: duracaoEntre(horaInicio, horaFim),
      tempos,
      substituicoes,
      tempoA: tempos.filter((t) => t.lado === 'A').length,
      tempoB: tempos.filter((t) => t.lado === 'B').length,
      substA: regulares.filter((t) => t.lado === 'A').length,
      substB: regulares.filter((t) => t.lado === 'B').length,
    }
  })

  const duracoes = sets.map((s) => s.duracaoMin)
  const duracaoTotalMin = sets.length && duracoes.every((d) => d != null) ? duracoes.reduce<number>((t, d) => t + (d ?? 0), 0) : null

  const agenda = agendaDaPartida(registro)
  const vencedor = registro.vencedorId === equipeA.id ? modeloA.nome : registro.vencedorId === equipeB.id ? modeloB.nome : null
  const mvp = (registro.destaques ?? [])
    .filter((d) => normalizar(String(d.tipo)) === 'mvp')
    .map((d) => d.jogador?.nome)
    .filter((n): n is string => Boolean(n))

  return {
    campeonato: registro.liga?.nome || 'Campeonato',
    categoria: registro.categoria || 'Não informada',
    fase: agenda.rotulo,
    data: agenda.data || 'Não informada',
    local: agenda.local || 'Não informado',
    arbitros: (registro.escala ?? [])
      .filter((e) => e.arbitro?.nome)
      .map((e) => ({ cargo: e.cargo || 'Árbitro', nome: String(e.arbitro?.nome) })),
    equipeA: modeloA,
    equipeB: modeloB,
    sets,
    sancoes: semSancaoRepetida(ocorrencias.filter(ehSancao)).map((o) => ({ ...evento(o, nomeA, nomeB), set: o.set ? numeroDoSet(o) : null })),
    observacoes: semObservacaoRepetida(ocorrencias.filter(ehObservacao)).map((o) => ({ ...evento(o, nomeA, nomeB), set: o.set ? numeroDoSet(o) : null })),
    decisoesDoArbitro: ocorrencias.filter((o) => lerOverride(textoBruto(o.descricao)) != null).map((o) => ({ ...evento(o, nomeA, nomeB), set: o.set ? numeroDoSet(o) : null })),
    setsA: Number(registro.setsPorA ?? 0),
    setsB: Number(registro.setsPorB ?? 0),
    totalPontosA: sets.reduce((t, s) => t + s.pontosA, 0),
    totalPontosB: sets.reduce((t, s) => t + s.pontosB, 0),
    duracaoTotalMin,
    vencedor,
    mvp,
    encerrada: vencedor != null,
  }
}

export function textoDuracao(min: number | null) {
  if (min == null) return NAO_REGISTRADO
  return `${min} min`
}

/** Mesma regra de acesso da súmula: id numérico só pela rota pública de consulta; senão, token. */
export function urlDeConsulta(token: string) {
  return /^\d+$/.test(token)
    ? `/api/partidas/${token}/sumula-publica`
    : `/api/sumula/${encodeURIComponent(token)}?consulta=1`
}
