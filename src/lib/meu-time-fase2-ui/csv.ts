import type { StatusLinha } from './tipos'

export const CABECALHO_MODELO = ['nome', 'data_nascimento', 'camisa', 'posicao'] as const
export const MODELO_CSV = `${CABECALHO_MODELO.join(',')}\nMaria da Silva,2005-03-14,10,Ponteira\nJoana Souza,2001-11-02,7,Líbero\n`
export const NOME_ARQUIVO_MODELO = 'modelo-atletas.csv'
export const LIMITE_BYTES_CSV = 512 * 1024

export function textoDoModeloCsv(): string {
  // BOM para o Excel abrir acentos corretamente.
  return `﻿${MODELO_CSV}`
}

export function validarArquivoCsv(arquivo: { name: string; size: number }): string | null {
  if (!/\.csv$/i.test(arquivo.name)) return 'Envie um arquivo .csv. No Excel, use "Salvar como" e escolha CSV.'
  if (arquivo.size === 0) return 'O arquivo está vazio.'
  if (arquivo.size > LIMITE_BYTES_CSV) return 'O arquivo é grande demais. Envie até 500 KB.'
  return null
}

export function textoCsvValido(csv: string): string | null {
  const linhas = csv.split(/\r?\n/).filter((l) => l.trim() !== '')
  if (linhas.length === 0) return 'Cole as linhas da planilha ou escolha um arquivo.'
  if (linhas.length === 1 && /nome/i.test(linhas[0])) return 'Só encontramos o cabeçalho. Adicione ao menos um atleta.'
  return null
}

const TEXTOS_ERRO: Record<string, string> = {
  NOME_OBRIGATORIO: 'Falta o nome do atleta.',
  NOME_CURTO: 'O nome está curto demais.',
  NASCIMENTO_INVALIDO: 'A data de nascimento não está válida. Use o formato 2005-03-14 ou 14/03/2005.',
  NASCIMENTO_OBRIGATORIO: 'Falta a data de nascimento.',
  CAMISA_INVALIDA: 'O número da camisa deve ir de 0 a 99.',
  CAMISA_DUPLICADA: 'Este número de camisa já está em uso no time.',
  POSICAO_INVALIDA: 'A posição não foi reconhecida.',
  ATLETA_DUPLICADO: 'Este atleta já está no time ou repetido na planilha.',
  MENOR_DE_IDADE: 'Atleta menor de idade: o responsável será contatado.',
  COLUNAS_FALTANDO: 'Faltam colunas nesta linha.',
}

/** Traduz um código (ou texto) de erro de linha em português simples. */
export function textoDeErroLinha(erro: unknown): string {
  const o = erro && typeof erro === 'object' ? (erro as Record<string, unknown>) : null
  const bruto = typeof erro === 'string' ? erro : o ? String(o.mensagem ?? o.codigo ?? '') : ''
  const chave = bruto.trim()
  if (TEXTOS_ERRO[chave]) return TEXTOS_ERRO[chave]
  if (/\s/.test(chave) && !/^[A-Z_ ]+$/.test(chave)) return chave
  return 'Esta linha tem um problema. Confira os dados.'
}

export const ROTULO_STATUS: Record<StatusLinha, string> = { OK: 'Pronta', AVISO: 'Com aviso', ERRO: 'Com erro' }

export function resumoEmFrase(r: { validas: number; comAviso: number; invalidas: number }): string {
  const p = (n: number, s: string, pl: string) => `${n} ${n === 1 ? s : pl}`
  return `${[p(r.validas, 'linha pronta', 'linhas prontas'), p(r.comAviso, 'com aviso', 'com avisos'), p(r.invalidas, 'com erro', 'com erros')].join(', ')}.`
}

/** Só dá para confirmar se ao menos uma linha entra. Linhas com erro ficam de fora. */
export function podeConfirmar(r: { validas: number; comAviso: number }): boolean {
  return r.validas + r.comAviso > 0
}
