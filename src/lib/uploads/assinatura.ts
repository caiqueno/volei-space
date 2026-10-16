import { supabaseAdmin } from '@/lib/supabase-admin'
import { TIPOS_UPLOAD, VALIDADE_LEITURA_SEGUNDOS, type TipoUpload } from '@/lib/uploads/config'

// Chamadas ao Storage com a chave de serviço. Só o servidor chega aqui; o navegador
// recebe apenas a URL/token assinados que saem destas funções.

export type UploadAssinado = {
  bucket: string
  caminho: string
  /** Token para storage.from(bucket).uploadToSignedUrl(caminho, token, arquivo). */
  token: string
  urlAssinada: string
  /** Só em bucket público: a URL que o arquivo terá depois do envio. */
  urlPublica: string | null
}

/** A URL assinada de envio vale 2 horas (padrão do Storage) e só grava neste caminho, sem sobrescrever. */
export async function assinarEnvio(tipo: TipoUpload, caminho: string): Promise<UploadAssinado> {
  const config = TIPOS_UPLOAD[tipo]
  const bucket = supabaseAdmin.storage.from(config.bucket)
  const { data, error } = await bucket.createSignedUploadUrl(caminho)
  if (error || !data) throw new Error(error?.message ?? 'Não foi possível assinar o envio.')
  return {
    bucket: config.bucket,
    caminho,
    token: data.token,
    urlAssinada: data.signedUrl,
    urlPublica: config.privado ? null : bucket.getPublicUrl(caminho).data.publicUrl,
  }
}

export async function assinarLeitura(bucket: string, caminho: string, segundos = VALIDADE_LEITURA_SEGUNDOS) {
  const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUrl(caminho, segundos)
  if (error || !data?.signedUrl) return null
  return { url: data.signedUrl, expiraEm: new Date(Date.now() + segundos * 1000).toISOString() }
}
