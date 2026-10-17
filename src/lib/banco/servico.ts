/**
 * Casos de uso do app de banco e da papeleta. As rotas só autenticam e chamam estas funções.
 * Toda regra (motor de regras, limites, imutabilidade, isolamento por equipe) é validada aqui, no servidor.
 */
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { success } from '@/lib/api-response'
import {
  conferir,
  lerElenco,
  lerNomeEquipe,
  lerSets,
  limitesDaPartida,
  papeletaPublica,
  pedidoPublico,
  MAX_SET,
  STATUS_PARTIDA_ENCERRADA,
  perfilDaPartidaBanco,
  setAtualDaPartida,
  setJaIniciado,
  usoDoLogDaSumula,
  type PartidaBanco,
} from './dados'
import { hashConteudo, respostaErro, violacaoDeUnicidade } from './base'
import { avisosDaPapeleta, formacaoOrdenada, validarPapeletaDoBanco, type EntradaPapeleta } from './papeleta-validacao'
import { usoDoSet, validarPedidoDoBanco } from './pedidos-validacao'
import { rejectIfCampeonatoFinalizado } from '@/lib/championship-finalization'
import {
  MAX_LINK_VIDEO,
  MAX_MOTIVO,
  MENSAGEM_DESAFIO_INDISPONIVEL,
  MENSAGEM_LIMITE_DESAFIOS,
  criarDesafio,
  desafioAtivo,
  desafioPublico,
  normalizarMotivo,
  situacaoDoLimite,
  validarLinkVideo,
} from '@/lib/desafio'

const db = supabaseAdmin as any

// ---------------------------------------------------------------------------
// Entradas
// ---------------------------------------------------------------------------

export const papeletaSchema = z.object({
  formacao: z.array(z.object({ posicao: z.number().int(), jogadorId: z.number().int().positive() })).length(6),
  liberoId: z.number().int().positive().nullish(),
  /** Segundo líbero: validado, mas ainda não gravado (a tabela só tem liberoId; coluna em migration futura). */
  libero2Id: z.number().int().positive().nullish(),
  capitaoId: z.number().int().positive().nullish(),
})

export const pedidoSchema = z.object({
  tipo: z.enum(['TEMPO', 'SUBSTITUICAO', 'DESAFIO']),
  sai: z.number().int().positive().optional(),
  entra: z.number().int().positive().optional(),
  /** Só para DESAFIO (R11). */
  motivo: z.string().max(MAX_MOTIVO).nullish(),
  linkVideo: z.string().max(MAX_LINK_VIDEO).nullish(),
})

export const decisaoSchema = z.object({ decisao: z.enum(['ACEITO', 'RECUSADO']) })

export async function lerCorpo(req: Request): Promise<unknown | null> {
  try {
    return await req.json()
  } catch {
    return null
  }
}

export function numeroDoSet(valor: string): number | null {
  if (!/^\d+$/.test(valor)) return null
  const n = Number(valor)
  return n >= 1 && n <= MAX_SET ? n : null
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Id uuid (PedidoBanco.id, BancoAcesso.id, DesafioVideo.id). Malformado = null (a rota responde 404, nunca 500 por 22P02). */
export function idUuid(valor: string): string | null {
  return UUID.test(valor) ? valor.toLowerCase() : null
}

export const idDeRecurso = idUuid

function corpoInvalido(e: z.ZodError) {
  return respostaErro('Dados inválidos.', 400, 'DADOS_INVALIDOS', { details: e.flatten().fieldErrors })
}

// ---------------------------------------------------------------------------
// Leituras
// ---------------------------------------------------------------------------

async function lerPapeleta(partidaId: number, equipeId: number, setNumero: number) {
  return conferir(
    await db.from('Papeleta').select('*').eq('partidaId', partidaId).eq('equipeId', equipeId).eq('setNumero', setNumero).maybeSingle(),
  ) as any
}

export async function visaoDoBanco(partida: PartidaBanco, equipeId: number) {
  const [a, b, equipe, sets, elenco, limites] = await Promise.all([
    lerNomeEquipe(partida.equipeAId),
    lerNomeEquipe(partida.equipeBId),
    lerNomeEquipe(equipeId),
    lerSets(partida.id),
    lerElenco(partida.id, equipeId),
    limitesDaPartida(partida),
  ])
  const setEmDisputa = await setAtualDaPartida(partida, sets)
  const papeletas = conferir(await db.from('Papeleta').select('*').eq('partidaId', partida.id).eq('equipeId', equipeId)) as any[]
  const pedidos = conferir(await db.from('PedidoBanco').select('*').eq('partidaId', partida.id).eq('equipeId', equipeId)) as any[]
  return {
    partida: {
      id: partida.id,
      equipeA: a,
      equipeB: b,
      status: partida.status,
      placar: {
        setsA: partida.setsPorA ?? 0,
        setsB: partida.setsPorB ?? 0,
        sets: sets.sort((x, y) => x.numero - y.numero),
      },
      setAtual: setEmDisputa,
    },
    equipe,
    elenco,
    papeletas: (papeletas ?? []).map(papeletaPublica).sort((x, y) => x.setNumero - y.setNumero),
    pedidos: (pedidos ?? [])
      .map(pedidoPublico)
      .sort((x, y) => String(y.criadoEm ?? '').localeCompare(String(x.criadoEm ?? ''))),
    limites,
  }
}

// ---------------------------------------------------------------------------
// Papeleta (lado do banco)
// ---------------------------------------------------------------------------

async function conferirEditavel(partida: PartidaBanco, setNumero: number) {
  const sets = await lerSets(partida.id)
  if (setJaIniciado(partida, sets, setNumero)) {
    return respostaErro('O set já começou: a papeleta só pode ser editada até o início dele.', 409, 'SET_INICIADO')
  }
  return null
}

const travada = () => respostaErro('A papeleta já foi enviada e não pode mais ser alterada.', 409, 'PAPELETA_TRAVADA')

export async function salvarRascunho(partida: PartidaBanco, equipeId: number, setNumero: number, corpo: unknown) {
  const lido = papeletaSchema.safeParse(corpo)
  if (!lido.success) return corpoInvalido(lido.error)
  const entrada: EntradaPapeleta = lido.data

  const existente = await lerPapeleta(partida.id, equipeId, setNumero)
  if (existente && existente.estado !== 'RASCUNHO') return travada()
  const fechado = await conferirEditavel(partida, setNumero)
  if (fechado) return fechado

  const elenco = await lerElenco(partida.id, equipeId)
  const violacoes = validarPapeletaDoBanco(entrada, elenco, { perfil: await perfilDaPartidaBanco(partida) })
  if (violacoes.length > 0) {
    return respostaErro('A papeleta tem violações das regras do vôlei.', 422, 'PAPELETA_INVALIDA', { violacoes })
  }
  const avisos = avisosDoRascunho(entrada)

  const valores = {
    formacao: formacaoOrdenada(entrada.formacao),
    liberoId: entrada.liberoId ?? null,
    capitaoId: entrada.capitaoId ?? null,
    estado: 'RASCUNHO',
  }
  if (existente) {
    const linhas = conferir(await db.from('Papeleta').update(valores).eq('id', existente.id).eq('estado', 'RASCUNHO').select()) as any[]
    if (!linhas || linhas.length === 0) return travada()
    return success({ papeleta: papeletaPublica(linhas[0]), violacoes: [], avisos })
  }
  const criada = await db.from('Papeleta').insert({ partidaId: partida.id, equipeId, setNumero, ...valores }).select().maybeSingle()
  if (criada.error) {
    if (violacaoDeUnicidade(criada.error)) {
      return respostaErro('A papeleta foi alterada ao mesmo tempo. Recarregue e tente de novo.', 409, 'CONFLITO')
    }
    conferir(criada)
  }
  return success({ papeleta: papeletaPublica(criada.data ?? { setNumero, ...valores }), violacoes: [], avisos }, 200)
}

/** Avisos que não bloqueiam: capitão fora dos titulares e segundo líbero ainda não gravado. */
function avisosDoRascunho(entrada: EntradaPapeleta) {
  const avisos = avisosDaPapeleta(entrada)
  if (entrada.libero2Id != null) {
    avisos.push({
      codigo: 'LIBERO2_NAO_PERSISTIDO',
      mensagem: 'O segundo líbero foi conferido, mas ainda não é gravado na papeleta; informe-o ao apontador.',
      categoria: 'ELENCO',
    })
  }
  return avisos
}

export async function enviarPapeleta(partida: PartidaBanco, equipeId: number, setNumero: number) {
  const existente = await lerPapeleta(partida.id, equipeId, setNumero)
  if (!existente) return respostaErro('Salve a papeleta antes de enviar.', 404, 'PAPELETA_INEXISTENTE')
  // Reenvio da mesma papeleta já enviada é idempotente.
  if (existente.estado !== 'RASCUNHO') return success({ papeleta: papeletaPublica(existente) })
  const fechado = await conferirEditavel(partida, setNumero)
  if (fechado) return fechado

  const elenco = await lerElenco(partida.id, equipeId)
  const entrada: EntradaPapeleta = {
    formacao: Array.isArray(existente.formacao) ? existente.formacao : [],
    liberoId: existente.liberoId ?? null,
    capitaoId: existente.capitaoId ?? null,
  }
  const violacoes = validarPapeletaDoBanco(entrada, elenco, { perfil: await perfilDaPartidaBanco(partida) })
  if (violacoes.length > 0) {
    return respostaErro('A papeleta tem violações das regras do vôlei e não pode ser enviada.', 422, 'PAPELETA_INVALIDA', { violacoes })
  }
  const conteudoHash = hashConteudo({
    p: partida.id,
    e: equipeId,
    s: setNumero,
    f: formacaoOrdenada(entrada.formacao),
    l: entrada.liberoId ?? null,
    c: entrada.capitaoId ?? null,
  })
  const linhas = conferir(
    await db
      .from('Papeleta')
      .update({ estado: 'ENVIADA', enviadaEm: new Date().toISOString(), conteudoHash })
      .eq('id', existente.id)
      .eq('estado', 'RASCUNHO')
      .select(),
  ) as any[]
  if (!linhas || linhas.length === 0) {
    const atual = await lerPapeleta(partida.id, equipeId, setNumero)
    return atual && atual.estado !== 'RASCUNHO' ? success({ papeleta: papeletaPublica(atual) }) : travada()
  }
  return success({ papeleta: papeletaPublica(linhas[0]) })
}

// ---------------------------------------------------------------------------
// Pedidos (lado do banco)
// ---------------------------------------------------------------------------

const desafioIndisponivel = () => respostaErro(MENSAGEM_DESAFIO_INDISPONIVEL, 503, 'DESAFIO_INDISPONIVEL')

/** Pedido de desafio de vídeo do banco: fica PENDENTE; o desafio só nasce quando o apontador aceitar. */
async function criarPedidoDesafio(partida: PartidaBanco, equipeId: number, dados: z.infer<typeof pedidoSchema>) {
  const link = validarLinkVideo(dados.linkVideo)
  if (!link.ok) return respostaErro(link.mensagem, 400, 'DADOS_INVALIDOS')
  const motivo = normalizarMotivo(dados.motivo)
  const setNumero = await setAtualDaPartida(partida, await lerSets(partida.id))

  const pedidos = conferir(await db.from('PedidoBanco').select('*').eq('partidaId', partida.id).eq('equipeId', equipeId)) as any[]
  const pendente = (pedidos ?? []).some((p) => p.tipo === 'DESAFIO' && p.estado === 'PENDENTE' && Number(p.payload?.setNumero) === setNumero)
  if (pendente) return respostaErro('Já existe um pedido de desafio pendente neste set.', 409, 'DESAFIO_PENDENTE')

  const situacao = await situacaoDoLimite(db, partida.id, equipeId, setNumero)
  if (situacao.tipo === 'INDISPONIVEL') return desafioIndisponivel()
  if (situacao.tipo === 'ERRO') throw new Error('erro ao ler os desafios')
  if (situacao.tipo === 'EXCEDIDO') return respostaErro(MENSAGEM_LIMITE_DESAFIOS(situacao.limite), 422, 'LIMITE_EXCEDIDO')

  const payload = { setNumero, ...(motivo ? { motivo } : {}), ...(link.valor ? { linkVideo: link.valor } : {}) }
  const criado = await db
    .from('PedidoBanco')
    .insert({ partidaId: partida.id, equipeId, tipo: 'DESAFIO', payload, estado: 'PENDENTE' })
    .select()
    .maybeSingle()
  conferir(criado)
  return success({ pedido: pedidoPublico(criado.data ?? { tipo: 'DESAFIO', estado: 'PENDENTE', payload }) }, 201)
}

export async function criarPedido(partida: PartidaBanco, equipeId: number, corpo: unknown) {
  const lido = pedidoSchema.safeParse(corpo)
  if (!lido.success) return corpoInvalido(lido.error)
  // Desafio de vídeo (R11): só com DESAFIO_ATIVO=1; desligado, segue como fase posterior (501).
  if (lido.data.tipo === 'DESAFIO' && !desafioAtivo()) {
    return respostaErro('Desafio de vídeo é uma fase posterior.', 501, 'NAO_IMPLEMENTADO')
  }
  if (STATUS_PARTIDA_ENCERRADA.includes(String(partida.status ?? '').toUpperCase())) {
    return respostaErro('A partida já terminou: não há mais pedidos.', 409, 'PARTIDA_ENCERRADA')
  }
  if (lido.data.tipo === 'DESAFIO') return criarPedidoDesafio(partida, equipeId, lido.data)
  const entrada = { tipo: lido.data.tipo as 'TEMPO' | 'SUBSTITUICAO', sai: lido.data.sai, entra: lido.data.entra }

  const sets = await lerSets(partida.id)
  const setNumero = await setAtualDaPartida(partida, sets)
  const [elenco, limites, existentes, logDoSet] = await Promise.all([
    lerElenco(partida.id, equipeId),
    limitesDaPartida(partida),
    db.from('PedidoBanco').select('*').eq('partidaId', partida.id).eq('equipeId', equipeId),
    usoDoLogDaSumula(partida, equipeId, setNumero),
  ])
  const pedidos = conferir(existentes) as any[]
  const papeleta = await lerPapeleta(partida.id, equipeId, setNumero)
  const enviada = papeleta && papeleta.estado !== 'RASCUNHO'
  const violacoes = validarPedidoDoBanco({
    entrada,
    setNumero,
    pedidos: pedidos ?? [],
    perfil: { temposPorSet: limites.tempos, limiteSubstituicoesPorSet: limites.substituicoes },
    elenco,
    titulares: enviada && Array.isArray(papeleta.formacao) ? papeleta.formacao.map((f: any) => Number(f.jogadorId)) : null,
    liberoId: enviada ? papeleta.liberoId ?? null : null,
    // Limite pelo log efetivo da súmula (quando houver) + pedidos aceitos ainda não lançados.
    uso: usoDoSet({ pedidos: pedidos ?? [], setNumero, log: logDoSet }),
  })
  if (violacoes.length > 0) {
    return respostaErro('O pedido não respeita as regras do vôlei.', 422, 'PEDIDO_INVALIDO', { violacoes })
  }
  const payload = { setNumero, ...(entrada.tipo === 'SUBSTITUICAO' ? { sai: entrada.sai, entra: entrada.entra } : {}) }
  const criado = await db
    .from('PedidoBanco')
    .insert({ partidaId: partida.id, equipeId, tipo: entrada.tipo, payload, estado: 'PENDENTE' })
    .select()
    .maybeSingle()
  conferir(criado)
  return success({ pedido: pedidoPublico(criado.data ?? { tipo: entrada.tipo, estado: 'PENDENTE', payload }) }, 201)
}

export async function cancelarPedido(partida: PartidaBanco, equipeId: number, pedidoId: string) {
  const pedido = conferir(
    await db.from('PedidoBanco').select('*').eq('id', pedidoId).eq('partidaId', partida.id).eq('equipeId', equipeId).maybeSingle(),
  ) as any
  if (!pedido) return respostaErro('Pedido não encontrado.', 404)
  if (pedido.estado === 'CANCELADO') return success({ pedido: pedidoPublico(pedido) })
  if (pedido.estado !== 'PENDENTE') {
    return respostaErro('Este pedido já foi decidido pelo apontador.', 409, 'PEDIDO_JA_DECIDIDO')
  }
  const linhas = conferir(
    await db.from('PedidoBanco').update({ estado: 'CANCELADO', decididoEm: new Date().toISOString() }).eq('id', pedido.id).eq('estado', 'PENDENTE').select(),
  ) as any[]
  if (!linhas || linhas.length === 0) return respostaErro('Este pedido já foi decidido pelo apontador.', 409, 'PEDIDO_JA_DECIDIDO')
  return success({ pedido: pedidoPublico(linhas[0]) })
}

// ---------------------------------------------------------------------------
// Lado do apontador
// ---------------------------------------------------------------------------

export async function pendentesDaPartida(partida: PartidaBanco) {
  const linhas = conferir(await db.from('PedidoBanco').select('*').eq('partidaId', partida.id).eq('estado', 'PENDENTE')) as any[]
  const [a, b] = await Promise.all([lerNomeEquipe(partida.equipeAId), lerNomeEquipe(partida.equipeBId)])
  const nomes = new Map<number, string>()
  if (a) nomes.set(a.id, a.nome)
  if (b) nomes.set(b.id, b.nome)
  return success({
    pedidos: (linhas ?? [])
      .map((p) => ({ ...pedidoPublico(p), equipeId: Number(p.equipeId), equipeNome: nomes.get(Number(p.equipeId)) ?? '' }))
      .sort((x, y) => String(x.criadoEm ?? '').localeCompare(String(y.criadoEm ?? ''))),
  })
}

export async function decidirPedido(partida: PartidaBanco, usuarioId: string, pedidoId: string, corpo: unknown) {
  const lido = decisaoSchema.safeParse(corpo)
  if (!lido.success) return corpoInvalido(lido.error)
  const decisao = lido.data.decisao
  // Campeonato finalizado não aceita mais decisões (mesma regra de eventos, scout e desafios).
  const finalizado = await rejectIfCampeonatoFinalizado(Number(partida.ligaId))
  if (finalizado) return finalizado
  const pedido = conferir(await db.from('PedidoBanco').select('*').eq('id', pedidoId).eq('partidaId', partida.id).maybeSingle()) as any
  if (!pedido) return respostaErro('Pedido não encontrado.', 404)
  if (pedido.estado === decisao) {
    // Repetir o aceite de um DESAFIO garante o desafio vinculado (recupera falha entre o aceite e a criação).
    if (decisao === 'ACEITO' && pedido.tipo === 'DESAFIO') return respostaComDesafio(partida, pedido, pedido)
    return success({ pedido: pedidoPublico(pedido) })
  }
  if (pedido.estado !== 'PENDENTE') {
    return respostaErro('Este pedido já foi decidido.', 409, 'PEDIDO_JA_DECIDIDO')
  }
  if (decisao === 'ACEITO' && pedido.tipo === 'DESAFIO') {
    if (!desafioAtivo()) return respostaErro('Desafio de vídeo é uma fase posterior.', 501, 'NAO_IMPLEMENTADO')
    const situacao = await situacaoDoLimite(db, partida.id, Number(pedido.equipeId), Number(pedido.payload?.setNumero ?? 0))
    if (situacao.tipo === 'INDISPONIVEL') return desafioIndisponivel()
    if (situacao.tipo === 'ERRO') throw new Error('erro ao ler os desafios')
    if (situacao.tipo === 'EXCEDIDO') return respostaErro(MENSAGEM_LIMITE_DESAFIOS(situacao.limite), 422, 'LIMITE_EXCEDIDO')
  } else if (decisao === 'ACEITO') {
    // Reconfere o limite pelo log efetivo da súmula + pedidos já aceitos e ainda não lançados
    // (dois pendentes decididos em sequência não passam do limite).
    const limites = await limitesDaPartida(partida)
    const outros = conferir(
      await db.from('PedidoBanco').select('*').eq('partidaId', partida.id).eq('equipeId', pedido.equipeId).eq('estado', 'ACEITO'),
    ) as any[]
    const setNumero = Number(pedido.payload?.setNumero ?? 0)
    const uso = usoDoSet({ pedidos: outros ?? [], setNumero, log: await usoDoLogDaSumula(partida, Number(pedido.equipeId), setNumero) })
    const doSet = pedido.tipo === 'TEMPO' ? uso.tempos : uso.substituicoes
    const limite = pedido.tipo === 'TEMPO' ? limites.tempos : limites.substituicoes
    if (doSet >= limite) {
      return respostaErro(
        pedido.tipo === 'TEMPO' ? 'A equipe já usou todos os tempos deste set.' : 'A equipe já usou todas as substituições deste set.',
        422,
        'LIMITE_EXCEDIDO',
        { violacoes: [{ codigo: pedido.tipo === 'TEMPO' ? 'RG-TMP-001' : 'RG-SUB-001', mensagem: 'Limite do set atingido.' }] },
      )
    }
  }
  const linhas = conferir(
    await db
      .from('PedidoBanco')
      .update({ estado: decisao, decididoEm: new Date().toISOString(), decididoPor: usuarioId })
      .eq('id', pedido.id)
      .eq('estado', 'PENDENTE')
      .select(),
  ) as any[]
  if (!linhas || linhas.length === 0) {
    const atual = conferir(await db.from('PedidoBanco').select('*').eq('id', pedido.id).maybeSingle()) as any
    if (atual?.estado === decisao) {
      return decisao === 'ACEITO' && atual.tipo === 'DESAFIO' ? respostaComDesafio(partida, atual, atual) : success({ pedido: pedidoPublico(atual) })
    }
    return respostaErro('Este pedido já foi decidido.', 409, 'PEDIDO_JA_DECIDIDO')
  }
  if (decisao === 'ACEITO' && pedido.tipo === 'DESAFIO') return respostaComDesafio(partida, linhas[0], linhas[0], true)
  return success({ pedido: pedidoPublico(linhas[0]) })
}

/**
 * Pedido de DESAFIO aceito: cria (ou recupera) o DesafioVideo EM_ANALISE vinculado por `pedidoBancoId`.
 * Se a criação falhar logo após o aceite pela primeira vez (limite estourado em corrida, tabela ausente),
 * o pedido volta a PENDENTE para o apontador decidir de novo, sem deixar aceite sem desafio.
 */
async function respostaComDesafio(partida: PartidaBanco, pedido: any, pedidoAtual: any, reverterSeFalhar = false) {
  const r = await criarDesafio(
    db,
    partida,
    {
      setNumero: Number(pedido.payload?.setNumero),
      equipeId: Number(pedido.equipeId),
      motivo: pedido.payload?.motivo ?? null,
      linkVideo: pedido.payload?.linkVideo ?? null,
    },
    { estado: 'EM_ANALISE', pedidoBancoId: String(pedido.id) },
  )
  if (r.tipo === 'OK') return success({ pedido: pedidoPublico(pedidoAtual), desafio: desafioPublico(r.desafio) })
  if (reverterSeFalhar) {
    await db.from('PedidoBanco').update({ estado: 'PENDENTE', decididoEm: null, decididoPor: null }).eq('id', pedido.id).eq('estado', 'ACEITO')
  }
  if (r.tipo === 'INDISPONIVEL') return desafioIndisponivel()
  if (r.tipo === 'INVALIDO') return respostaErro(r.mensagem, r.status === 400 ? 422 : r.status, r.codigo ?? 'DESAFIO_INVALIDO')
  throw new Error('erro ao criar o desafio')
}

export async function papeletasDoSet(partida: PartidaBanco, setNumero: number) {
  const linhas = conferir(await db.from('Papeleta').select('*').eq('partidaId', partida.id).eq('setNumero', setNumero)) as any[]
  const entregues = (linhas ?? []).filter((p) => p.estado === 'ENVIADA' || p.estado === 'ACEITA')
  const papeletas = await Promise.all(
    entregues.map(async (p) => {
      const equipeId = Number(p.equipeId)
      const [equipe, elenco] = await Promise.all([lerNomeEquipe(equipeId), lerElenco(partida.id, equipeId)])
      return {
        equipeId,
        equipeNome: equipe?.nome ?? '',
        ...papeletaPublica(p),
        enviadaEm: p.enviadaEm ?? null,
        aceitaEm: p.aceitaEm ?? null,
        jogadores: elenco,
      }
    }),
  )
  return success({ setNumero, papeletas })
}

export async function aceitarPapeleta(partida: PartidaBanco, usuarioId: string, setNumero: number, equipeId: number) {
  const finalizado = await rejectIfCampeonatoFinalizado(Number(partida.ligaId))
  if (finalizado) return finalizado
  if (equipeId !== partida.equipeAId && equipeId !== partida.equipeBId) return respostaErro('Equipe não pertence a esta partida.', 404)
  const papeleta = await lerPapeleta(partida.id, equipeId, setNumero)
  if (!papeleta) return respostaErro('Papeleta não encontrada.', 404)
  if (papeleta.estado === 'ACEITA') return success({ papeleta: papeletaPublica(papeleta) })
  if (papeleta.estado !== 'ENVIADA') {
    return respostaErro('A equipe ainda não enviou esta papeleta.', 409, 'PAPELETA_NAO_ENVIADA')
  }
  const linhas = conferir(
    await db
      .from('Papeleta')
      .update({ estado: 'ACEITA', aceitaEm: new Date().toISOString(), aceitaPor: usuarioId })
      .eq('id', papeleta.id)
      .eq('estado', 'ENVIADA')
      .select(),
  ) as any[]
  if (!linhas || linhas.length === 0) {
    const atual = await lerPapeleta(partida.id, equipeId, setNumero)
    if (atual?.estado === 'ACEITA') return success({ papeleta: papeletaPublica(atual) })
    return respostaErro('A papeleta mudou de estado. Recarregue.', 409, 'CONFLITO')
  }
  return success({ papeleta: papeletaPublica(linhas[0]) })
}
