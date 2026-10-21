// Regras puras da tela "Competições" (explorar) do líder. Sem React, sem rede.
// Tudo atrás de NEXT_PUBLIC_EXPLORAR_COMPETICOES_ATIVO. Desligada = telas atuais idênticas.

export type NivelSelo = 'OK' | 'AVISO' | 'BLOQUEIO'
export type Modo = 'AUTOMATICA' | 'APROVACAO'

export type Selo = { nivel: NivelSelo; texto: string; detalhes: string[] }

export type Competicao = {
  ligaId: string
  categoriaId: string
  campeonato: string
  organizador: string
  categoria: string
  naipe: string
  cidade: string
  local: string
  inicio: string | null
  fim: string | null
  prazoInscricao: string | null
  vagasTotal: number | null
  vagasRestantes: number | null
  valorInscricao: number | null
  modo: Modo
  situacao: string
  selo: Selo | null
}

export type ListaCompeticoes = { itens: Competicao[]; total: number }

export type Filtros = {
  equipeId: string
  cidade: string
  de: string
  ate: string
  categoria: string
  naipe: string
  abertas: boolean
  q: string
  pagina: number
}

export const TAMANHO_PAGINA = 20
export const NAIPES = ['MASCULINO', 'FEMININO', 'MISTO'] as const
export const ROTULO_NAIPE: Readonly<Record<string, string>> = { MASCULINO: 'Masculino', FEMININO: 'Feminino', MISTO: 'Misto' }
export const HREF_COMPETICOES = '/meu-time/competicoes'
export const ROTULO_MODO: Readonly<Record<Modo, string>> = {
  AUTOMATICA: 'Inscrição automática',
  APROVACAO: 'Com aprovação do organizador',
}

// ---------------------------------------------------------------- flag

export function explorarCompeticoesAtivo(valor: string | undefined = process.env.NEXT_PUBLIC_EXPLORAR_COMPETICOES_ATIVO): boolean {
  return valor === '1'
}

// ---------------------------------------------------------------- filtros

export function filtrosVazios(): Filtros {
  return { equipeId: '', cidade: '', de: '', ate: '', categoria: '', naipe: '', abertas: true, q: '', pagina: 1 }
}

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/

export function dataValida(v: string): boolean {
  if (!DATA_ISO.test(v)) return false
  const d = new Date(`${v}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v
}

/** Mensagem quando o período está invertido ou uma data é inválida; null se estiver certo. */
export function erroDoPeriodo(f: Pick<Filtros, 'de' | 'ate'>): string | null {
  if (f.de && !dataValida(f.de)) return 'A data inicial não é válida.'
  if (f.ate && !dataValida(f.ate)) return 'A data final não é válida.'
  if (f.de && f.ate && f.ate < f.de) return 'A data final precisa ser depois da inicial.'
  return null
}

/** Monta a querystring só com o que foi preenchido. Período inválido é ignorado (o servidor também valida). */
export function montarQuerystring(f: Filtros): string {
  const p = new URLSearchParams()
  const put = (k: string, v: string) => {
    const t = v.trim()
    if (t) p.set(k, t)
  }
  put('equipeId', f.equipeId)
  put('cidade', f.cidade)
  if (f.de && dataValida(f.de)) p.set('de', f.de)
  if (f.ate && dataValida(f.ate)) p.set('ate', f.ate)
  put('categoria', f.categoria)
  if ((NAIPES as readonly string[]).includes(f.naipe)) p.set('naipe', f.naipe)
  if (f.abertas) p.set('abertas', '1')
  put('q', f.q.slice(0, 80))
  const pagina = Number.isInteger(f.pagina) && f.pagina > 1 ? f.pagina : 1
  if (pagina > 1) p.set('pagina', String(pagina))
  return p.toString()
}

export function urlListagem(f: Filtros): string {
  const qs = montarQuerystring(f)
  return `/api/meu-time/competicoes${qs ? `?${qs}` : ''}`
}

/** Quantos filtros (fora o time) estão ligados; serve para o rótulo "Filtros (2)". */
export function contarFiltrosAtivos(f: Filtros): number {
  return [f.cidade.trim(), f.de, f.ate, f.categoria.trim(), f.naipe, f.abertas ? '1' : ''].filter(Boolean).length
}

/** Mudar qualquer filtro volta para a primeira página. */
export function aplicarFiltro(f: Filtros, mudanca: Partial<Omit<Filtros, 'pagina'>>): Filtros {
  return { ...f, ...mudanca, pagina: 1 }
}

export function totalPaginas(total: number, tamanho = TAMANHO_PAGINA): number {
  return total > 0 ? Math.ceil(total / tamanho) : 1
}

export function textoPagina(pagina: number, total: number, tamanho = TAMANHO_PAGINA): string {
  return `Página ${pagina} de ${totalPaginas(total, tamanho)}`
}

export function textoTotal(total: number): string {
  return total === 1 ? '1 competição encontrada' : `${total} competições encontradas`
}

// ---------------------------------------------------------------- selo de elegibilidade

export type VisualSelo = { icone: string; rotulo: string; classe: string; leitor: string }

const SELOS: Readonly<Record<NivelSelo, VisualSelo>> = {
  OK: { icone: '✅', rotulo: 'Pode participar', classe: 'is-success', leitor: 'Seu time pode participar' },
  AVISO: { icone: '⚠️', rotulo: 'Participa com atenção', classe: 'is-warning', leitor: 'Atenção antes de participar' },
  BLOQUEIO: { icone: '⛔', rotulo: 'Não pode participar', classe: 'is-error', leitor: 'Seu time não pode participar' },
}

export function visualDoSelo(nivel: NivelSelo): VisualSelo {
  return SELOS[nivel]
}

/** O texto do servidor vence; sem ele usa o rótulo padrão do nível. */
export function textoDoSelo(selo: Selo): string {
  return selo.texto.trim() || SELOS[selo.nivel].rotulo
}

/** Bloqueio desliga o botão; o servidor decide de verdade ao receber o pedido. */
export function podeParticipar(c: Pick<Competicao, 'selo' | 'situacao'>): boolean {
  if (c.selo?.nivel === 'BLOQUEIO') return false
  return !['ENCERRADA', 'INSCRITA', 'PENDENTE'].includes(c.situacao)
}

export function motivoSemParticipar(c: Pick<Competicao, 'selo' | 'situacao'>): string | null {
  if (c.situacao === 'INSCRITA') return 'Seu time já está nesta categoria.'
  if (c.situacao === 'PENDENTE') return 'Seu pedido está com o organizador.'
  if (c.situacao === 'ENCERRADA') return 'As inscrições estão encerradas.'
  if (c.selo?.nivel === 'BLOQUEIO') return 'Veja o motivo no selo acima.'
  return null
}

// ---------------------------------------------------------------- prazo, vagas, valor, datas

const DIA_MS = 86_400_000

/** "Faltam 3 dias", "Último dia", "Encerrado". Conta por dia de calendário local. */
export function prazoRestante(prazo: string | null | undefined, agora: Date = new Date()): string | null {
  if (!prazo) return null
  const alvo = new Date(prazo)
  if (Number.isNaN(alvo.getTime())) return null
  const dia = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  const dias = Math.round((dia(alvo) - dia(agora)) / DIA_MS)
  if (dias < 0) return 'Inscrições encerradas'
  if (dias === 0) return 'Último dia para se inscrever'
  if (dias === 1) return 'Falta 1 dia'
  return `Faltam ${dias} dias`
}

export function prazoUrgente(prazo: string | null | undefined, agora: Date = new Date()): boolean {
  const t = prazoRestante(prazo, agora)
  return t === 'Último dia para se inscrever' || t === 'Falta 1 dia' || t === 'Faltam 2 dias' || t === 'Faltam 3 dias'
}

export function textoValor(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return 'Valor a combinar'
  if (valor <= 0) return 'Gratuito'
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export type Vagas = { texto: string; percentualOcupado: number | null; esgotada: boolean }

export function vagasDe(restantes: number | null, total: number | null): Vagas {
  if (restantes === null || total === null || total <= 0) {
    return { texto: restantes !== null ? (restantes === 1 ? '1 vaga restante' : `${restantes} vagas restantes`) : 'Vagas sem limite', percentualOcupado: null, esgotada: restantes === 0 }
  }
  const livres = Math.min(Math.max(restantes, 0), total)
  const ocupado = Math.round(((total - livres) / total) * 100)
  if (livres === 0) return { texto: `Vagas esgotadas (${total} de ${total})`, percentualOcupado: 100, esgotada: true }
  return { texto: `${livres} ${livres === 1 ? 'vaga restante' : 'vagas restantes'} de ${total}`, percentualOcupado: ocupado, esgotada: false }
}

function dataCurta(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ''
}

export function textoPeriodo(inicio: string | null, fim: string | null): string {
  const a = inicio ? dataCurta(inicio) : ''
  const b = fim ? dataCurta(fim) : ''
  if (a && b && a !== b) return `${a} a ${b}`
  return a || b || 'Datas a definir'
}

export function rotuloNaipe(naipe: string): string {
  return ROTULO_NAIPE[naipe.toUpperCase()] ?? naipe
}

/** Link da inscrição que já existe; a categoria abre a confirmação lá. */
export function hrefParticipar(categoriaId: string): string {
  return `/meu-time/campeonatos?categoria=${encodeURIComponent(categoriaId)}`
}

export const HREF_CRIAR_TIME = '/meu-time/novo'

// ---------------------------------------------------------------- navegação

/** A aba Competições fica acesa na tela de explorar e na inscrição que ela abre. */
export function caminhoEhCompeticoes(caminho: string): boolean {
  return [HREF_COMPETICOES, '/meu-time/campeonatos'].some((h) => caminho === h || caminho.startsWith(`${h}/`))
}

export function caminhoEhExplorar(caminho: string): boolean {
  return caminho === HREF_COMPETICOES || caminho.startsWith(`${HREF_COMPETICOES}/`)
}

/** Para onde o item "Competições" aponta. Flag desligada = destino de sempre. */
export function destinoCompeticoes(padrao: string, ativo: boolean): string {
  return ativo ? HREF_COMPETICOES : padrao
}

/** Sem filtros úteis ou com eles, o vazio diz o que fazer. */
export function textoVazio(f: Filtros): { titulo: string; dica: string; limpar: boolean } {
  const filtrando = contarFiltrosAtivos(f) > 0 || f.q.trim() !== ''
  if (filtrando) {
    return {
      titulo: 'Nenhuma competição com esses filtros',
      dica: f.abertas ? 'Tente tirar "só inscrições abertas", ampliar o período ou buscar em outra cidade.' : 'Tente ampliar o período ou buscar em outra cidade.',
      limpar: true,
    }
  }
  return { titulo: 'Nenhuma competição por enquanto', dica: 'Quando um organizador abrir inscrições, ela aparece aqui. Volte em breve.', limpar: false }
}

// ---------------------------------------------------------------- normalização

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {})
const txt = (v: unknown): string => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '')
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const data = (v: unknown): string | null => (typeof v === 'string' && v.trim() && !Number.isNaN(new Date(v).getTime()) ? v.trim() : null)

export function normalizarSelo(bruto: unknown): Selo | null {
  const o = obj(bruto)
  const nivel = o.nivel === 'OK' || o.nivel === 'AVISO' || o.nivel === 'BLOQUEIO' ? o.nivel : null
  if (!nivel) return null
  const detalhes = Array.isArray(o.detalhes) ? o.detalhes.filter((d): d is string => typeof d === 'string' && d.trim() !== '') : []
  return { nivel, texto: txt(o.texto), detalhes }
}

export function normalizarCompeticoes(dado: unknown): ListaCompeticoes {
  const o = obj(dado)
  const itens = (Array.isArray(o.itens) ? o.itens : [])
    .map((i): Competicao => {
      const c = obj(i)
      return {
        ligaId: txt(c.ligaId),
        categoriaId: txt(c.categoriaId),
        campeonato: txt(c.campeonato),
        organizador: txt(c.organizador),
        categoria: txt(c.categoria),
        naipe: txt(c.naipe),
        cidade: txt(c.cidade),
        local: txt(c.local),
        inicio: data(c.inicio),
        fim: data(c.fim),
        prazoInscricao: data(c.prazoInscricao),
        vagasTotal: num(c.vagasTotal),
        vagasRestantes: num(c.vagasRestantes),
        valorInscricao: num(c.valorInscricao),
        modo: c.modo === 'AUTOMATICA' ? 'AUTOMATICA' : 'APROVACAO',
        situacao: txt(c.situacao) || 'DISPONIVEL',
        selo: normalizarSelo(c.selo),
      }
    })
    .filter((c) => c.categoriaId !== '')
  const total = num(o.total)
  return { itens, total: total !== null && total >= itens.length ? Math.trunc(total) : itens.length }
}
