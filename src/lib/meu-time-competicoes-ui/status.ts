// Status da inscrição do time: caminho, texto simples e o que fazer em cada estado. Sem React, sem rede.

export type TomStatus = 'ok' | 'aviso' | 'erro' | 'neutro'

export type EtapaId = 'RASCUNHO' | 'EM_ANALISE' | 'PENDENCIA' | 'DECISAO'

export type DadosStatus = {
  rotulo: string
  explicacao: string
  /** O que o líder faz agora, em uma frase. */
  proximoPasso: string
  tom: TomStatus
  /** Etapa do caminho em que a inscrição está. */
  etapa: EtapaId
  /** Etapas anteriores já cumpridas. */
  concluidas: EtapaId[]
}

export const ETAPAS: ReadonlyArray<{ id: EtapaId; rotulo: string }> = [
  { id: 'RASCUNHO', rotulo: 'Rascunho' },
  { id: 'EM_ANALISE', rotulo: 'Em análise' },
  { id: 'PENDENCIA', rotulo: 'Pendência' },
  { id: 'DECISAO', rotulo: 'Resposta' },
]

export const STATUS_NOVOS = ['EM_ANALISE', 'AJUSTE_PEDIDO', 'LISTA_ESPERA', 'CONFIRMADA', 'CONFIRMADA_COM_PENDENCIAS', 'REMOVIDA'] as const

export type InscricaoDoLider = {
  status: string
  /** Comentário do organizador na pendência, quando o servidor envia junto. */
  comentario?: string | null
  motivoRecusa?: string | null
  posicaoEspera?: number | null
}

export function posicaoValida(v: unknown): number | null {
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 ? v : null
}

export function textoPosicaoEspera(posicao: number | null | undefined): string {
  const p = posicaoValida(posicao)
  return p === null ? 'Você está na lista de espera.' : `Você está na posição ${p} da lista de espera.`
}

export function textoMotivoRecusa(motivo: string | null | undefined): string {
  const m = motivo?.trim()
  return m ? `Motivo informado pelo organizador: ${m}` : 'O organizador não informou o motivo. Fale com ele para saber mais.'
}

/** Descreve o status. Estado desconhecido nunca quebra a tela. */
export function descreverStatus(i: InscricaoDoLider): DadosStatus {
  switch (i.status) {
    case 'RASCUNHO':
      return { rotulo: 'Rascunho', explicacao: 'A inscrição foi começada, mas ainda não foi enviada.', proximoPasso: 'Termine de escolher os atletas e envie a inscrição.', tom: 'neutro', etapa: 'RASCUNHO', concluidas: [] }
    case 'EM_ANALISE':
    case 'PENDENTE':
      return { rotulo: 'Em análise', explicacao: 'O organizador está olhando a inscrição do seu time.', proximoPasso: 'Não precisa fazer nada agora. Avisamos você quando ele responder.', tom: 'aviso', etapa: 'EM_ANALISE', concluidas: ['RASCUNHO'] }
    case 'AJUSTE_PEDIDO': {
      const c = i.comentario?.trim()
      return {
        rotulo: 'Pendência: o organizador pediu um ajuste',
        explicacao: c ? `O organizador escreveu: ${c}` : 'O organizador pediu uma mudança na inscrição.',
        proximoPasso: 'Faça o ajuste pedido e responda no campo abaixo. Depois a análise continua.',
        tom: 'aviso',
        etapa: 'PENDENCIA',
        concluidas: ['RASCUNHO', 'EM_ANALISE'],
      }
    }
    case 'LISTA_ESPERA':
      return {
        rotulo: 'Lista de espera',
        explicacao: `${textoPosicaoEspera(i.posicaoEspera)} As vagas acabaram, mas seu time continua na fila.`,
        proximoPasso: 'Aguarde. Se abrir uma vaga, avisamos você. Não precisa enviar de novo.',
        tom: 'aviso',
        etapa: 'DECISAO',
        concluidas: ['RASCUNHO', 'EM_ANALISE'],
      }
    case 'CONFIRMADA':
    case 'INSCRITA':
      return { rotulo: 'Aprovada', explicacao: 'Seu time está na categoria.', proximoPasso: 'Deixe o elenco completo e confira a data dos jogos.', tom: 'ok', etapa: 'DECISAO', concluidas: ['RASCUNHO', 'EM_ANALISE', 'PENDENCIA'] }
    case 'CONFIRMADA_COM_PENDENCIAS':
      return { rotulo: 'Aprovada, com pendências', explicacao: 'Seu time está inscrito, mas ainda faltam itens.', proximoPasso: 'Resolva o que falta dentro do prazo do organizador para não perder a vaga.', tom: 'aviso', etapa: 'DECISAO', concluidas: ['RASCUNHO', 'EM_ANALISE', 'PENDENCIA'] }
    case 'RECUSADA':
      return { rotulo: 'Recusada', explicacao: textoMotivoRecusa(i.motivoRecusa), proximoPasso: 'Se quiser, fale com o organizador ou escolha outra competição.', tom: 'erro', etapa: 'DECISAO', concluidas: ['RASCUNHO', 'EM_ANALISE'] }
    case 'REMOVIDA':
      return { rotulo: 'Removida pelo organizador', explicacao: 'O organizador tirou esta inscrição.', proximoPasso: 'Fale com ele para entender o motivo e ver se dá para voltar.', tom: 'erro', etapa: 'DECISAO', concluidas: ['RASCUNHO', 'EM_ANALISE'] }
    default:
      return { rotulo: 'Situação em atualização', explicacao: 'Atualize a página em instantes.', proximoPasso: 'Se continuar assim, fale com o organizador.', tom: 'aviso', etapa: 'EM_ANALISE', concluidas: ['RASCUNHO'] }
  }
}

/** Estado da etapa no caminho: concluída, atual ou futura. */
export function estadoDaEtapa(d: Pick<DadosStatus, 'etapa' | 'concluidas'>, id: EtapaId): 'concluida' | 'atual' | 'futura' {
  if (d.etapa === id) return 'atual'
  return d.concluidas.includes(id) ? 'concluida' : 'futura'
}

/** O campo de resposta só aparece quando há pendência para responder. */
export function podeResponder(status: string): boolean {
  return status === 'AJUSTE_PEDIDO'
}

// ---------------------------------------------------------------- comentários

export const LIMITE_COMENTARIO = 500

export type Comentario = { id: string; autor: 'ORGANIZADOR' | 'LIDER'; mensagem: string; criadoEm: string }

/** Tira espaços e limita o tamanho; vazio devolve null (não envia). */
export function prepararComentario(texto: string): string | null {
  const t = texto.trim().slice(0, LIMITE_COMENTARIO)
  return t ? t : null
}

export function normalizarComentarios(dado: unknown): Comentario[] {
  const lista = Array.isArray(dado) ? dado : dado && typeof dado === 'object' && Array.isArray((dado as { itens?: unknown }).itens) ? (dado as { itens: unknown[] }).itens : []
  return lista
    .map((i, n): Comentario => {
      const o = i && typeof i === 'object' ? (i as Record<string, unknown>) : {}
      const autorBruto = String(o.autor ?? o.papel ?? '').toUpperCase()
      return {
        id: typeof o.id === 'string' || typeof o.id === 'number' ? String(o.id) : `c${n}`,
        autor: autorBruto.includes('ORGANIZ') ? 'ORGANIZADOR' : 'LIDER',
        mensagem: typeof o.mensagem === 'string' ? o.mensagem : '',
        criadoEm: typeof o.criadoEm === 'string' ? o.criadoEm : '',
      }
    })
    .filter((c) => c.mensagem.trim() !== '')
}

export function rotuloAutor(autor: Comentario['autor']): string {
  return autor === 'ORGANIZADOR' ? 'Organizador' : 'Você'
}
