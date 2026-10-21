// Pedido de troca de atleta em inscrição já confirmada. O servidor decide pelo prazo da regra de elenco da categoria.

export type ModoTroca = 'livre' | 'pedir'

export type RegraBotaoTroca = {
  modo: ModoTroca
  rotuloBotao: string
  explicacao: string
}

function formatarPrazo(prazo: Date): string {
  const dia = String(prazo.getDate()).padStart(2, '0')
  const mes = String(prazo.getMonth() + 1).padStart(2, '0')
  const hora = String(prazo.getHours()).padStart(2, '0')
  const min = String(prazo.getMinutes()).padStart(2, '0')
  return `${dia}/${mes}/${prazo.getFullYear()} às ${hora}:${min}`
}

/**
 * Antes do prazo (ou sem prazo) a edição do elenco é livre. Depois do prazo o botão vira "Pedir troca".
 * `prazoTrocaEm` vem da regra de elenco da categoria; data inválida conta como sem prazo (o servidor segue valendo).
 */
export function regraBotaoTroca(prazoTrocaEm: string | null | undefined, agora: Date = new Date()): RegraBotaoTroca {
  const prazo = prazoTrocaEm ? new Date(prazoTrocaEm) : null
  if (!prazo || Number.isNaN(prazo.getTime())) {
    return { modo: 'livre', rotuloBotao: 'Trocar atleta', explicacao: 'Você pode trocar atletas livremente por enquanto.' }
  }
  if (agora.getTime() < prazo.getTime()) {
    return {
      modo: 'livre',
      rotuloBotao: 'Trocar atleta',
      explicacao: `Até ${formatarPrazo(prazo)} você troca atletas livremente. Depois disso, cada troca vira um pedido que o organizador analisa.`,
    }
  }
  return {
    modo: 'pedir',
    rotuloBotao: 'Pedir troca',
    explicacao: `O prazo de troca livre acabou em ${formatarPrazo(prazo)}. Agora a troca é um pedido que o organizador aprova ou recusa.`,
  }
}

export type EstadoPedido = 'PENDENTE' | 'APROVADO' | 'RECUSADO' | 'CANCELADO'

export type PedidoTroca = {
  id: string
  sai: { id: string; nome: string | null }
  entra: { id: string; nome: string | null }
  motivo: string | null
  estado: EstadoPedido
  motivoRecusa: string | null
}

export const ROTULO_ESTADO_PEDIDO: Record<EstadoPedido, string> = {
  PENDENTE: 'Aguardando',
  APROVADO: 'Aprovado',
  RECUSADO: 'Recusado',
  CANCELADO: 'Cancelado',
}

export function normalizarEstadoPedido(valor: unknown): EstadoPedido {
  const v = typeof valor === 'string' ? valor.trim().toUpperCase() : ''
  if (v === 'APROVADO' || v === 'APROVADA') return 'APROVADO'
  if (v === 'RECUSADO' || v === 'RECUSADA') return 'RECUSADO'
  if (v === 'CANCELADO' || v === 'CANCELADA') return 'CANCELADO'
  return 'PENDENTE'
}

function pessoa(valor: unknown): { id: string; nome: string | null } | null {
  if (typeof valor === 'string' && valor) return { id: valor, nome: null }
  if (valor && typeof valor === 'object') {
    const o = valor as Record<string, unknown>
    const id = typeof o.id === 'string' ? o.id : typeof o.atletaId === 'string' ? o.atletaId : ''
    if (id) return { id, nome: typeof o.nome === 'string' ? o.nome : null }
  }
  return null
}

/** Aceita a lista direta ou `{pedidos: [...]}`; descarta itens que não seguem o contrato. */
export function normalizarPedidos(dado: unknown): PedidoTroca[] {
  const lista = Array.isArray(dado) ? dado : dado && typeof dado === 'object' && Array.isArray((dado as { pedidos?: unknown }).pedidos) ? (dado as { pedidos: unknown[] }).pedidos : []
  const saida: PedidoTroca[] = []
  for (const item of lista) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const sai = pessoa(o.sai ?? o.atletaSai)
    const entra = pessoa(o.entra ?? o.atletaEntra)
    if (typeof o.id !== 'string' || !sai || !entra) continue
    saida.push({
      id: o.id,
      sai,
      entra,
      motivo: typeof o.motivo === 'string' && o.motivo.trim() ? o.motivo : null,
      estado: normalizarEstadoPedido(o.estado ?? o.status),
      motivoRecusa: typeof o.motivoRecusa === 'string' && o.motivoRecusa.trim() ? o.motivoRecusa : null,
    })
  }
  return saida
}

export function podeCancelarPedido(pedido: Pick<PedidoTroca, 'estado'>): boolean {
  return pedido.estado === 'PENDENTE'
}

/** Já existe pedido aguardando que envolva o atleta (sai ou entra)? Evita pedido repetido. */
export function atletaEmPedidoPendente(pedidos: PedidoTroca[], atletaId: string): boolean {
  return pedidos.some((p) => p.estado === 'PENDENTE' && (p.sai.id === atletaId || p.entra.id === atletaId))
}

export function validarPedidoTroca(entrada: { sai: string; entra: string; motivo: string }): { valido: boolean; erros: Partial<Record<'sai' | 'entra' | 'motivo', string>>; dados?: { sai: string; entra: string; motivo?: string } } {
  const erros: Partial<Record<'sai' | 'entra' | 'motivo', string>> = {}
  if (!entrada.sai) erros.sai = 'Escolha quem sai.'
  if (!entrada.entra) erros.entra = 'Escolha quem entra.'
  if (entrada.sai && entrada.sai === entrada.entra) erros.entra = 'Quem entra precisa ser outra pessoa.'
  const motivo = entrada.motivo.replace(/\s+/g, ' ').trim()
  if (motivo.length > 300) erros.motivo = 'O motivo pode ter até 300 letras.'
  if (Object.keys(erros).length > 0) return { valido: false, erros }
  const dados: { sai: string; entra: string; motivo?: string } = { sai: entrada.sai, entra: entrada.entra }
  if (motivo) dados.motivo = motivo
  return { valido: true, erros, dados }
}

/** Mensagens para os códigos que o servidor pode devolver ao pedir troca. */
export function mensagemFalhaTroca(status: number, codigo?: string): string {
  if (codigo === 'PRAZO_ABERTO' || codigo === 'TROCA_LIVRE') return 'Ainda dá para trocar direto, sem pedido. Edite o elenco normalmente.'
  if (codigo === 'PEDIDO_DUPLICADO') return 'Já existe um pedido aguardando para esses atletas.'
  if (status === 403) return 'Só o responsável ou o técnico do time pode pedir troca.'
  if (status === 404) return 'Não encontramos a inscrição ou o atleta. Atualize a página.'
  if (status === 409) return 'Esse pedido entra em conflito com o elenco atual. Confira os atletas.'
  return 'Não deu para enviar o pedido agora. Tente de novo.'
}
