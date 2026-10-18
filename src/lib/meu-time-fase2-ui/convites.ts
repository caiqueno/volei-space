import type { EstadoConvite } from './tipos'

const CONHECIDOS: EstadoConvite[] = ['ativo', 'usado', 'expirado', 'revogado', 'invalido']

/** Normaliza o estado vindo do servidor (qualquer caixa/gênero) para um dos nossos. */
export function normalizarEstado(valor: unknown): EstadoConvite {
  const texto = typeof valor === 'string' ? valor.trim().toLowerCase() : ''
  const mapa: Record<string, EstadoConvite> = {
    pendente: 'ativo',
    disponivel: 'ativo',
    indisponivel: 'invalido',
    valido: 'ativo',
    válido: 'ativo',
    aceito: 'usado',
    utilizado: 'usado',
    cancelado: 'revogado',
    inválido: 'invalido',
  }
  const direto = CONHECIDOS.find((e) => e === texto)
  return direto ?? mapa[texto] ?? 'invalido'
}

export const ROTULO_ESTADO: Record<EstadoConvite, string> = {
  ativo: 'Aguardando',
  usado: 'Já usado',
  expirado: 'Venceu',
  revogado: 'Cancelado',
  invalido: 'Inválido',
}

export const EXPLICACAO_PUBLICA: Record<Exclude<EstadoConvite, 'ativo'>, { titulo: string; texto: string }> = {
  expirado: { titulo: 'Este convite venceu', texto: 'O prazo acabou. Peça ao responsável pelo time um link novo.' },
  usado: { titulo: 'Este convite já foi usado', texto: 'Alguém já preencheu os dados por este link. Se foi engano, peça um link novo ao responsável pelo time.' },
  revogado: { titulo: 'Este convite foi cancelado', texto: 'O responsável pelo time cancelou este link. Peça um novo.' },
  invalido: { titulo: 'Não encontramos este convite', texto: 'O link pode estar incompleto. Confira se copiou tudo ou peça um novo ao responsável pelo time.' },
}

export function podeRevogar(estado: EstadoConvite): boolean {
  return estado === 'ativo'
}

export function linkWhatsApp(url: string, nomeEquipe?: string): string {
  const texto = `${nomeEquipe ? `Convite para entrar no time ${nomeEquipe}. ` : 'Convite para entrar no time. '}Preencha seus dados aqui: ${url}`
  return `https://wa.me/?text=${encodeURIComponent(texto)}`
}

export function formatarDataHora(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

/** Idade completa na data de referência; null se a data for inválida ou futura. */
export function idadeEm(dataIso: string, hoje: Date = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dataIso)
  if (!m) return null
  const [a, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const nasc = new Date(a, mes - 1, dia)
  if (nasc.getFullYear() !== a || nasc.getMonth() !== mes - 1 || nasc.getDate() !== dia || nasc > hoje || a < 1900) return null
  let idade = hoje.getFullYear() - a
  if (hoje.getMonth() < mes - 1 || (hoje.getMonth() === mes - 1 && hoje.getDate() < dia)) idade -= 1
  return idade
}

export function ehMenorDeIdade(dataIso: string, hoje: Date = new Date()): boolean {
  const i = idadeEm(dataIso, hoje)
  return i !== null && i < 18
}

export type ErrosForm = Partial<Record<'nome' | 'dataNascimento' | 'camisa' | 'ciencia', string>>

/** Aviso curto de tratamento de dados, mostrado ANTES do envio no convite público (LGPD). */
export const AVISO_DADOS_ATLETA = {
  titulo: 'Como usamos seus dados',
  itens: [
    'Finalidade: cadastrar você no time e nas competições de vôlei em que ele jogar.',
    'Quem vê: o responsável pelo time e os organizadores das competições em que o time se inscrever.',
    'Menores de 18 anos: entramos em contato com o responsável para pedir a autorização.',
    'Você pode pedir a exclusão dos seus dados quando quiser, falando com o responsável pelo time ou com o organizador.',
  ],
  ciencia: 'Li e estou ciente de como meus dados serão usados.',
} as const

export const MENSAGEM_CIENCIA = 'Marque que você leu o aviso de uso dos dados para enviar.'

/** Validação de conforto do formulário do atleta (o servidor valida de novo). */
export function validarFormAtleta(f: { nome: string; dataNascimento: string; camisa: string; ciente?: boolean }, hoje: Date = new Date()): ErrosForm {
  const erros: ErrosForm = {}
  if (f.ciente === false) erros.ciencia = MENSAGEM_CIENCIA
  if (f.nome.trim().length < 2) erros.nome = 'Escreva seu nome completo.'
  if (idadeEm(f.dataNascimento, hoje) === null) erros.dataNascimento = 'Informe uma data de nascimento válida.'
  if (f.camisa.trim() !== '') {
    const n = Number(f.camisa)
    if (!Number.isInteger(n) || n < 0 || n > 99) erros.camisa = 'O número da camisa vai de 0 a 99.'
  }
  return erros
}
