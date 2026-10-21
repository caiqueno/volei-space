// Lembretes e eventos que geram notificações (R18): prazo de inscrição em 48 h, jogo amanhã e tabela publicada.
// Sem duplicar: cada envio reserva uma chave única em "LembreteEnviado" antes de notificar.
// As mensagens levam só nome do time/campeonato, data e local (nada de dado pessoal de atleta).
// A notificação passa por `notificar`, que respeita as preferências de canal de cada usuário.
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ErroMeuTime, tabelaAusente, violacaoUnica } from '@/lib/meu-time/acesso'
import { notificar, type TipoNotificacao } from '@/lib/meu-time-fase2/notificacoes'
import { idsCompeticoesPrivadas } from '@/lib/visibilidade-competicao'
import { campeonatoPublicado } from '@/lib/campeonato-publico'
import { MENSAGEM_CANAIS_NAO_HABILITADO, multicanalAtivo } from './flags'

const db = supabaseAdmin as any

const BRT_MS = 3 * 3600_000
const STATUS_PENDENCIA = ['RASCUNHO', 'CONFIRMADA_COM_PENDENCIAS', 'AJUSTE_PEDIDO']
const STATUS_CONFIRMADA = ['CONFIRMADA', 'CONFIRMADA_COM_PENDENCIAS']

const doisDigitos = (n: number) => String(n).padStart(2, '0')

/** "dd/mm às HH:mm" no fuso de Brasília (UTC-3, sem horário de verão). */
export function dataHoraBrasilia(valor: string | Date) {
  const d = new Date(new Date(valor).getTime() - BRT_MS)
  return `${doisDigitos(d.getUTCDate())}/${doisDigitos(d.getUTCMonth() + 1)} às ${doisDigitos(d.getUTCHours())}:${doisDigitos(d.getUTCMinutes())}`
}

export function diaBrasilia(valor: Date) {
  const d = new Date(valor.getTime() - BRT_MS)
  return `${d.getUTCFullYear()}-${doisDigitos(d.getUTCMonth() + 1)}-${doisDigitos(d.getUTCDate())}`
}

/** Janela [00:00, 24:00) de amanhã em Brasília, em instantes UTC. */
export function intervaloDeAmanha(agora: Date) {
  const d = new Date(agora.getTime() - BRT_MS)
  const inicio = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1) + BRT_MS)
  const fim = new Date(inicio.getTime() + 24 * 3600_000)
  return { inicio, fim }
}

function indisponivel() {
  return new ErroMeuTime(MENSAGEM_CANAIS_NAO_HABILITADO, 503, 'RECURSO_NAO_HABILITADO')
}

function ler<T>(resultado: { data: T | null; error: { code?: string | null } | null }, onde: string): T {
  if (!resultado.error) return (resultado.data ?? ([] as unknown)) as T
  if (tabelaAusente(resultado.error) || resultado.error.code === '42703') throw indisponivel()
  console.error(`[lembretes] ${onde}`, resultado.error.code ?? '')
  throw new ErroMeuTime('Não foi possível concluir a operação. Tente novamente.', 500)
}

type Envio = 'ENVIADO' | 'DUPLICADO' | 'FALHOU'

/** Reserva a chave (única) e notifica; se a notificação não gravar, devolve a chave para tentar de novo depois. */
export async function enviarSemDuplicar(
  chave: string,
  usuarioId: string,
  tipo: TipoNotificacao,
  titulo: string,
  mensagem: string,
  dados: Record<string, unknown>,
  agora: Date,
): Promise<Envio> {
  const reservada = await db.from('LembreteEnviado').insert({ chave, usuarioId, tipo, enviadoEm: agora.toISOString() })
  if (violacaoUnica(reservada.error)) return 'DUPLICADO'
  ler(reservada, 'reservar lembrete')
  const gravada = await notificar(usuarioId, tipo, titulo, mensagem, dados)
  if (!gravada) {
    await db.from('LembreteEnviado').delete().eq('chave', chave)
    return 'FALHOU'
  }
  return 'ENVIADO'
}

export type ResumoLembretes = { prazo: number; jogo: number; duplicados: number; falhas: number }

function contar(resumo: ResumoLembretes, campo: 'prazo' | 'jogo', r: Envio) {
  if (r === 'ENVIADO') resumo[campo] += 1
  else if (r === 'DUPLICADO') resumo.duplicados += 1
  else resumo.falhas += 1
}

async function responsaveis(timeIds: string[], todosOsMembros: boolean): Promise<Map<string, string[]>> {
  const mapa = new Map<string, string[]>()
  if (timeIds.length === 0) return mapa
  const membros = ler<Array<{ timeId: string; usuarioId: string; papel: string }>>(
    await db.from('MembroEquipe').select('timeId,usuarioId,papel').in('timeId', timeIds),
    'membros das equipes',
  )
  for (const m of membros) {
    if (!todosOsMembros && m.papel !== 'RESPONSAVEL') continue
    mapa.set(m.timeId, [...(mapa.get(m.timeId) ?? []), m.usuarioId])
  }
  return mapa
}

async function nomesDosTimes(timeIds: string[]) {
  const nomes = new Map<string, string>()
  if (timeIds.length === 0) return nomes
  const linhas = ler<Array<{ id: string; nome: string }>>(await db.from('TimeClube').select('id,nome').in('id', timeIds), 'equipes')
  for (const l of linhas) nomes.set(l.id, l.nome)
  return nomes
}

/** "Prazo de inscrição em 48 h" para líderes cujo time ainda não se inscreveu ou tem rascunho/pendência. */
export async function lembretesDePrazo(agora: Date, resumo: ResumoLembretes) {
  const limite = new Date(agora.getTime() + 48 * 3600_000)
  const ligas = ler<any[]>(await db.from('Liga').select('id,nome,status,simulacao,organizadorId,inscricoesAbertas,inscricoesEncerramentoEm').in('status', ['EM_BREVE', 'ATIVA']), 'campeonatos')
  const privadas = await idsCompeticoesPrivadas({ semCache: true })
  for (const liga of ligas) {
    const fim = liga.inscricoesEncerramentoEm ? new Date(liga.inscricoesEncerramentoEm) : null
    if (!fim || Number.isNaN(fim.getTime()) || fim <= agora || fim > limite) continue
    if (liga.inscricoesAbertas === false || !campeonatoPublicado(liga) || privadas.has(Number(liga.id))) continue

    const inscricoes = ler<Array<{ timeId: string; status: string }>>(await db.from('Inscricao').select('timeId,status').eq('ligaId', liga.id), 'inscrições')
    const viva = new Map<string, string>()
    for (const i of inscricoes) if (i.status !== 'REMOVIDA') viva.set(i.timeId, i.status)

    // Alvos: quem tem rascunho/pendência nesta liga + quem já jogou outro campeonato do mesmo organizador e ainda não entrou.
    const alvos = new Map<string, 'PENDENCIA' | 'NAO_INSCRITA'>()
    viva.forEach((status, timeId) => { if (STATUS_PENDENCIA.includes(status)) alvos.set(timeId, 'PENDENCIA') })
    if (liga.organizadorId) {
      const outras = ler<Array<{ id: number }>>(await db.from('Liga').select('id').eq('organizadorId', liga.organizadorId), 'campeonatos do organizador')
      const ids = outras.map((o) => Number(o.id)).filter((id) => id !== Number(liga.id))
      if (ids.length > 0) {
        const historico = ler<Array<{ timeId: string }>>(await db.from('Inscricao').select('timeId').in('ligaId', ids), 'histórico do organizador')
        for (const h of historico) if (!viva.has(h.timeId) && !alvos.has(h.timeId)) alvos.set(h.timeId, 'NAO_INSCRITA')
      }
    }
    const timeIds = Array.from(alvos.keys())
    const [donos, nomes] = await Promise.all([responsaveis(timeIds, false), nomesDosTimes(timeIds)])
    const prazo = dataHoraBrasilia(fim)
    for (const timeId of timeIds) {
      const nomeTime = nomes.get(timeId) ?? 'Seu time'
      const texto = alvos.get(timeId) === 'PENDENCIA'
        ? `O prazo de inscrição de ${liga.nome} termina em ${prazo}. Falta concluir a inscrição de ${nomeTime}.`
        : `O prazo de inscrição de ${liga.nome} termina em ${prazo}. ${nomeTime} ainda não está inscrito.`
      for (const usuarioId of donos.get(timeId) ?? []) {
        const r = await enviarSemDuplicar(`prazo48:${liga.id}:${timeId}:${usuarioId}`, usuarioId, 'PRAZO_INSCRICAO', 'Prazo de inscrição em 48 horas', texto, { ligaId: Number(liga.id), timeId }, agora)
        contar(resumo, 'prazo', r)
      }
    }
  }
}

/** "Jogo amanhã" para todos os membros dos times das partidas do dia seguinte (fuso de Brasília). */
export async function lembretesDeJogo(agora: Date, resumo: ResumoLembretes) {
  const { inicio, fim } = intervaloDeAmanha(agora)
  const partidas = ler<any[]>(
    await db.from('Partida').select('id,ligaId,equipeAId,equipeBId,dataHora,localNome,status').gte('dataHora', inicio.toISOString()).lt('dataHora', fim.toISOString()),
    'partidas de amanhã',
  ).filter((p) => String(p.status ?? 'AGENDADA') === 'AGENDADA')
  if (partidas.length === 0) return
  const equipeIds = Array.from(new Set(partidas.flatMap((p) => [p.equipeAId, p.equipeBId]).filter((id) => id != null).map(Number)))
  if (equipeIds.length === 0) return
  const equipes = ler<Array<{ id: number; nome: string }>>(await db.from('Equipe').select('id,nome').in('id', equipeIds), 'equipes das partidas')
  const nomeEquipe = new Map(equipes.map((e) => [Number(e.id), e.nome]))
  const pontes = ler<Array<{ timeId: string; equipeLegadoId: number; status: string }>>(
    await db.from('Inscricao').select('timeId,equipeLegadoId,status').in('equipeLegadoId', equipeIds),
    'inscrições das equipes',
  ).filter((i) => i.status !== 'REMOVIDA')
  const timePorEquipe = new Map(pontes.map((i) => [Number(i.equipeLegadoId), i.timeId]))
  const membros = await responsaveis(Array.from(new Set(pontes.map((i) => i.timeId))), true)

  for (const partida of partidas) {
    const a = nomeEquipe.get(Number(partida.equipeAId)) ?? 'A definir'
    const b = nomeEquipe.get(Number(partida.equipeBId)) ?? 'A definir'
    const local = partida.localNome && partida.localNome !== 'A definir' ? partida.localNome : 'local a definir'
    const texto = `Jogo amanhã: ${a} x ${b}, ${dataHoraBrasilia(partida.dataHora)}, ${local}.`
    const destinatarios = new Set<string>()
    for (const equipeId of [partida.equipeAId, partida.equipeBId]) {
      const timeId = timePorEquipe.get(Number(equipeId))
      for (const usuarioId of (timeId && membros.get(timeId)) || []) destinatarios.add(usuarioId)
    }
    for (const usuarioId of Array.from(destinatarios)) {
      const r = await enviarSemDuplicar(`jogo:${partida.id}:${usuarioId}`, usuarioId, 'JOGO_AMANHA', 'Jogo amanhã', texto, { partidaId: Number(partida.id), ligaId: Number(partida.ligaId) }, agora)
      contar(resumo, 'jogo', r)
    }
  }
}

export async function gerarLembretes(agora: Date = new Date()): Promise<ResumoLembretes> {
  const resumo: ResumoLembretes = { prazo: 0, jogo: 0, duplicados: 0, falhas: 0 }
  await lembretesDePrazo(agora, resumo)
  await lembretesDeJogo(agora, resumo)
  return resumo
}

/**
 * Evento: o calendário de uma categoria foi gerado. Avisa os membros dos times inscritos (uma vez por dia e categoria,
 * então regenerar no mesmo dia não repete). Nunca lança e só age com NOTIFICACOES_MULTICANAL_ATIVO=1.
 */
export async function notificarTabelaPublicada(ligaId: number, categoriaId: string, agora: Date = new Date()): Promise<number> {
  if (!multicanalAtivo()) return 0
  try {
    const inscricoes = ler<Array<{ timeId: string; status: string }>>(
      await db.from('Inscricao').select('timeId,status').eq('ligaId', ligaId).eq('categoriaCampeonatoId', categoriaId),
      'inscritos da categoria',
    ).filter((i) => STATUS_CONFIRMADA.includes(i.status))
    if (inscricoes.length === 0) return 0
    const [liga, categoria] = await Promise.all([
      db.from('Liga').select('nome').eq('id', ligaId).maybeSingle(),
      db.from('CategoriaCampeonato').select('nome').eq('id', categoriaId).maybeSingle(),
    ])
    const texto = `A tabela de jogos de ${categoria.data?.nome ?? 'sua categoria'} em ${liga.data?.nome ?? 'seu campeonato'} foi publicada.`
    const timeIds = Array.from(new Set(inscricoes.map((i) => i.timeId)))
    const membros = await responsaveis(timeIds, true)
    const usuarios = new Set<string>()
    membros.forEach((lista) => lista.forEach((u) => usuarios.add(u)))
    const dia = diaBrasilia(agora)
    let enviados = 0
    for (const usuarioId of Array.from(usuarios)) {
      const r = await enviarSemDuplicar(`tabela:${categoriaId}:${usuarioId}:${dia}`, usuarioId, 'TABELA_PUBLICADA', 'Tabela publicada', texto, { ligaId, categoriaId }, agora)
      if (r === 'ENVIADO') enviados += 1
    }
    return enviados
  } catch {
    return 0
  }
}
