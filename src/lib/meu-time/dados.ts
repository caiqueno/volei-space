// Acesso ao banco do Meu Time (equipe, banco de atletas, comissão), sempre com service_role.
// Os dados de atleta saem daqui já sem CPF, documento, telefone ou caminhos de arquivo.
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { colunaAusente } from '@/lib/coluna-ausente'
import { padraoIlikeLiteral } from '@/lib/email-lookup'
import { interpretarListaColada, normalizarChaveNome } from '@/lib/elenco-inscricao'
import {
  ErroMeuTime,
  idValido,
  lerDados,
  tabelaAusente,
  violacaoUnica,
} from '@/lib/meu-time/acesso'
import { chaveAtleta, resumoProntidao, type AtletaDoBanco, type Naipe } from '@/lib/meu-time/regras'

export type PapelEquipe = 'RESPONSAVEL' | 'TECNICO' | 'ASSISTENTE' | 'CAPITAO'
export type Permissao = 'leitura' | 'escrita' | 'responsavel'

const PAPEIS_POR_PERMISSAO: Record<Permissao, PapelEquipe[]> = {
  leitura: ['RESPONSAVEL', 'TECNICO', 'ASSISTENTE', 'CAPITAO'],
  escrita: ['RESPONSAVEL', 'TECNICO'],
  responsavel: ['RESPONSAVEL'],
}

export type EquipeBanco = {
  id: string
  clubeId: string
  nome: string
  cidade: string | null
  naipe: Naipe
  escudoUrl: string | null
}

export type EquipeDoUsuario = { equipe: EquipeBanco; papel: PapelEquipe }

export type AtletaPublico = {
  id: string
  nome: string
  dataNascimento: string | null
  numeroPreferido: number | null
  posicao: string | null
  temDocumento: boolean
}

function paraEquipe(linha: any): EquipeBanco {
  return {
    id: linha.id,
    clubeId: linha.clubeId,
    nome: linha.nome,
    cidade: linha.cidade ?? null,
    naipe: linha.naipe,
    escudoUrl: linha.escudoUrl ?? null,
  }
}

function linhaTemDocumento(linha: any) {
  return Boolean(linha.cpfHash || linha.documentoHash)
}

/** Projeção pública: whitelist de campos, nunca espalha a linha do banco. */
export function paraAtleta(linha: any): AtletaPublico {
  return {
    id: linha.id,
    nome: linha.nome,
    dataNascimento: linha.dataNascimento ? String(linha.dataNascimento).slice(0, 10) : null,
    numeroPreferido: linha.numeroPreferido ?? null,
    posicao: linha.posicao ?? null,
    temDocumento: linhaTemDocumento(linha),
  }
}

export function paraAtletaDoBanco(linha: any): AtletaDoBanco {
  return {
    id: linha.id,
    nome: linha.nome,
    dataNascimento: linha.dataNascimento ? String(linha.dataNascimento).slice(0, 10) : null,
    sexo: linha.sexo ?? null,
    temDocumento: linhaTemDocumento(linha),
  }
}

// --- Equipes -----------------------------------------------------------------

/** Posse: só quem é membro da equipe a enxerga. Para os demais, a equipe "não existe" (404). */
export async function exigirEquipe(usuarioId: string, timeId: string, permissao: Permissao): Promise<EquipeDoUsuario> {
  const naoEncontrada = () => new ErroMeuTime('Equipe não encontrada.', 404, 'EQUIPE_NAO_ENCONTRADA')
  if (!idValido(timeId)) throw naoEncontrada()
  const membro = lerDados(
    await supabase.from('MembroEquipe').select('papel').eq('timeId', timeId).eq('usuarioId', usuarioId).maybeSingle(),
    'membro da equipe',
  ) as { papel: PapelEquipe } | null
  if (!membro) throw naoEncontrada()
  const linha = lerDados(
    await supabase.from('TimeClube').select('id,clubeId,nome,cidade,naipe,escudoUrl').eq('id', timeId).is('arquivadoEm', null).maybeSingle(),
    'equipe',
  )
  if (!linha) throw naoEncontrada()
  if (!PAPEIS_POR_PERMISSAO[permissao].includes(membro.papel)) {
    throw new ErroMeuTime('Você não tem permissão para esta ação nesta equipe.', 403, 'SEM_PERMISSAO')
  }
  return { equipe: paraEquipe(linha), papel: membro.papel }
}

export async function listarAtletasDoClube(clubeId: string): Promise<any[]> {
  const vinculos = lerDados(
    await supabase.from('VinculoAtletaClube').select('atletaId').eq('clubeId', clubeId).eq('status', 'ATIVO'),
    'vínculos do clube',
  ) as Array<{ atletaId: string }> | null
  const ids = (vinculos ?? []).map((item) => item.atletaId)
  if (ids.length === 0) return []
  const atletas = lerDados(
    await supabase.from('Atleta').select('*').in('id', ids).is('mescladoParaId', null).order('nome', { ascending: true }),
    'atletas do clube',
  ) as any[] | null
  return atletas ?? []
}

export async function resumirEquipes(equipes: EquipeBanco[]) {
  const porClube = new Map<string, any[]>()
  for (const clubeId of Array.from(new Set(equipes.map((item) => item.clubeId)))) {
    porClube.set(clubeId, await listarAtletasDoClube(clubeId))
  }
  return equipes.map((equipe) => {
    const atletas = (porClube.get(equipe.clubeId) ?? []).map(paraAtleta)
    return {
      id: equipe.id,
      nome: equipe.nome,
      cidade: equipe.cidade,
      naipe: equipe.naipe,
      totalAtletas: atletas.length,
      prontidao: resumoProntidao(atletas),
    }
  })
}

export async function listarEquipesDoUsuario(usuarioId: string): Promise<EquipeBanco[]> {
  const membros = lerDados(
    await supabase.from('MembroEquipe').select('timeId').eq('usuarioId', usuarioId),
    'equipes do usuário',
  ) as Array<{ timeId: string }> | null
  const ids = (membros ?? []).map((item) => item.timeId)
  if (ids.length === 0) return []
  const linhas = lerDados(
    await supabase.from('TimeClube').select('id,clubeId,nome,cidade,naipe,escudoUrl').in('id', ids).is('arquivadoEm', null).order('nome', { ascending: true }),
    'times',
  ) as any[] | null
  return (linhas ?? []).map(paraEquipe)
}

type NovaEquipe = { nome: string; cidade?: string | null; naipe: Naipe; escudoUrl?: string | null }

/** Cria Clube (se o usuário ainda não tem), TimeClube e o vínculo RESPONSAVEL, desfazendo o que criou se algo falhar. */
export async function criarEquipe(usuarioId: string, entrada: NovaEquipe): Promise<EquipeBanco> {
  const clubeExistente = lerDados(
    await supabase.from('Clube').select('id').eq('criadoPor', usuarioId).is('arquivadoEm', null).limit(1),
    'clube do usuário',
  ) as Array<{ id: string }> | null
  let clubeId = clubeExistente?.[0]?.id ?? null
  let clubeNovo = false
  if (!clubeId) {
    const criado = lerDados(
      await supabase.from('Clube').insert({ nome: entrada.nome, cidade: entrada.cidade || null, origem: 'APP', criadoPor: usuarioId }).select('id').single(),
      'criar clube',
    ) as { id: string } | null
    if (!criado) throw new ErroMeuTime('Não foi possível criar a equipe.', 500)
    clubeId = criado.id
    clubeNovo = true
  }
  const desfazer = async () => {
    if (clubeNovo && clubeId) await supabase.from('Clube').delete().eq('id', clubeId)
  }

  const resposta = await supabase
    .from('TimeClube')
    .insert({ clubeId, nome: entrada.nome, cidade: entrada.cidade || null, naipe: entrada.naipe, escudoUrl: entrada.escudoUrl || null })
    .select('id,clubeId,nome,cidade,naipe,escudoUrl')
    .single()
  if (resposta.error) {
    await desfazer()
    if (violacaoUnica(resposta.error)) {
      throw new ErroMeuTime('Você já tem uma equipe com esse nome e naipe.', 409, 'EQUIPE_DUPLICADA')
    }
    lerDados(resposta, 'criar equipe')
  }
  const time = paraEquipe(resposta.data)

  const vinculo = await supabase.from('MembroEquipe').insert({ timeId: time.id, usuarioId, papel: 'RESPONSAVEL' })
  if (vinculo.error) {
    await supabase.from('TimeClube').delete().eq('id', time.id)
    await desfazer()
    lerDados(vinculo, 'vincular responsável')
  }
  return time
}

// --- Atletas -----------------------------------------------------------------

export async function exigirAtletaDoClube(clubeId: string, atletaId: string) {
  const naoEncontrado = () => new ErroMeuTime('Atleta não encontrado.', 404, 'ATLETA_NAO_ENCONTRADO')
  if (!idValido(atletaId)) throw naoEncontrado()
  const vinculo = lerDados(
    await supabase.from('VinculoAtletaClube').select('atletaId').eq('clubeId', clubeId).eq('atletaId', atletaId).eq('status', 'ATIVO').maybeSingle(),
    'vínculo do atleta',
  )
  if (!vinculo) throw naoEncontrado()
  const linha = lerDados(await supabase.from('Atleta').select('*').eq('id', atletaId).maybeSingle(), 'atleta')
  if (!linha) throw naoEncontrado()
  return linha as any
}

/** Colunas opcionais (numeroPreferido, posicao) podem não existir ainda: tenta com elas e cai para o básico. */
const COLUNAS_OPCIONAIS = ['numeroPreferido', 'posicao']

async function inserirAtletas(linhas: Array<Record<string, unknown>>) {
  let resposta = await supabase.from('Atleta').insert(linhas).select('*')
  if (resposta.error && colunaAusente(resposta.error, COLUNAS_OPCIONAIS)) {
    const basicas = linhas.map((linha) => {
      const copia = { ...linha }
      for (const coluna of COLUNAS_OPCIONAIS) delete copia[coluna]
      return copia
    })
    resposta = await supabase.from('Atleta').insert(basicas).select('*')
  }
  return resposta
}

function chavesDoBanco(atletas: any[]) {
  return new Set(atletas.map((item) => chaveAtleta(item.nome, item.dataNascimento)))
}

export async function adicionarAtleta(
  usuarioId: string,
  clubeId: string,
  entrada: { nome: string; dataNascimento: string; numeroPreferido?: number | null; posicao?: string | null },
): Promise<AtletaPublico> {
  const existentes = await listarAtletasDoClube(clubeId)
  if (chavesDoBanco(existentes).has(chaveAtleta(entrada.nome, entrada.dataNascimento))) {
    throw new ErroMeuTime('Este atleta já está no banco do time (mesmo nome e data de nascimento).', 409, 'ATLETA_DUPLICADO')
  }
  const resposta = await inserirAtletas([{
    nome: entrada.nome,
    dataNascimento: entrada.dataNascimento,
    origem: 'APP',
    criadoPor: usuarioId,
    ...(entrada.numeroPreferido != null ? { numeroPreferido: entrada.numeroPreferido } : {}),
    ...(entrada.posicao ? { posicao: entrada.posicao } : {}),
  }])
  const criados = lerDados(resposta, 'criar atleta') as any[] | null
  const atleta = criados?.[0]
  if (!atleta) throw new ErroMeuTime('Não foi possível cadastrar o atleta.', 500)
  const vinculo = await supabase.from('VinculoAtletaClube').insert({ clubeId, atletaId: atleta.id, status: 'ATIVO' })
  if (vinculo.error) {
    await supabase.from('Atleta').delete().eq('id', atleta.id)
    lerDados(vinculo, 'vincular atleta')
  }
  return paraAtleta(atleta)
}

export type EntradaLote = { nome: string; numero?: number | string | null; dataNascimento?: string | null }
export type LinhaIgnoradaLote = { linha: number; motivo: string }

/** Quebra o lote em linhas válidas e ignoradas (sem gravar). `texto` usa o parser da inscrição rápida. */
export function prepararLote(entrada: { atletas?: EntradaLote[]; texto?: string }, existentes: Array<{ nome: string }>) {
  const ignorados: LinhaIgnoradaLote[] = []
  const candidatos: Array<{ linha: number; nome: string; dataNascimento: string | null }> = []
  if (entrada.texto != null) {
    const lido = interpretarListaColada(entrada.texto)
    lido.atletas.forEach((item, indice) => candidatos.push({ linha: indice + 1, nome: item.nome, dataNascimento: null }))
    lido.ignoradas.forEach((item) => ignorados.push({ linha: item.linha, motivo: item.motivo }))
  }
  ;(entrada.atletas ?? []).forEach((item, indice) => {
    const nome = String(item.nome ?? '').replace(/\s+/g, ' ').trim()
    const linha = indice + 1
    const numero = item.numero == null || item.numero === '' ? null : Number(item.numero)
    if (nome.length < 2 || !/[A-Za-zÀ-ɏ]/.test(nome)) return void ignorados.push({ linha, motivo: 'Sem nome reconhecível' })
    if (numero != null && (!Number.isInteger(numero) || numero < 0 || numero > 99)) {
      return void ignorados.push({ linha, motivo: 'Camisa deve ser de 0 a 99' })
    }
    candidatos.push({ linha, nome, dataNascimento: item.dataNascimento ?? null })
  })

  const nomes = new Set(existentes.map((item) => normalizarChaveNome(item.nome)))
  const novos: typeof candidatos = []
  for (const candidato of candidatos) {
    const chave = normalizarChaveNome(candidato.nome)
    if (nomes.has(chave)) {
      ignorados.push({ linha: candidato.linha, motivo: 'Já está no banco do time' })
      continue
    }
    nomes.add(chave)
    novos.push(candidato)
  }
  ignorados.sort((a, b) => a.linha - b.linha)
  return { novos, ignorados }
}

/**
 * Lote ("colar lista"): Atleta.dataNascimento é obrigatória no banco, exceto para origem 'MIGRACAO'.
 * Linhas sem data entram como MIGRACAO e ficam com a pendência "falta nascimento" até o líder completar.
 */
export async function adicionarLote(usuarioId: string, clubeId: string, entrada: { atletas?: EntradaLote[]; texto?: string }) {
  const existentes = await listarAtletasDoClube(clubeId)
  const { novos, ignorados } = prepararLote(entrada, existentes)
  if (novos.length === 0) return { criados: [] as AtletaPublico[], ignorados }
  const resposta = await inserirAtletas(novos.map((item) => ({
    nome: item.nome,
    dataNascimento: item.dataNascimento,
    origem: item.dataNascimento ? 'APP' : 'MIGRACAO',
    criadoPor: usuarioId,
  })))
  const criados = (lerDados(resposta, 'criar atletas em lote') as any[] | null) ?? []
  const vinculo = await supabase.from('VinculoAtletaClube').insert(criados.map((item) => ({ clubeId, atletaId: item.id, status: 'ATIVO' })))
  if (vinculo.error) {
    await supabase.from('Atleta').delete().in('id', criados.map((item) => item.id))
    lerDados(vinculo, 'vincular atletas')
  }
  return { criados: criados.map(paraAtleta), ignorados }
}

export async function editarAtleta(
  clubeId: string,
  atletaId: string,
  entrada: { nome?: string; dataNascimento?: string; numeroPreferido?: number | null; posicao?: string | null },
): Promise<AtletaPublico> {
  const atual = await exigirAtletaDoClube(clubeId, atletaId)
  const nome = entrada.nome ?? atual.nome
  const nascimento = entrada.dataNascimento ?? (atual.dataNascimento ? String(atual.dataNascimento).slice(0, 10) : null)
  const outros = (await listarAtletasDoClube(clubeId)).filter((item) => item.id !== atletaId)
  if (nascimento && chavesDoBanco(outros).has(chaveAtleta(nome, nascimento))) {
    throw new ErroMeuTime('Já existe um atleta com esse nome e data de nascimento no banco do time.', 409, 'ATLETA_DUPLICADO')
  }
  const campos: Record<string, unknown> = { atualizadoEm: new Date().toISOString() }
  if (entrada.nome !== undefined) campos.nome = entrada.nome
  if (entrada.dataNascimento !== undefined) campos.dataNascimento = entrada.dataNascimento
  const opcionais: Record<string, unknown> = {}
  if (entrada.numeroPreferido !== undefined) opcionais.numeroPreferido = entrada.numeroPreferido
  if (entrada.posicao !== undefined) opcionais.posicao = entrada.posicao

  let resposta = await supabase.from('Atleta').update({ ...campos, ...opcionais }).eq('id', atletaId).select('*').single()
  if (resposta.error && colunaAusente(resposta.error, COLUNAS_OPCIONAIS)) {
    resposta = await supabase.from('Atleta').update(campos).eq('id', atletaId).select('*').single()
  }
  const linha = lerDados(resposta, 'editar atleta')
  if (!linha) throw new ErroMeuTime('Atleta não encontrado.', 404, 'ATLETA_NAO_ENCONTRADO')
  return paraAtleta(linha)
}

/** Remove do banco do time (vínculo INATIVO). O cadastro do atleta e as cópias em inscrições ficam. */
export async function removerAtleta(clubeId: string, atletaId: string) {
  await exigirAtletaDoClube(clubeId, atletaId)
  lerDados(
    await supabase
      .from('VinculoAtletaClube')
      .update({ status: 'INATIVO', ate: new Date().toISOString().slice(0, 10) })
      .eq('clubeId', clubeId)
      .eq('atletaId', atletaId)
      .select('atletaId'),
    'remover atleta do time',
  )
}

// --- Comissão técnica --------------------------------------------------------

export type MembroComissao = { id: string; nome: string; papel: PapelEquipe }

async function nomesDasContas(ids: string[]) {
  const nomes = new Map<string, string>()
  if (ids.length === 0) return nomes
  const equipes = await supabase.from('CandidaturaEquipe').select('id,responsavel,nome').in('id', ids)
  if (equipes.error && !tabelaAusente(equipes.error)) console.error('[meu-time] nomes da comissão', equipes.error.code ?? '')
  for (const linha of (equipes.data ?? []) as any[]) nomes.set(linha.id, String(linha.responsavel || linha.nome || ''))
  const faltantes = ids.filter((id) => !nomes.has(id))
  if (faltantes.length > 0) {
    const contas = await supabase.from('ContaPublico').select('id,nome').in('id', faltantes)
    for (const linha of (contas.data ?? []) as any[]) nomes.set(linha.id, String(linha.nome || ''))
  }
  return nomes
}

export async function listarComissao(timeId: string): Promise<MembroComissao[]> {
  const membros = (lerDados(
    await supabase.from('MembroEquipe').select('usuarioId,papel').eq('timeId', timeId),
    'comissão',
  ) as Array<{ usuarioId: string; papel: PapelEquipe }> | null) ?? []
  const nomes = await nomesDasContas(membros.map((item) => item.usuarioId))
  return membros.map((item) => ({ id: item.usuarioId, nome: nomes.get(item.usuarioId) || 'Membro', papel: item.papel }))
}

async function acharContaPorEmail(email: string) {
  for (const tabela of ['CandidaturaEquipe', 'ContaPublico']) {
    const resposta = await supabase.from(tabela).select('id,email').ilike('email', padraoIlikeLiteral(email)).limit(1)
    if (resposta.error) {
      if (tabelaAusente(resposta.error)) continue
      lerDados(resposta, `conta por e-mail em ${tabela}`)
    }
    const linha = ((resposta.data ?? []) as any[])[0]
    if (linha && String(linha.email).trim().toLowerCase() === email.trim().toLowerCase()) return String(linha.id)
  }
  return null
}

export async function adicionarMembro(timeId: string, entrada: { email: string; papel: 'TECNICO' | 'ASSISTENTE' }) {
  const usuarioId = await acharContaPorEmail(entrada.email)
  if (!usuarioId) {
    throw new ErroMeuTime('Essa pessoa precisa ter conta no volei.space para entrar na comissão.', 404, 'CONTA_NAO_ENCONTRADA')
  }
  const resposta = await supabase.from('MembroEquipe').insert({ timeId, usuarioId, papel: entrada.papel })
  if (violacaoUnica(resposta.error)) throw new ErroMeuTime('Essa pessoa já faz parte da equipe.', 409, 'MEMBRO_DUPLICADO')
  lerDados(resposta, 'adicionar membro')
  const nomes = await nomesDasContas([usuarioId])
  return { id: usuarioId, nome: nomes.get(usuarioId) || 'Membro', papel: entrada.papel } as MembroComissao
}

export async function removerMembro(timeId: string, membroId: string) {
  const membros = await listarComissao(timeId)
  const alvo = membros.find((item) => item.id === membroId)
  if (!alvo) throw new ErroMeuTime('Membro não encontrado.', 404, 'MEMBRO_NAO_ENCONTRADO')
  if (alvo.papel === 'RESPONSAVEL') {
    throw new ErroMeuTime('O responsável pela equipe não pode ser removido.', 409, 'RESPONSAVEL_FIXO')
  }
  lerDados(await supabase.from('MembroEquipe').delete().eq('timeId', timeId).eq('usuarioId', membroId), 'remover membro')
}
