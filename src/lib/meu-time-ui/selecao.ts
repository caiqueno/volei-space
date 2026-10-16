// Regras de tela do passo "escolher atletas" da inscrição. O servidor valida tudo de novo.
import type { Atleta, AtletaInscricao, NovaInscricao } from './tipos'

export type RegrasInscricao = {
  minimo: number
  maximo: number
  maxLiberos: number
  /** Ano de nascimento permitido (inclusive). Quando ausente, a categoria não limita idade. */
  anoMinimo?: number
  anoMaximo?: number
}

export const REGRAS_PADRAO: RegrasInscricao = { minimo: 6, maximo: 14, maxLiberos: 2 }

export type Escolha = { atletaId: string; numero: string; capitao: boolean; libero: boolean }

export type Problema = { mensagem: string; atletaId?: string }

const CAMISA_MAXIMA = 99

function inteiroPositivo(valor: string | null | undefined): number | null {
  if (valor == null || !/^\d{1,3}$/.test(valor.trim())) return null
  const n = Number(valor)
  return n > 0 ? n : null
}

/** Lê os limites da categoria dos parâmetros da URL (`min`, `max`, `liberos`, `anoMin`, `anoMax`); usa o padrão se faltar. */
export function lerRegras(obter: (chave: string) => string | null | undefined): RegrasInscricao {
  const minimo = inteiroPositivo(obter('min')) ?? REGRAS_PADRAO.minimo
  const maximo = Math.max(minimo, inteiroPositivo(obter('max')) ?? REGRAS_PADRAO.maximo)
  const liberosBruto = obter('liberos')
  const maxLiberos = liberosBruto != null && /^\d$/.test(liberosBruto) ? Number(liberosBruto) : REGRAS_PADRAO.maxLiberos
  const ano = (valor: string | null | undefined) => (valor != null && /^\d{4}$/.test(valor) ? Number(valor) : undefined)
  return { minimo, maximo, maxLiberos, anoMinimo: ano(obter('anoMin')), anoMaximo: ano(obter('anoMax')) }
}

export function anoDeNascimento(data: string | null | undefined): number | null {
  const m = typeof data === 'string' ? data.match(/^(\d{4})-(\d{2})-(\d{2})/) : null
  if (!m) return null
  const ano = Number(m[1])
  return ano >= 1900 ? ano : null
}

/** Data digitada no formato AAAA-MM-DD, real, do passado. */
export function dataNascimentoValida(data: string, hoje: Date = new Date()): boolean {
  const m = data.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return false
  const [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const d = new Date(Date.UTC(ano, mes - 1, dia))
  if (d.getUTCFullYear() !== ano || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return false
  return ano >= 1900 && d.getTime() <= hoje.getTime()
}

export type Elegibilidade =
  | { elegivel: true }
  | { elegivel: false; tipo: 'aviso' | 'bloqueio'; motivo: string }

export function avaliarElegibilidade(atleta: Pick<Atleta, 'nome' | 'dataNascimento'>, regras: RegrasInscricao): Elegibilidade {
  const { anoMinimo, anoMaximo } = regras
  if (anoMinimo == null && anoMaximo == null) return { elegivel: true }
  const ano = anoDeNascimento(atleta.dataNascimento)
  if (ano == null) {
    return {
      elegivel: false,
      tipo: 'aviso',
      motivo: `Falta a data de nascimento de ${atleta.nome}. Sem ela não dá para saber se pode jogar nesta categoria.`,
    }
  }
  const dentro = (anoMinimo == null || ano >= anoMinimo) && (anoMaximo == null || ano <= anoMaximo)
  if (dentro) return { elegivel: true }
  const faixa = anoMinimo != null && anoMaximo != null ? `de ${anoMinimo} a ${anoMaximo}` : anoMinimo != null ? `a partir de ${anoMinimo}` : `até ${anoMaximo}`
  return {
    elegivel: false,
    tipo: 'aviso',
    motivo: `${atleta.nome} nasceu em ${ano}. Nesta categoria só podem jogar atletas nascidos ${faixa}. Escolha outro atleta ou fale com o organizador.`,
  }
}

export function podeSelecionar(elegibilidade: Elegibilidade, incluirMesmoAssim: boolean) {
  if (elegibilidade.elegivel) return true
  return elegibilidade.tipo === 'aviso' && incluirMesmoAssim
}

export function numeroSugerido(atleta: Pick<Atleta, 'numeroPreferido'>, escolhas: Escolha[]): string {
  const preferido = atleta.numeroPreferido
  if (preferido == null || preferido < 1 || preferido > CAMISA_MAXIMA) return ''
  return escolhas.some((e) => e.numero === String(preferido)) ? '' : String(preferido)
}

export function alternarAtleta(escolhas: Escolha[], atleta: Pick<Atleta, 'id' | 'numeroPreferido'>): Escolha[] {
  if (escolhas.some((e) => e.atletaId === atleta.id)) return escolhas.filter((e) => e.atletaId !== atleta.id)
  return [...escolhas, { atletaId: atleta.id, numero: numeroSugerido(atleta, escolhas), capitao: false, libero: false }]
}

export function definirNumero(escolhas: Escolha[], atletaId: string, numero: string): Escolha[] {
  const limpo = numero.replace(/\D/g, '').slice(0, 2)
  return escolhas.map((e) => (e.atletaId === atletaId ? { ...e, numero: limpo } : e))
}

/** Só um capitão por time: marcar um desmarca o anterior. Tocar de novo desmarca. */
export function definirCapitao(escolhas: Escolha[], atletaId: string): Escolha[] {
  const jaEra = escolhas.find((e) => e.atletaId === atletaId)?.capitao === true
  return escolhas.map((e) => ({ ...e, capitao: e.atletaId === atletaId ? !jaEra : false }))
}

export function definirLibero(escolhas: Escolha[], atletaId: string): Escolha[] {
  return escolhas.map((e) => (e.atletaId === atletaId ? { ...e, libero: !e.libero } : e))
}

export type ResumoSelecao = { selecionados: number; liberos: number; texto: string; situacao: 'abaixo' | 'ok' | 'acima' }

/** Texto do contador fixo: "10 selecionados · mínimo 6 · máximo 14 · líberos 1 de 2". */
export function resumirSelecao(escolhas: Escolha[], regras: RegrasInscricao): ResumoSelecao {
  const selecionados = escolhas.length
  const liberos = escolhas.filter((e) => e.libero).length
  const situacao = selecionados > regras.maximo || liberos > regras.maxLiberos ? 'acima' : selecionados < regras.minimo ? 'abaixo' : 'ok'
  const rotulo = selecionados === 1 ? 'selecionado' : 'selecionados'
  const texto = `${selecionados} ${rotulo} · mínimo ${regras.minimo} · máximo ${regras.maximo} · líberos ${liberos} de ${regras.maxLiberos}`
  return { selecionados, liberos, texto, situacao }
}

function plural(n: number, singular: string, pluralTexto: string) {
  return n === 1 ? singular : pluralTexto
}

/** Problemas que impedem o envio (o servidor também recusa). Cada um diz o motivo e o que fazer. */
export function problemasDeEnvio(escolhas: Escolha[], atletas: Atleta[], regras: RegrasInscricao): Problema[] {
  const problemas: Problema[] = []
  const nomePor = new Map(atletas.map((a) => [a.id, a.nome]))
  const nome = (id: string) => nomePor.get(id) ?? 'Atleta'
  const n = escolhas.length

  if (n < regras.minimo) {
    const falta = regras.minimo - n
    problemas.push({ mensagem: `Faltam ${falta} ${plural(falta, 'atleta', 'atletas')}. Esta categoria precisa de pelo menos ${regras.minimo}.` })
  }
  if (n > regras.maximo) {
    const sobra = n - regras.maximo
    problemas.push({ mensagem: `Você marcou ${n}. O máximo é ${regras.maximo}. Desmarque ${sobra}.` })
  }
  const liberos = escolhas.filter((e) => e.libero).length
  if (liberos > regras.maxLiberos) {
    problemas.push({ mensagem: `Você marcou ${liberos} líberos. Esta categoria aceita ${regras.maxLiberos}.` })
  }

  const donos = new Map<string, string>()
  for (const e of escolhas) {
    const numero = inteiroPositivo(e.numero)
    if (numero == null || numero > CAMISA_MAXIMA) {
      problemas.push({ atletaId: e.atletaId, mensagem: `Falta a camisa de ${nome(e.atletaId)}. Use um número de 1 a ${CAMISA_MAXIMA}.` })
      continue
    }
    const chave = String(numero)
    const dono = donos.get(chave)
    if (dono) {
      problemas.push({ atletaId: e.atletaId, mensagem: `A camisa ${chave} já está com ${nome(dono)}. Escolha outro número para ${nome(e.atletaId)}.` })
    } else {
      donos.set(chave, e.atletaId)
    }
    if (e.libero && e.capitao) {
      problemas.push({ atletaId: e.atletaId, mensagem: `${nome(e.atletaId)} é líbero e não pode ser capitão. Escolha outra pessoa para capitão.` })
    }
  }
  return problemas
}

/** Avisos que não impedem o envio. */
export function avisosDeEnvio(escolhas: Escolha[], atletas: Atleta[], regras: RegrasInscricao): string[] {
  const avisos: string[] = []
  if (escolhas.length > 0 && !escolhas.some((e) => e.capitao)) {
    avisos.push('Nenhum capitão escolhido. Você pode enviar assim e definir depois.')
  }
  const porId = new Map(atletas.map((a) => [a.id, a]))
  for (const e of escolhas) {
    const atleta = porId.get(e.atletaId)
    if (!atleta) continue
    const elegibilidade = avaliarElegibilidade(atleta, regras)
    if (!elegibilidade.elegivel) avisos.push(elegibilidade.motivo)
  }
  return avisos
}

export function montarInscricao(categoriaCampeonatoId: string, escolhas: Escolha[], comissao: string[]): NovaInscricao {
  const atletas: AtletaInscricao[] = escolhas.map((e) => {
    const item: AtletaInscricao = { atletaId: e.atletaId, numero: Number(e.numero) }
    if (e.capitao) item.capitao = true
    if (e.libero) item.libero = true
    return item
  })
  return { categoriaCampeonatoId, atletas, ...(comissao.length ? { comissao } : {}) }
}
