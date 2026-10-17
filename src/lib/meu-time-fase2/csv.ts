// Parser puro do CSV de importação de atletas (Meu Time, fase 2). Sem banco, sem rede.
// Cabeçalho: nome,nascimento,camisa,posicao,responsavel_contato. Separador "," ou ";".
import { chaveAtleta, dataNascimentoValida } from '@/lib/meu-time/regras'
import { ehMenorDeIdade } from '@/lib/lgpd/idade'

export const MAXIMO_LINHAS_CSV = 60
export const POSICOES_CSV = ['LV', 'PT', 'OP', 'CT', 'LB'] as const

export type StatusLinha = 'OK' | 'AVISO' | 'ERRO'

export type DadosLinha = {
  nome: string
  dataNascimento: string | null
  numeroPreferido: number | null
  posicao: string | null
  menor: boolean
  /** O contato do responsável NÃO é guardado nem devolvido (minimização LGPD); só se registra que veio. */
  temResponsavelContato: boolean
}

export type LinhaCsv = {
  n: number
  status: StatusLinha
  erros: string[]
  avisos: string[]
  dados: DadosLinha
  /** Mesmo nome+nascimento de uma linha anterior da planilha: não será criada. */
  repetida: boolean
}

export type ResultadoCsv =
  | { ok: true; linhas: LinhaCsv[]; resumo: { validas: number; comAviso: number; invalidas: number } }
  | { ok: false; codigo: 'CSV_VAZIO' | 'CSV_SEM_CABECALHO' | 'CSV_LIMITE_LINHAS'; mensagem: string }

const ALIAS: Record<string, string> = {
  nome: 'nome',
  atleta: 'nome',
  nascimento: 'nascimento',
  datanascimento: 'nascimento',
  datadenascimento: 'nascimento',
  camisa: 'camisa',
  numero: 'camisa',
  posicao: 'posicao',
  responsavelcontato: 'responsavelContato',
  contatoresponsavel: 'responsavelContato',
}

function chaveCabecalho(valor: string) {
  const limpo = valor.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '')
  return ALIAS[limpo] ?? null
}

/** Separador mais frequente fora de aspas na primeira linha não vazia. */
export function detectarSeparador(texto: string): ',' | ';' {
  let virgulas = 0
  let pontoVirgulas = 0
  let dentro = false
  for (const c of texto) {
    if (c === '"') dentro = !dentro
    else if (!dentro && (c === '\n' || c === '\r')) {
      if (virgulas + pontoVirgulas > 0) break
    } else if (!dentro && c === ',') virgulas += 1
    else if (!dentro && c === ';') pontoVirgulas += 1
  }
  return pontoVirgulas > virgulas ? ';' : ','
}

/** Quebra o texto em registros e campos (aspas duplas, "" como aspas literal, quebra de linha dentro de aspas). */
export function lerRegistros(texto: string, separador: ',' | ';'): string[][] {
  const registros: string[][] = []
  let campo = ''
  let registro: string[] = []
  let dentro = false
  const fechaCampo = () => { registro.push(campo); campo = '' }
  const fechaRegistro = () => { fechaCampo(); registros.push(registro); registro = [] }
  for (let i = 0; i < texto.length; i += 1) {
    const c = texto[i]
    if (dentro) {
      if (c === '"') {
        if (texto[i + 1] === '"') { campo += '"'; i += 1 } else dentro = false
      } else campo += c
    } else if (c === '"') dentro = true
    else if (c === separador) fechaCampo()
    else if (c === '\r') { if (texto[i + 1] === '\n') i += 1; fechaRegistro() }
    else if (c === '\n') fechaRegistro()
    else campo += c
  }
  if (campo !== '' || registro.length > 0) fechaRegistro()
  return registros.filter((r) => r.some((c) => c.trim() !== ''))
}

/** dd/mm/aaaa ou aaaa-mm-dd para AAAA-MM-DD; null se o formato não for reconhecido. */
export function normalizarData(valor: string): string | null {
  const v = valor.trim()
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(v)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(v)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return null
}

/** Remove prefixo de fórmula (=, +, -, @) do nome, para não virar injeção se a planilha for reexportada. */
function limparNome(valor: string) {
  return valor.replace(/\s+/g, ' ').trim().replace(/^[=+\-@]+\s*/, '')
}

export function analisarCsv(textoBruto: string, hoje: Date = new Date()): ResultadoCsv {
  const texto = String(textoBruto ?? '').replace(/^﻿/, '')
  if (!texto.trim()) return { ok: false, codigo: 'CSV_VAZIO', mensagem: 'O CSV está vazio.' }
  const separador = detectarSeparador(texto)
  const registros = lerRegistros(texto, separador)
  const cabecalho = (registros[0] ?? []).map(chaveCabecalho)
  if (!cabecalho.includes('nome') || !cabecalho.includes('nascimento')) {
    return { ok: false, codigo: 'CSV_SEM_CABECALHO', mensagem: 'O CSV precisa de cabeçalho com as colunas nome e nascimento (e, se quiser, camisa, posicao, responsavel_contato).' }
  }
  const dadosBrutos = registros.slice(1)
  if (dadosBrutos.length === 0) return { ok: false, codigo: 'CSV_VAZIO', mensagem: 'O CSV não tem linhas de atletas.' }
  if (dadosBrutos.length > MAXIMO_LINHAS_CSV) {
    return { ok: false, codigo: 'CSV_LIMITE_LINHAS', mensagem: `Envie no máximo ${MAXIMO_LINHAS_CSV} linhas por importação.` }
  }

  const coluna = (registro: string[], nome: string) => {
    const indice = cabecalho.indexOf(nome)
    return indice >= 0 ? (registro[indice] ?? '').trim() : ''
  }
  const camisas = new Map<number, number>()
  const pessoas = new Set<string>()
  const linhas: LinhaCsv[] = dadosBrutos.map((registro, indice) => {
    const n = indice + 1
    const erros: string[] = []
    const avisos: string[] = []
    const nome = limparNome(coluna(registro, 'nome'))
    if (nome.length < 2 || !/[A-Za-zÀ-ɏ]/.test(nome)) erros.push('Nome ausente ou inválido.')
    else if (nome.length > 200) erros.push('Nome muito longo (máximo 200 caracteres).')

    const nascimentoBruto = coluna(registro, 'nascimento')
    let dataNascimento: string | null = null
    if (!nascimentoBruto) erros.push('Data de nascimento ausente.')
    else {
      const iso = normalizarData(nascimentoBruto)
      if (!iso || !dataNascimentoValida(iso, hoje)) erros.push('Data de nascimento inválida (use dd/mm/aaaa ou aaaa-mm-dd).')
      else dataNascimento = iso
    }

    const camisaBruta = coluna(registro, 'camisa')
    let numeroPreferido: number | null = null
    if (camisaBruta) {
      if (!/^\d{1,2}$/.test(camisaBruta)) erros.push('Camisa deve ser um número de 0 a 99.')
      else {
        numeroPreferido = Number(camisaBruta)
        const anterior = camisas.get(numeroPreferido)
        if (anterior != null) avisos.push(`Camisa ${numeroPreferido} repetida (também na linha ${anterior}).`)
        else camisas.set(numeroPreferido, n)
      }
    }

    const posicaoBruta = coluna(registro, 'posicao').toUpperCase()
    let posicao: string | null = null
    if (posicaoBruta) {
      if ((POSICOES_CSV as readonly string[]).includes(posicaoBruta)) posicao = posicaoBruta
      else avisos.push(`Posição "${posicaoBruta.slice(0, 20)}" desconhecida; será ignorada (use LV, PT, OP, CT ou LB).`)
    }

    const temResponsavelContato = coluna(registro, 'responsavelContato') !== ''
    const menor = dataNascimento != null && ehMenorDeIdade(dataNascimento, hoje)
    if (menor) {
      avisos.push('Menor de 18 anos: o atleta ficará com a pendência ATLETA_MENOR_SEM_CONSENTIMENTO até o responsável autorizar.')
      if (temResponsavelContato) avisos.push('O contato do responsável não é guardado pela importação; registre a autorização pelo cadastro do atleta.')
    }

    let repetida = false
    if (erros.length === 0 && dataNascimento) {
      const chave = chaveAtleta(nome, dataNascimento)
      if (pessoas.has(chave)) {
        repetida = true
        avisos.push('Atleta repetido na planilha (mesmo nome e nascimento); esta linha será ignorada.')
      } else pessoas.add(chave)
    }

    const status: StatusLinha = erros.length > 0 ? 'ERRO' : avisos.length > 0 ? 'AVISO' : 'OK'
    return { n, status, erros, avisos, repetida, dados: { nome, dataNascimento, numeroPreferido, posicao, menor, temResponsavelContato } }
  })

  const resumo = {
    validas: linhas.filter((l) => l.status === 'OK').length,
    comAviso: linhas.filter((l) => l.status === 'AVISO').length,
    invalidas: linhas.filter((l) => l.status === 'ERRO').length,
  }
  return { ok: true, linhas, resumo }
}
