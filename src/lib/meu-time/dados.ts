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
import { anonimizarAtleta, consentimentosAtivos, registrarConsentimento, type EntradaResponsavel } from '@/lib/lgpd/consentimento'
import { ehMenorDeIdade } from '@/lib/lgpd/idade'
import { mascararCifrado, mascararCpf, mascararDocumentoNumero, mascararTelefone } from '@/lib/lgpd/documentos'
import { elencoCompletoAtivo } from '@/lib/meu-time/elenco'

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
  /** Calculado no servidor pela data de nascimento (menor de 18 anos). */
  menor: boolean
  /** Menor sem autorização ativa do responsável legal. Nunca há contato do responsável aqui. */
  consentimentoPendente: boolean
  /** R17 (ELENCO_COMPLETO_ATIVO): só máscaras e flags, nunca o valor em claro. */
  cpfMascarado?: string | null
  telefoneMascarado?: string | null
  telefoneEmergenciaMascarado?: string | null
  documentoTipo?: string | null
  documentoMascarado?: string | null
  temFoto?: boolean
  temCpf?: boolean
  cpf?: string | null
  telefone?: string | null
  telefoneEmergencia?: string | null
  documentoNumero?: string | null
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
export function paraAtleta(linha: any, comConsentimento: ReadonlySet<string> = new Set()): AtletaPublico {
  const menor = ehMenorDeIdade(linha.dataNascimento)
  const base: AtletaPublico = {
    id: linha.id,
    nome: linha.nome,
    dataNascimento: linha.dataNascimento ? String(linha.dataNascimento).slice(0, 10) : null,
    numeroPreferido: linha.numeroPreferido ?? null,
    posicao: linha.posicao ?? null,
    temDocumento: linhaTemDocumento(linha),
    menor,
    consentimentoPendente: menor && !comConsentimento.has(linha.id),
  }
  if (!elencoCompletoAtivo()) return base
  // R17: "temDocumento" passa a significar arquivo do documento enviado; o CPF tem flag própria. Valores só mascarados.
  const cpfMascarado = mascararCifrado(linha.cpfCifrado, mascararCpf)
  const telefoneMascarado = mascararCifrado(linha.telefoneCifrado, mascararTelefone)
  const telefoneEmergenciaMascarado = mascararCifrado(linha.telefoneEmergenciaCifrado, mascararTelefone)
  const documentoMascarado = mascararCifrado(linha.documentoNumeroCifrado, mascararDocumentoNumero)
  return {
    ...base,
    temDocumento: Boolean(linha.documentoPath),
    temFoto: Boolean(linha.fotoRostoPath),
    temCpf: Boolean(linha.cpfCifrado),
    cpfMascarado,
    telefoneMascarado,
    telefoneEmergenciaMascarado,
    documentoTipo: linha.documentoTipo ?? null,
    documentoMascarado,
    // Aliases sem sufixo que a tela lê. Também só MASCARADOS, nunca o valor em claro.
    cpf: cpfMascarado,
    telefone: telefoneMascarado,
    telefoneEmergencia: telefoneEmergenciaMascarado,
    documentoNumero: documentoMascarado,
  }
}

/**
 * R17: os dados cifrados e o caminho do documento ficam em "AtletaDocumento" (1:1). Junta à linha de Atleta
 * as colunas lidas de lá. Leitura tolerante: tabela ou coluna ausente = nada a juntar.
 */
export async function juntarDocumentos(linhas: any[]): Promise<any[]> {
  if (!elencoCompletoAtivo() || linhas.length === 0) return linhas
  const resposta = await supabase
    .from('AtletaDocumento')
    .select('atletaId,cpfCifrado,documentoNumeroCifrado,telefoneCifrado,telefoneEmergenciaCifrado,documentoPath')
    .in('atletaId', linhas.map((linha) => linha.id))
  if (resposta.error) return linhas
  const porAtleta = new Map(((resposta.data ?? []) as any[]).map((item) => [item.atletaId, item]))
  return linhas.map((linha) => {
    const doc = porAtleta.get(linha.id)
    return doc
      ? { ...linha, cpfCifrado: doc.cpfCifrado ?? null, documentoNumeroCifrado: doc.documentoNumeroCifrado ?? null, telefoneCifrado: doc.telefoneCifrado ?? null, telefoneEmergenciaCifrado: doc.telefoneEmergenciaCifrado ?? null, documentoPath: doc.documentoPath ?? null }
      : linha
  })
}

/** Ids dos atletas menores (entre `linhas`) que têm autorização ativa. */
export async function idsComConsentimento(linhas: any[]): Promise<Set<string>> {
  const menores = linhas.filter((linha) => ehMenorDeIdade(linha.dataNascimento)).map((linha) => linha.id as string)
  return new Set(Array.from((await consentimentosAtivos(menores)).keys()))
}

export async function listarAtletasPublicos(clubeId: string): Promise<AtletaPublico[]> {
  const linhas = await listarAtletasDoClube(clubeId)
  const com = await idsComConsentimento(linhas)
  return linhas.map((linha) => paraAtleta(linha, com))
}

export function paraAtletaDoBanco(linha: any, comConsentimento: ReadonlySet<string> = new Set()): AtletaDoBanco {
  const menor = ehMenorDeIdade(linha.dataNascimento)
  const elenco = elencoCompletoAtivo()
  return {
    id: linha.id,
    nome: linha.nome,
    dataNascimento: linha.dataNascimento ? String(linha.dataNascimento).slice(0, 10) : null,
    sexo: linha.sexo ?? null,
    temDocumento: elenco ? Boolean(linha.documentoPath) : linhaTemDocumento(linha),
    consentimentoPendente: menor && !comConsentimento.has(linha.id),
    ...(elenco ? { temFoto: Boolean(linha.fotoRostoPath), temCpf: Boolean(linha.cpfCifrado) } : {}),
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
  return juntarDocumentos(atletas ?? [])
}

export async function resumirEquipes(equipes: EquipeBanco[]) {
  const porClube = new Map<string, AtletaPublico[]>()
  for (const clubeId of Array.from(new Set(equipes.map((item) => item.clubeId)))) {
    porClube.set(clubeId, await listarAtletasPublicos(clubeId))
  }
  return equipes.map((equipe) => {
    const atletas = porClube.get(equipe.clubeId) ?? []
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
  return (await juntarDocumentos([linha as any]))[0]
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

export type AutorizacaoResponsavel = { responsavel?: EntradaResponsavel; aceiteResponsavel?: true }

/** Responsável só se coleta para menor de 18 anos (minimização); para maior, o envio é rejeitado. */
function exigirResponsavelCoerente(menor: boolean, entrada: AutorizacaoResponsavel) {
  if (!menor && (entrada.responsavel || entrada.aceiteResponsavel)) {
    throw new ErroMeuTime('Dados do responsável só são aceitos para atleta menor de 18 anos.', 422, 'RESPONSAVEL_DESNECESSARIO')
  }
}

export async function adicionarAtleta(
  usuarioId: string,
  clubeId: string,
  entrada: { nome: string; dataNascimento: string; numeroPreferido?: number | null; posicao?: string | null } & AutorizacaoResponsavel,
): Promise<AtletaPublico> {
  const menor = ehMenorDeIdade(entrada.dataNascimento)
  exigirResponsavelCoerente(menor, entrada)
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
  const com = new Set<string>()
  if (menor && entrada.responsavel && entrada.aceiteResponsavel) {
    try {
      await registrarConsentimento(usuarioId, atleta.id, entrada.responsavel)
      com.add(atleta.id)
    } catch (erro) {
      // Quem pediu o aceite não fica com cadastro pela metade: desfaz o atleta e devolve o erro (ex.: 503 sem chave de cifra).
      await supabase.from('VinculoAtletaClube').delete().eq('atletaId', atleta.id)
      await supabase.from('Atleta').delete().eq('id', atleta.id)
      throw erro
    }
  }
  return paraAtleta(atleta, com)
}

export type EntradaLote = { nome: string; numero?: number | string | null; dataNascimento?: string | null; posicao?: string | null }
export type LinhaIgnoradaLote = { linha: number; motivo: string }

/** Quebra o lote em linhas válidas e ignoradas (sem gravar). `texto` usa o parser da inscrição rápida. */
/**
 * Prepara o lote. Numeração de `linha` (B6): primeiro as linhas do `texto` (número da linha colada,
 * contando as em branco), depois as de `atletas`, continuando a contagem; assim a linha de um
 * ignorado é única mesmo com `texto` e `atletas` juntos.
 * Repetido: mesmo nome já no banco ou repetido no lote. Se os dois lados têm data de nascimento e as
 * datas diferem, são pessoas diferentes (homônimos) e ambas entram.
 */
export function prepararLote(
  entrada: { atletas?: EntradaLote[]; texto?: string },
  existentes: Array<{ nome: string; dataNascimento?: string | Date | null }>,
) {
  const ignorados: LinhaIgnoradaLote[] = []
  const candidatos: Array<{ linha: number; nome: string; dataNascimento: string | null; numeroPreferido: number | null; posicao: string | null }> = []
  let linhasDoTexto = 0
  if (entrada.texto != null) {
    const lido = interpretarListaColada(entrada.texto)
    const linhas = String(entrada.texto).split(/\r?\n/)
    linhasDoTexto = linhas.length
    // Aceitas = linhas não vazias que o parser não ignorou, na mesma ordem.
    const ignoradasNoTexto = new Set(lido.ignoradas.map((item) => item.linha))
    const aceitas = linhas.map((texto, indice) => ({ texto, linha: indice + 1 })).filter((item) => item.texto.trim() && !ignoradasNoTexto.has(item.linha))
    lido.atletas.forEach((item, indice) => candidatos.push({ linha: aceitas[indice]?.linha ?? indice + 1, nome: item.nome, dataNascimento: null, numeroPreferido: null, posicao: null }))
    lido.ignoradas.forEach((item) => ignorados.push({ linha: item.linha, motivo: item.motivo }))
  }
  ;(entrada.atletas ?? []).forEach((item, indice) => {
    const nome = String(item.nome ?? '').replace(/\s+/g, ' ').trim()
    const linha = linhasDoTexto + indice + 1
    const numero = item.numero == null || item.numero === '' ? null : Number(item.numero)
    if (nome.length < 2 || !/[A-Za-zÀ-ɏ]/.test(nome)) return void ignorados.push({ linha, motivo: 'Sem nome reconhecível' })
    if (numero != null && (!Number.isInteger(numero) || numero < 0 || numero > 99)) {
      return void ignorados.push({ linha, motivo: 'Camisa deve ser de 0 a 99' })
    }
    candidatos.push({ linha, nome, dataNascimento: item.dataNascimento ?? null, numeroPreferido: numero, posicao: item.posicao ?? null })
  })

  const dia = (valor: unknown) => (valor ? String(valor instanceof Date ? valor.toISOString() : valor).slice(0, 10) : null)
  const vistos = new Map<string, Array<string | null>>()
  const registrar = (nome: string, nascimento: string | null) => {
    const chave = normalizarChaveNome(nome)
    vistos.set(chave, [...(vistos.get(chave) ?? []), nascimento])
  }
  const jaExiste = (nome: string, nascimento: string | null) =>
    (vistos.get(normalizarChaveNome(nome)) ?? []).some((outro) => !outro || !nascimento || outro === nascimento)
  existentes.forEach((item) => registrar(item.nome, dia(item.dataNascimento)))
  const novos: typeof candidatos = []
  for (const candidato of candidatos) {
    const nascimento = dia(candidato.dataNascimento)
    if (jaExiste(candidato.nome, nascimento)) {
      ignorados.push({ linha: candidato.linha, motivo: 'Já está no banco do time' })
      continue
    }
    registrar(candidato.nome, nascimento)
    novos.push(candidato)
  }
  ignorados.sort((a, b) => a.linha - b.linha)
  return { novos, ignorados }
}

/**
 * Lote ("colar lista"): Atleta.dataNascimento é obrigatória no banco, exceto para origem 'LOTE'.
 * Linhas sem data entram como LOTE e ficam com a pendência "falta nascimento" até o líder completar.
 * Se o banco ainda só conhece a origem 'MIGRACAO' (CHECK antigo, erro 23514), regrava com ela.
 */
export async function adicionarLote(usuarioId: string, clubeId: string, entrada: { atletas?: EntradaLote[]; texto?: string }) {
  const existentes = await listarAtletasDoClube(clubeId)
  const { novos, ignorados } = prepararLote(entrada, existentes)
  if (novos.length === 0) return { criados: [] as AtletaPublico[], ignorados }
  const montar = (origemSemData: string) => novos.map((item) => ({
    nome: item.nome,
    dataNascimento: item.dataNascimento,
    origem: item.dataNascimento ? 'APP' : origemSemData,
    criadoPor: usuarioId,
    ...(item.numeroPreferido != null ? { numeroPreferido: item.numeroPreferido } : {}),
    ...(item.posicao ? { posicao: item.posicao } : {}),
  }))
  let resposta = await inserirAtletas(montar('LOTE'))
  if (resposta.error && resposta.error.code === '23514') resposta = await inserirAtletas(montar('MIGRACAO'))
  const criados = (lerDados(resposta, 'criar atletas em lote') as any[] | null) ?? []
  const vinculo = await supabase.from('VinculoAtletaClube').insert(criados.map((item) => ({ clubeId, atletaId: item.id, status: 'ATIVO' })))
  if (vinculo.error) {
    await supabase.from('Atleta').delete().in('id', criados.map((item) => item.id))
    lerDados(vinculo, 'vincular atletas')
  }
  return { criados: criados.map((linha) => paraAtleta(linha)), ignorados }
}

export async function editarAtleta(
  clubeId: string,
  atletaId: string,
  entrada: { nome?: string; dataNascimento?: string; numeroPreferido?: number | null; posicao?: string | null } & AutorizacaoResponsavel,
  usuarioId = '',
): Promise<AtletaPublico> {
  const atual = await exigirAtletaDoClube(clubeId, atletaId)
  const nome = entrada.nome ?? atual.nome
  const nascimento = entrada.dataNascimento ?? (atual.dataNascimento ? String(atual.dataNascimento).slice(0, 10) : null)
  const menor = ehMenorDeIdade(nascimento)
  exigirResponsavelCoerente(menor, entrada)
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
  if (menor && entrada.responsavel && entrada.aceiteResponsavel) {
    await registrarConsentimento(usuarioId, atletaId, entrada.responsavel)
  }
  return paraAtleta(linha, await idsComConsentimento([linha]))
}

/**
 * Pedido de exclusão do atleta: anonimiza a PII (cpf, documento, foto, contato do responsável), registra o
 * pedido (quem, quando, motivo) e tira o atleta do banco do time. O histórico de jogos e as cópias em
 * inscrições permanecem (ver src/lib/lgpd/consentimento.ts).
 */
export async function removerAtleta(usuarioId: string, clubeId: string, atletaId: string, motivo: string | null = null) {
  await exigirAtletaDoClube(clubeId, atletaId)
  return anonimizarAtleta(usuarioId, clubeId, atletaId, motivo)
}

// --- Acesso à equipe (contas) -------------------------------------------------

/** Conta com acesso à equipe. Não é a comissão técnica da súmula (essa é "ComissaoTime"). */
export type MembroAcesso = { id: string; nome: string; papel: PapelEquipe }

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

export async function listarMembros(timeId: string): Promise<MembroAcesso[]> {
  const membros = (lerDados(
    await supabase.from('MembroEquipe').select('usuarioId,papel').eq('timeId', timeId),
    'membros da equipe',
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

export const MENSAGEM_MEMBRO_UNIFORME = 'Pedido recebido. Se houver uma conta com esse e-mail, a pessoa passa a ter acesso à equipe.'

/**
 * Resposta uniforme (M10): a rota não revela se o e-mail tem conta, nem devolve id ou nome.
 * Conta inexistente e pessoa que já é membro terminam sem erro e sem diferença visível.
 * Devolve `adicionado` só para auditoria interna; a rota nunca o expõe.
 */
export async function adicionarMembro(timeId: string, entrada: { email: string; papel: 'TECNICO' | 'ASSISTENTE' }) {
  const usuarioId = await acharContaPorEmail(entrada.email)
  if (!usuarioId) return { adicionado: false }
  const resposta = await supabase.from('MembroEquipe').insert({ timeId, usuarioId, papel: entrada.papel })
  if (violacaoUnica(resposta.error)) return { adicionado: false }
  lerDados(resposta, 'adicionar membro')
  return { adicionado: true }
}

export async function removerMembro(timeId: string, membroId: string) {
  const membros = await listarMembros(timeId)
  const alvo = membros.find((item) => item.id === membroId)
  if (!alvo) throw new ErroMeuTime('Membro não encontrado.', 404, 'MEMBRO_NAO_ENCONTRADO')
  if (alvo.papel === 'RESPONSAVEL') {
    throw new ErroMeuTime('O responsável pela equipe não pode ser removido.', 409, 'RESPONSAVEL_FIXO')
  }
  lerDados(await supabase.from('MembroEquipe').delete().eq('timeId', timeId).eq('usuarioId', membroId), 'remover membro')
}

// --- Comissão técnica (nome + função, tabela "ComissaoTime") -----------------

export const FUNCOES_COMISSAO = ['TECNICO', 'ASSISTENTE', 'PREPARADOR_FISICO', 'FISIOTERAPEUTA', 'MEDICO'] as const
export type FuncaoComissao = (typeof FUNCOES_COMISSAO)[number]
export type MembroComissao = { id: string; nome: string; funcao: FuncaoComissao }

function paraMembroComissao(linha: any): MembroComissao {
  return { id: linha.id, nome: linha.nome, funcao: linha.funcao }
}

export async function listarComissao(timeId: string): Promise<MembroComissao[]> {
  const linhas = (lerDados(
    await supabase.from('ComissaoTime').select('id,nome,funcao').eq('timeId', timeId).order('nome', { ascending: true }),
    'comissão técnica',
  ) as any[] | null) ?? []
  return linhas.map(paraMembroComissao)
}

/** Igual a listarComissao, mas devolve [] se a tabela ainda não existe (telas de leitura não caem por isso). */
export async function listarComissaoTolerante(timeId: string): Promise<MembroComissao[]> {
  try {
    return await listarComissao(timeId)
  } catch (erro) {
    if (erro instanceof ErroMeuTime && erro.status === 503) return []
    throw erro
  }
}

export async function adicionarComissao(timeId: string, entrada: { nome: string; funcao: FuncaoComissao }): Promise<MembroComissao> {
  const existentes = await listarComissao(timeId)
  const chave = normalizarChaveNome(entrada.nome)
  if (existentes.some((item) => item.funcao === entrada.funcao && normalizarChaveNome(item.nome) === chave)) {
    throw new ErroMeuTime('Essa pessoa já está na comissão técnica com essa função.', 409, 'COMISSAO_DUPLICADA')
  }
  const criado = lerDados(
    await supabase.from('ComissaoTime').insert({ timeId, nome: entrada.nome, funcao: entrada.funcao }).select('id,nome,funcao').single(),
    'adicionar à comissão técnica',
  )
  if (!criado) throw new ErroMeuTime('Não foi possível adicionar à comissão técnica.', 500)
  return paraMembroComissao(criado)
}

export async function removerComissao(timeId: string, membroId: string) {
  const naoEncontrado = () => new ErroMeuTime('Membro da comissão não encontrado.', 404, 'MEMBRO_NAO_ENCONTRADO')
  if (!idValido(membroId)) throw naoEncontrado()
  const achado = lerDados(
    await supabase.from('ComissaoTime').select('id').eq('id', membroId).eq('timeId', timeId).maybeSingle(),
    'membro da comissão',
  )
  if (!achado) throw naoEncontrado()
  lerDados(await supabase.from('ComissaoTime').delete().eq('id', membroId).eq('timeId', timeId).select('id'), 'remover da comissão técnica')
}

// --- Dados do time -------------------------------------------------------------

export async function editarEquipe(
  timeId: string,
  entrada: { nome?: string; cidade?: string | null; escudoUrl?: string | null },
): Promise<EquipeBanco> {
  const campos: Record<string, unknown> = {}
  if (entrada.nome !== undefined) campos.nome = entrada.nome
  if (entrada.cidade !== undefined) campos.cidade = entrada.cidade || null
  if (entrada.escudoUrl !== undefined) campos.escudoUrl = entrada.escudoUrl || null
  const resposta = await supabase
    .from('TimeClube')
    .update(campos)
    .eq('id', timeId)
    .is('arquivadoEm', null)
    .select('id,clubeId,nome,cidade,naipe,escudoUrl')
    .single()
  if (violacaoUnica(resposta.error)) {
    throw new ErroMeuTime('Você já tem uma equipe com esse nome e naipe.', 409, 'EQUIPE_DUPLICADA')
  }
  const linha = lerDados(resposta, 'editar equipe')
  if (!linha) throw new ErroMeuTime('Equipe não encontrada.', 404, 'EQUIPE_NAO_ENCONTRADA')
  return paraEquipe(linha)
}
