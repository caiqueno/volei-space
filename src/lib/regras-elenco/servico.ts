// Regra de elenco por categoria (R17): leitura e gravação pelo organizador dono do campeonato.
// A inscrição lê a mesma linha ("RegraElenco") e valida no servidor (ver inscricao.ts / regras.ts).
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ErroMeuTime, idValido, violacaoUnica } from '@/lib/meu-time/acesso'
import { lerElenco } from '@/lib/meu-time/elenco'
import { MAXIMO_ATLETAS_POR_PEDIDO, inscricaoViva } from '@/lib/meu-time/regras'
import {
  DOCUMENTOS_REGRA,
  MODELOS_ELENCO,
  MODELOS_REGRA_ELENCO,
  type ValoresRegraElenco,
} from '@/lib/regras-elenco/modelos'

const db = supabaseAdmin as any

function dataReal(valor: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false
  const data = new Date(`${valor}T00:00:00Z`)
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === valor && valor >= '1900-01-01' && valor <= '2100-12-31'
}

const dia = z.string().trim().refine(dataReal, 'Use uma data real no formato AAAA-MM-DD.')

export const regraElencoSchema = z.object({
  modelo: z.enum(MODELOS_REGRA_ELENCO),
  atletasMin: z.number().int().min(1).max(MAXIMO_ATLETAS_POR_PEDIDO).nullable().optional(),
  atletasMax: z.number().int().min(1).max(MAXIMO_ATLETAS_POR_PEDIDO).nullable().optional(),
  liberosMax: z.number().int().min(0).max(6).optional(),
  nascimentoDe: dia.nullable().optional(),
  nascimentoAte: dia.nullable().optional(),
  documentosExigidos: z.array(z.enum(DOCUMENTOS_REGRA)).max(DOCUMENTOS_REGRA.length).optional(),
  comissaoMax: z.number().int().min(0).max(20).nullable().optional(),
  prazoTrocaEm: z.string().trim().datetime({ offset: true }).nullable().optional(),
  exigeConsentimentoMenor: z.boolean().optional(),
})

export type EntradaRegraElenco = z.infer<typeof regraElencoSchema>

export type RegraElencoLida = ValoresRegraElenco & {
  categoriaCampeonatoId: string
  /** false = a categoria ainda não tem regra gravada; os valores são os do modelo AMADOR_LIVRE. */
  configurada: boolean
  modelo: string
  atualizadoEm: string | null
}

const naoEncontrada = () => new ErroMeuTime('Categoria não encontrada.', 404, 'CATEGORIA_NAO_ENCONTRADA')

/** Categoria de campeonato do organizador. Categoria de outro organizador "não existe" (404). */
async function exigirCategoriaDoOrganizador(organizadorId: string, categoriaId: string) {
  if (!idValido(categoriaId)) throw naoEncontrada()
  const categoria = lerElenco(
    await db.from('CategoriaCampeonato').select('id,ligaId').eq('id', categoriaId).is('removidaEm', null).maybeSingle(),
    'categoria',
  ) as { id: string; ligaId: number } | null
  if (!categoria) throw naoEncontrada()
  const liga = lerElenco(
    await db.from('Liga').select('id,organizadorId,status').eq('id', categoria.ligaId).maybeSingle(),
    'campeonato da categoria',
  ) as { id: number; organizadorId: string | null; status: string | null } | null
  if (!liga || String(liga.organizadorId ?? '') !== organizadorId) throw naoEncontrada()
  return { categoria, liga }
}

function paraRegraLida(categoriaId: string, linha: any): RegraElencoLida {
  if (!linha) return { ...MODELOS_ELENCO.AMADOR_LIVRE.valores, categoriaCampeonatoId: categoriaId, configurada: false, modelo: 'AMADOR_LIVRE', atualizadoEm: null }
  return {
    categoriaCampeonatoId: categoriaId,
    configurada: true,
    modelo: linha.modelo ?? 'PERSONALIZADO',
    atletasMin: linha.atletasMin ?? null,
    atletasMax: linha.atletasMax ?? null,
    liberosMax: linha.liberosMax ?? 2,
    nascimentoDe: linha.nascimentoDe ? String(linha.nascimentoDe).slice(0, 10) : null,
    nascimentoAte: linha.nascimentoAte ? String(linha.nascimentoAte).slice(0, 10) : null,
    documentosExigidos: (Array.isArray(linha.documentosExigidos) ? linha.documentosExigidos : []).filter((item: string) =>
      (DOCUMENTOS_REGRA as readonly string[]).includes(item)),
    comissaoMax: linha.comissaoMax ?? null,
    prazoTrocaEm: linha.prazoTrocaEm ?? null,
    exigeConsentimentoMenor: linha.exigeConsentimentoMenor !== false,
    atualizadoEm: linha.atualizadoEm ?? null,
  }
}

export async function lerRegraDaCategoria(organizadorId: string, categoriaId: string) {
  const { categoria } = await exigirCategoriaDoOrganizador(organizadorId, categoriaId)
  const linha = lerElenco(
    await db.from('RegraElenco').select('*').eq('categoriaCampeonatoId', categoria.id).maybeSingle(),
    'regra de elenco',
  )
  return paraRegraLida(categoria.id, linha)
}

/** PUT = representação completa: o que for omitido assume o padrão do modelo escolhido; `null` explícito limpa o limite. */
export function resolverRegra(entrada: EntradaRegraElenco): ValoresRegraElenco {
  const base = MODELOS_ELENCO[entrada.modelo].valores
  const escolher = <K extends keyof ValoresRegraElenco>(chave: K): ValoresRegraElenco[K] => {
    const valor = (entrada as Record<string, unknown>)[chave]
    return (valor === undefined ? base[chave] : valor) as ValoresRegraElenco[K]
  }
  const regra: ValoresRegraElenco = {
    atletasMin: escolher('atletasMin'),
    atletasMax: escolher('atletasMax'),
    liberosMax: escolher('liberosMax'),
    nascimentoDe: escolher('nascimentoDe'),
    nascimentoAte: escolher('nascimentoAte'),
    documentosExigidos: Array.from(new Set(escolher('documentosExigidos'))),
    comissaoMax: escolher('comissaoMax'),
    prazoTrocaEm: escolher('prazoTrocaEm'),
    exigeConsentimentoMenor: escolher('exigeConsentimentoMenor'),
  }
  if (regra.atletasMin != null && regra.atletasMax != null && regra.atletasMin > regra.atletasMax) {
    throw new ErroMeuTime('O mínimo de atletas não pode ser maior que o máximo.', 422, 'DADOS_INVALIDOS')
  }
  if (regra.nascimentoDe && regra.nascimentoAte && regra.nascimentoDe > regra.nascimentoAte) {
    throw new ErroMeuTime('A data inicial de nascimento não pode ser depois da final.', 422, 'DADOS_INVALIDOS')
  }
  return regra
}

export async function gravarRegraDaCategoria(organizadorId: string, categoriaId: string, entrada: EntradaRegraElenco) {
  const { categoria, liga } = await exigirCategoriaDoOrganizador(organizadorId, categoriaId)
  if (String(liga.status ?? '').toUpperCase() === 'FINALIZADO') {
    throw new ErroMeuTime('Este campeonato está finalizado e disponível apenas para consulta.', 409, 'CAMPEONATO_FINALIZADO')
  }
  const regra = resolverRegra(entrada)
  const campos = { modelo: entrada.modelo, ...regra, atualizadoEm: new Date().toISOString() }

  const atualizar = async () =>
    lerElenco(
      await db.from('RegraElenco').update(campos).eq('categoriaCampeonatoId', categoria.id).select('categoriaCampeonatoId'),
      'atualizar regra de elenco',
    ) as Array<unknown> | null
  const existente = lerElenco(
    await db.from('RegraElenco').select('categoriaCampeonatoId').eq('categoriaCampeonatoId', categoria.id).maybeSingle(),
    'regra de elenco existente',
  )
  if (existente) {
    await atualizar()
  } else {
    const criada = await db.from('RegraElenco').insert({ categoriaCampeonatoId: categoria.id, ligaId: categoria.ligaId, ...campos }).select('categoriaCampeonatoId')
    if (violacaoUnica(criada.error)) await atualizar() // corrida com outra requisição do mesmo organizador
    else lerElenco(criada, 'criar regra de elenco')
  }
  return lerRegraDaCategoria(organizadorId, categoriaId)
}

/**
 * O que as regras de elenco das inscrições vivas da equipe exigem de cada atleta (união dos "documentosExigidos").
 * Alimenta o indicador de prontidão. Leitura tolerante: qualquer falha devolve lista vazia (não derruba a tela).
 */
export async function documentosExigidosDaEquipe(timeId: string): Promise<string[]> {
  try {
    const inscricoes = await db.from('Inscricao').select('categoriaCampeonatoId,status').eq('timeId', timeId)
    if (inscricoes.error) return []
    const categorias = Array.from(new Set(((inscricoes.data ?? []) as any[])
      .filter((item) => inscricaoViva(String(item.status)))
      .map((item) => String(item.categoriaCampeonatoId))))
    if (categorias.length === 0) return []
    const regras = await db.from('RegraElenco').select('documentosExigidos').in('categoriaCampeonatoId', categorias)
    if (regras.error) return []
    const uniao = new Set<string>()
    for (const regra of (regras.data ?? []) as any[]) {
      for (const item of Array.isArray(regra.documentosExigidos) ? regra.documentosExigidos : []) uniao.add(String(item))
    }
    return Array.from(uniao)
  } catch {
    return []
  }
}
