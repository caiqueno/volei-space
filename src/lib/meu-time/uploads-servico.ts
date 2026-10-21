// Serviço dos uploads do Meu Time (R17): assinar, confirmar e ler o documento por URL assinada de 60 s.
// Posse sempre pelo banco: líder/técnico precisa ser membro da equipe com permissão de escrita, e o atleta precisa
// estar no banco do clube dessa equipe. Quem não tem posse recebe 404 (a equipe/atleta "não existe" para ele).
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ErroMeuTime, idValido, lerDados } from '@/lib/meu-time/acesso'
import { exigirAtletaDoClube, exigirEquipe, type EquipeBanco } from '@/lib/meu-time/dados'
import { indisponivelElenco, lerElenco } from '@/lib/meu-time/elenco'
import { assinarComprovante, confirmarComprovante } from '@/lib/pagamento-comprovante/comprovante'
import {
  CONFIG_MEU_TIME,
  ErroStorageMeuTime,
  TIPOS_UPLOAD_MEU_TIME,
  assinarEnvioMeuTime,
  assinarLeituraDocumento,
  caminhoPertenceAoDono,
  conferirObjetoReal,
  extensaoDoCaminhoPermitida,
  lerObjetoReal,
  montarCaminhoMeuTime,
  removerObjeto,
  urlPublicaMeuTime,
  validarEnvioMeuTime,
  type TipoUploadMeuTime,
} from '@/lib/uploads/meu-time'

const db = supabaseAdmin as any

const identificador = z.string().trim().min(1).max(64)

export const assinarUploadSchema = z.object({
  equipeId: identificador,
  atletaId: identificador.optional(),
  /** Só para tipo COMPROVANTE (R19): a inscrição da equipe cujo pagamento recebe o comprovante. */
  inscricaoId: identificador.optional(),
  tipo: z.enum(TIPOS_UPLOAD_MEU_TIME),
  nomeArquivo: z.string().max(400),
  contentType: z.string().max(100),
  tamanho: z.number().int().positive(),
})

export const confirmarUploadSchema = z.object({
  equipeId: identificador,
  atletaId: identificador.optional(),
  inscricaoId: identificador.optional(),
  tipo: z.enum(TIPOS_UPLOAD_MEU_TIME),
  path: z.string().max(200),
})

type Alvo = { equipe: EquipeBanco; donoId: string }

/** Resolve o dono do arquivo pelo banco: o time (escudo) ou o atleta do banco do time (foto e documento). */
async function resolverAlvo(usuarioId: string, entrada: { equipeId: string; atletaId?: string; tipo: TipoUploadMeuTime }): Promise<Alvo> {
  const { equipe } = await exigirEquipe(usuarioId, entrada.equipeId, 'escrita')
  if (CONFIG_MEU_TIME[entrada.tipo].alvo === 'time') {
    if (entrada.atletaId) throw new ErroMeuTime('Escudo não leva "atletaId".', 422, 'DADOS_INVALIDOS')
    return { equipe, donoId: equipe.id }
  }
  if (!entrada.atletaId) throw new ErroMeuTime('Informe "atletaId" para este envio.', 422, 'DADOS_INVALIDOS')
  const atleta = await exigirAtletaDoClube(equipe.clubeId, entrada.atletaId)
  return { equipe, donoId: String(atleta.id) }
}

function erroDeStorage(erro: unknown): never {
  if (erro instanceof ErroStorageMeuTime) {
    if (erro.bucketAusente) throw indisponivelElenco()
    throw new ErroMeuTime('Não foi possível falar com o armazenamento de arquivos. Tente novamente.', 502, 'STORAGE_INDISPONIVEL')
  }
  throw erro
}

export async function assinarUpload(usuarioId: string, entrada: z.infer<typeof assinarUploadSchema>) {
  // R19: comprovante de pagamento tem dono e regras próprias (flag PAGAMENTO_COMPROVANTE_ATIVO).
  if (entrada.tipo === 'COMPROVANTE') {
    if (entrada.atletaId) throw new ErroMeuTime('Comprovante não leva "atletaId".', 422, 'DADOS_INVALIDOS')
    return assinarComprovante(usuarioId, entrada)
  }
  const validacao = validarEnvioMeuTime(entrada)
  if (!validacao.ok) throw new ErroMeuTime(validacao.erro, validacao.status, 'ARQUIVO_INVALIDO')
  const { donoId } = await resolverAlvo(usuarioId, entrada)
  const caminho = montarCaminhoMeuTime(donoId, validacao.extensao)
  try {
    return await assinarEnvioMeuTime(entrada.tipo, caminho)
  } catch (erro) {
    return erroDeStorage(erro)
  }
}

// O documento fica em "AtletaDocumento" (1:1, chave atletaId, upsert); foto e escudo, na própria linha.
const COLUNAS_GRAVACAO: Record<Exclude<TipoUploadMeuTime, 'COMPROVANTE'>, { tabela: 'TimeClube' | 'Atleta' | 'AtletaDocumento'; chave: string; caminho: string; data: string | null }> = {
  ESCUDO: { tabela: 'TimeClube', chave: 'id', caminho: 'escudoPath', data: null },
  FOTO_ROSTO: { tabela: 'Atleta', chave: 'id', caminho: 'fotoRostoPath', data: 'fotoRostoEnviadaEm' },
  DOCUMENTO: { tabela: 'AtletaDocumento', chave: 'atletaId', caminho: 'documentoPath', data: 'documentoEnviadoEm' },
}

export async function confirmarUpload(usuarioId: string, entrada: z.infer<typeof confirmarUploadSchema>) {
  if (entrada.tipo === 'COMPROVANTE') {
    if (entrada.atletaId) throw new ErroMeuTime('Comprovante não leva "atletaId".', 422, 'DADOS_INVALIDOS')
    return confirmarComprovante(usuarioId, entrada)
  }
  const { donoId } = await resolverAlvo(usuarioId, entrada)
  const tipo = entrada.tipo
  if (!caminhoPertenceAoDono(entrada.path, donoId) || !extensaoDoCaminhoPermitida(tipo, entrada.path)) {
    throw new ErroMeuTime('Caminho do arquivo inválido para este envio.', 422, 'CAMINHO_INVALIDO')
  }
  const alvo = COLUNAS_GRAVACAO[tipo]
  const atual = lerElenco(
    await db.from(alvo.tabela).select(alvo.caminho).eq(alvo.chave, donoId).maybeSingle(),
    'caminho atual do arquivo',
  ) as Record<string, string | null> | null
  // Atleta/time já foi resolvido pela posse; só o documento pode ainda não ter linha em AtletaDocumento.
  if (!atual && tipo !== 'DOCUMENTO') throw new ErroMeuTime('Registro não encontrado.', 404, 'NAO_ENCONTRADO')
  const anterior = atual?.[alvo.caminho] ?? null

  let real
  try {
    real = await lerObjetoReal(tipo, entrada.path)
  } catch (erro) {
    return erroDeStorage(erro)
  }
  if (!real) throw new ErroMeuTime('O arquivo ainda não foi enviado.', 409, 'ARQUIVO_NAO_ENVIADO')
  const conferencia = conferirObjetoReal(tipo, entrada.path, real)
  if (!conferencia.ok) {
    // Arquivo fora da regra não fica no bucket: apaga e não grava nada.
    if (entrada.path !== anterior) await removerObjeto(tipo, entrada.path)
    throw new ErroMeuTime(conferencia.erro, conferencia.status, 'ARQUIVO_INVALIDO')
  }

  const enviadoEm = new Date().toISOString()
  const campos: Record<string, unknown> = { [alvo.caminho]: entrada.path }
  if (alvo.data) campos[alvo.data] = enviadoEm
  const url = urlPublicaMeuTime(tipo, entrada.path)
  if (tipo === 'ESCUDO' && url) campos.escudoUrl = url
  if (entrada.path !== anterior) {
    if (tipo === 'DOCUMENTO') {
      lerElenco(await db.from('AtletaDocumento').upsert({ atletaId: donoId, ...campos, atualizadoEm: enviadoEm }, { onConflict: 'atletaId' }), 'gravar caminho do documento')
    } else {
      lerElenco(await db.from(alvo.tabela).update(campos).eq('id', donoId).select('id'), 'gravar caminho do arquivo')
    }
    if (anterior) await removerObjeto(tipo, anterior)
  }
  // Documento nunca devolve URL (bucket privado: só a rota de leitura assinada).
  return { tipo, path: entrada.path, enviadoEm, ...(CONFIG_MEU_TIME[tipo].publico && url ? { url } : {}) }
}

async function assinarDocumentoDoAtleta(atletaId: string) {
  const linha = lerElenco(
    await db.from('AtletaDocumento').select('atletaId,documentoPath').eq('atletaId', atletaId).maybeSingle(),
    'documento do atleta',
  ) as { atletaId: string; documentoPath: string | null } | null
  const caminho = linha?.documentoPath
  if (!linha || !caminho || !caminhoPertenceAoDono(caminho, String(linha.atletaId))) {
    throw new ErroMeuTime('Documento não encontrado.', 404, 'DOCUMENTO_NAO_ENCONTRADO')
  }
  try {
    const assinado = await assinarLeituraDocumento(caminho)
    if (!assinado) throw new ErroMeuTime('Documento não encontrado.', 404, 'DOCUMENTO_NAO_ENCONTRADO')
    return assinado
  } catch (erro) {
    return erroDeStorage(erro)
  }
}

const naoEncontrado = () => new ErroMeuTime('Atleta não encontrado.', 404, 'ATLETA_NAO_ENCONTRADO')

/** Líder/técnico: só de atleta que esteja no banco de um clube em que ele tem papel de escrita numa equipe. */
export async function urlDocumentoParaLider(usuarioId: string, atletaId: string) {
  if (!idValido(atletaId)) throw naoEncontrado()
  const membros = (lerDados(
    await db.from('MembroEquipe').select('timeId,papel').eq('usuarioId', usuarioId),
    'equipes do usuário',
  ) as Array<{ timeId: string; papel: string }> | null) ?? []
  const timeIds = membros.filter((item) => item.papel === 'RESPONSAVEL' || item.papel === 'TECNICO').map((item) => item.timeId)
  if (timeIds.length === 0) throw naoEncontrado()
  const times = (lerDados(
    await db.from('TimeClube').select('id,clubeId').in('id', timeIds).is('arquivadoEm', null),
    'times do usuário',
  ) as Array<{ clubeId: string }> | null) ?? []
  const clubes = Array.from(new Set(times.map((item) => item.clubeId)))
  if (clubes.length === 0) throw naoEncontrado()
  const vinculo = (lerDados(
    await db.from('VinculoAtletaClube').select('atletaId').eq('atletaId', atletaId).eq('status', 'ATIVO').in('clubeId', clubes),
    'vínculo do atleta',
  ) as Array<{ atletaId: string }> | null) ?? []
  if (vinculo.length === 0) throw naoEncontrado()
  return assinarDocumentoDoAtleta(atletaId)
}

/** Organizador: só se o atleta estiver (ativo) numa inscrição de campeonato dele. Qualquer outro caso = 404. */
export async function urlDocumentoParaOrganizador(organizadorId: string, inscricaoId: string, atletaId: string) {
  if (!idValido(inscricaoId) || !idValido(atletaId)) throw naoEncontrado()
  const inscricao = lerDados(
    await db.from('Inscricao').select('id,ligaId,status').eq('id', inscricaoId).maybeSingle(),
    'inscrição',
  ) as { id: string; ligaId: number; status: string } | null
  if (!inscricao || inscricao.status === 'REMOVIDA') throw naoEncontrado()
  const liga = lerDados(
    await db.from('Liga').select('id,organizadorId').eq('id', inscricao.ligaId).maybeSingle(),
    'campeonato da inscrição',
  ) as { organizadorId: string | null } | null
  if (!liga || String(liga.organizadorId ?? '') !== organizadorId) throw naoEncontrado()
  const copia = (lerDados(
    await db.from('InscricaoAtleta').select('atletaId').eq('inscricaoId', inscricaoId).eq('atletaId', atletaId).eq('ativo', true),
    'atleta da inscrição',
  ) as Array<{ atletaId: string }> | null) ?? []
  if (copia.length === 0) throw naoEncontrado()
  return assinarDocumentoDoAtleta(atletaId)
}
