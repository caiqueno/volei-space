// Utilitário de navegador para o envio assinado de arquivos da equipe (docs/analise/21).
// Fluxo: POST /api/uploads/assinar -> PUT do arquivo na URL assinada -> usar o caminho devolvido.
// Não importa o client anon do Supabase. As mensagens de erro são feitas para o usuário final.

export type TipoUploadCliente = 'atleta-documento' | 'atleta-foto-rosto' | 'equipe-emblema'

export type ResultadoEnvio = {
  bucket: string
  caminho: string
  /** URL pública do arquivo (só buckets públicos: foto de rosto e emblema). */
  urlPublica: string | null
  /**
   * Valor a gravar no cadastro. Bucket público: a URL pública. Bucket privado (documento):
   * URL do objeto sem token, que não dá acesso; a leitura passa por /api/uploads/documento.
   */
  referencia: string
}

export class ErroUpload extends Error {
  readonly status: number
  constructor(mensagem: string, status = 0) {
    super(mensagem)
    this.name = 'ErroUpload'
    this.status = status
  }
}

type FetchLike = (entrada: string, init?: RequestInit) => Promise<Response>

type Opcoes = {
  fetchImpl?: FetchLike
}

const MSG_GENERICA = 'Não foi possível enviar o arquivo. Tente novamente em instantes.'
const MSG_REDE = 'Sem conexão para enviar o arquivo. Verifique a internet e tente de novo.'

async function lerJson(resposta: Response): Promise<{ data?: Record<string, unknown>; error?: string }> {
  try {
    return await resposta.json()
  } catch {
    return {}
  }
}

/** Mensagem amigável para uma falha da rota de assinatura. Só repassa o texto do servidor quando ele é seguro. */
export function mensagemDeFalha(status: number, textoServidor?: string): string {
  if (status === 401) return 'Sua sessão expirou. Entre de novo para enviar arquivos.'
  if (status === 403) return 'Você não tem permissão para enviar arquivos desta equipe.'
  if (status === 413) return textoServidor || 'O arquivo é maior que o permitido.'
  if (status === 415) return 'Tipo de arquivo não permitido. Use imagem (JPG, PNG ou WebP) ou PDF quando for documento.'
  if (status === 429) return 'Muitos envios em pouco tempo. Aguarde um pouco e tente de novo.'
  if (status === 404) return 'Equipe não encontrada para este envio.'
  return MSG_GENERICA
}

/** Referência gravável para objeto privado: URL do objeto sem token (a rota de leitura reconhece este formato). */
export function referenciaPrivada(urlAssinada: string, bucket: string, caminho: string): string | null {
  try {
    const origem = new URL(urlAssinada).origin
    return `${origem}/storage/v1/object/sign/${bucket}/${caminho}`
  } catch {
    return null
  }
}

export async function enviarArquivoAssinado(
  entrada: { tipo: TipoUploadCliente; equipeId: number; arquivo: Blob & { type: string; size: number } },
  opcoes: Opcoes = {},
): Promise<ResultadoEnvio> {
  const chamar: FetchLike = opcoes.fetchImpl ?? ((url, init) => fetch(url, init))
  const { tipo, equipeId, arquivo } = entrada

  let resposta: Response
  try {
    resposta = await chamar('/api/uploads/assinar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo, equipeId, mime: arquivo.type, tamanho: arquivo.size }),
    })
  } catch {
    throw new ErroUpload(MSG_REDE)
  }
  const json = await lerJson(resposta)
  const dados = json.data as { bucket?: string; caminho?: string; urlAssinada?: string; urlPublica?: string | null; mime?: string } | undefined
  if (!resposta.ok || !dados?.bucket || !dados.caminho || !dados.urlAssinada) {
    throw new ErroUpload(mensagemDeFalha(resposta.status, resposta.status === 413 ? json.error : undefined), resposta.status)
  }

  const corpo = new FormData()
  corpo.append('cacheControl', '3600')
  corpo.append('', arquivo)
  let envio: Response
  try {
    envio = await chamar(dados.urlAssinada, {
      method: 'PUT',
      headers: { 'x-upsert': 'false' },
      body: corpo,
    })
  } catch {
    throw new ErroUpload(MSG_REDE)
  }
  if (!envio.ok) throw new ErroUpload(MSG_GENERICA, envio.status)

  const urlPublica = dados.urlPublica ?? null
  const referencia = urlPublica ?? referenciaPrivada(dados.urlAssinada, dados.bucket, dados.caminho)
  if (!referencia) throw new ErroUpload(MSG_GENERICA)
  return { bucket: dados.bucket, caminho: dados.caminho, urlPublica, referencia }
}

/** URL assinada de curta duração (120 s) para abrir um documento privado de atleta. */
export async function obterUrlDocumento(
  alvo: { caminho: string } | { jogadorId: number; indice: number },
  opcoes: Opcoes = {},
): Promise<string> {
  const chamar: FetchLike = opcoes.fetchImpl ?? ((url, init) => fetch(url, init))
  const consulta = new URLSearchParams(
    'caminho' in alvo ? { caminho: alvo.caminho } : { jogadorId: String(alvo.jogadorId), indice: String(alvo.indice) },
  )
  let resposta: Response
  try {
    resposta = await chamar(`/api/uploads/documento?${consulta.toString()}`, { cache: 'no-store' })
  } catch {
    throw new ErroUpload(MSG_REDE)
  }
  const json = await lerJson(resposta)
  const url = (json.data as { url?: string } | undefined)?.url
  if (!resposta.ok || !url) {
    throw new ErroUpload(
      resposta.status === 404 ? 'Documento não encontrado.' : resposta.status === 401 || resposta.status === 403
        ? 'Você não tem permissão para abrir este documento.'
        : 'Não foi possível abrir o documento agora. Tente novamente.',
      resposta.status,
    )
  }
  return url
}
