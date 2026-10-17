/** Estado dos botões do app do banco (habilitado/desabilitado + motivo explicável). Módulo PURO. */
import { validarPedidoNaInterrupcao } from '../regras-volei'
import type { EstadoPapeleta, PedidoBanco, TipoPedido, VisaoBanco } from './tipos'

export interface EstadoBotao {
  habilitado: boolean
  motivo: string | null
}

const liberado: EstadoBotao = { habilitado: true, motivo: null }
const barrado = (motivo: string): EstadoBotao => ({ habilitado: false, motivo })

export const ROTULO_ESTADO_PEDIDO: Readonly<Record<PedidoBanco['estado'], string>> = {
  PENDENTE: 'Aguardando o apontador',
  ACEITO: 'Aceito',
  RECUSADO: 'Recusado',
  CANCELADO: 'Cancelado',
}

export const ROTULO_ESTADO_PAPELETA: Readonly<Record<EstadoPapeleta, string>> = {
  RASCUNHO: 'Rascunho (ainda não enviada)',
  ENVIADA: 'Enviada, aguardando o apontador',
  ACEITA: 'Aceita pelo apontador',
}

export function papeletaEditavel(estado: EstadoPapeleta | undefined): boolean {
  return estado === undefined || estado === 'RASCUNHO'
}

export function partidaEncerrada(status: string): boolean {
  return ['ENCERRADA', 'FINALIZADA', 'CANCELADA'].includes(String(status || '').toUpperCase())
}

export function botaoEnviarPapeleta(params: {
  estado: EstadoPapeleta | undefined
  pronta: boolean
  motivoPendencia: string | null
  enviando: boolean
  encerrada: boolean
  semConexao: boolean
}): EstadoBotao {
  if (params.encerrada) return barrado('A partida já terminou.')
  if (params.estado === 'ENVIADA') return barrado('A papeleta já foi enviada e não muda mais.')
  if (params.estado === 'ACEITA') return barrado('A papeleta já foi aceita pelo apontador.')
  if (params.enviando) return barrado('Enviando...')
  if (params.semConexao) return barrado('Sem conexão. Aguarde voltar para enviar.')
  if (!params.pronta) return barrado(params.motivoPendencia ?? 'Complete a formação para enviar.')
  return liberado
}

/** Pedidos que contam no limite do jogo (pendentes e aceitos). O servidor é quem decide de fato. */
export function usoDeLimites(pedidos: readonly PedidoBanco[]): { tempos: number; substituicoes: number } {
  const conta = (tipo: TipoPedido) => pedidos.filter((p) => p.tipo === tipo && (p.estado === 'PENDENTE' || p.estado === 'ACEITO')).length
  return { tempos: conta('TEMPO'), substituicoes: conta('SUBSTITUICAO') }
}

export function botaoPedido(params: {
  tipo: TipoPedido
  visao: Pick<VisaoBanco, 'pedidos' | 'limites' | 'partida'>
  enviando: boolean
  semConexao: boolean
}): EstadoBotao {
  const { tipo, visao } = params
  if (partidaEncerrada(visao.partida.status)) return barrado('A partida já terminou.')
  if (params.semConexao) return barrado('Sem conexão. Aguarde voltar para pedir.')
  if (params.enviando) return barrado('Enviando o pedido...')
  // O limite é por set e quem confere é o servidor (422 LIMITE_EXCEDIDO); a tela só barra pedido pendente repetido.
  const pendentes = visao.pedidos.filter((p) => p.estado === 'PENDENTE')
  if (pendentes.some((p) => p.tipo === tipo)) {
    return barrado(tipo === 'TEMPO' ? 'Já existe um pedido de tempo aguardando o apontador.' : 'Já existe um pedido de substituição aguardando o apontador.')
  }
  // Mesma interrupção: máx. 2 tempos e 1 substituição pendentes (RG-TMP-003), via motor.
  const v = validarPedidoNaInterrupcao(
    {
      tempos: pendentes.filter((p) => p.tipo === 'TEMPO').length,
      substituicoes: pendentes.filter((p) => p.tipo === 'SUBSTITUICAO').length,
      bloqueada: false,
    },
    { tipo },
  )
  if (!v.ok) return barrado(v.mensagem)
  return liberado
}

/** Botão "Pedir desafio": só com a flag ligada; o limite por set é conferido pelo servidor (422 LIMITE_EXCEDIDO). */
export function botaoDesafio(params: {
  ativo: boolean
  visao: Pick<VisaoBanco, 'pedidos' | 'partida'>
  enviando: boolean
  semConexao: boolean
}): EstadoBotao {
  if (!params.ativo) return barrado('Desafio de vídeo: fase posterior.')
  if (partidaEncerrada(params.visao.partida.status)) return barrado('A partida já terminou.')
  if (params.semConexao) return barrado('Sem conexão. Aguarde voltar para pedir.')
  if (params.enviando) return barrado('Enviando o pedido...')
  if (params.visao.pedidos.some((p) => p.estado === 'PENDENTE' && p.tipo === 'DESAFIO')) {
    return barrado('Já existe um pedido de desafio aguardando o apontador.')
  }
  return liberado
}

export function podeCancelarPedido(p: PedidoBanco): boolean {
  return p.estado === 'PENDENTE'
}

/** Validação do formulário de substituição: quem sai e quem entra. */
export function validarSubstituicaoLocal(sai: number | null, entra: number | null): string | null {
  if (sai === null) return 'Escolha quem sai.'
  if (entra === null) return 'Escolha quem entra.'
  if (sai === entra) return 'Quem sai e quem entra precisam ser jogadores diferentes.'
  return null
}
