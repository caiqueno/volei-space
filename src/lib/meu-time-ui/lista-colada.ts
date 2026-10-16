// Prepara a lista colada do WhatsApp para o envio em lote, reaproveitando o parser do cadastro rápido.
import {
  interpretarListaColada,
  separarNovosAtletas,
  type AtletaColado,
  type LinhaIgnorada,
} from '@/lib/elenco-inscricao'
import type { Atleta, AtletaLote } from './tipos'

export type PreparoLista = {
  novos: AtletaColado[]
  repetidos: Array<AtletaColado & { motivo: string }>
  ignoradas: LinhaIgnorada[]
  /** Corpo de POST .../atletas/lote. */
  payload: AtletaLote[]
  /** Linhas coladas sem número: salvas mesmo assim, número fica para depois. */
  semNumero: number
}

export function prepararLista(texto: string, existentes: Atleta[]): PreparoLista {
  const { atletas, ignoradas } = interpretarListaColada(texto)
  const { novos, repetidos } = separarNovosAtletas(
    atletas,
    existentes.map((a) => ({ nome: a.nome, numero: a.numeroPreferido })),
  )
  const payload: AtletaLote[] = novos.map((a) => (a.numero ? { nome: a.nome, numero: Number(a.numero) } : { nome: a.nome }))
  return { novos, repetidos, ignoradas, payload, semNumero: novos.filter((a) => !a.numero).length }
}

export function resumirResultadoLote(criados: number, ignorados: Array<{ linha: number; motivo: string }>) {
  const salvos = `${criados} ${criados === 1 ? 'atleta salvo' : 'atletas salvos'}`
  if (ignorados.length === 0) return `${salvos}.`
  return `${salvos}. ${ignorados.length} ${ignorados.length === 1 ? 'linha ficou de fora' : 'linhas ficaram de fora'}: veja abaixo o motivo.`
}
