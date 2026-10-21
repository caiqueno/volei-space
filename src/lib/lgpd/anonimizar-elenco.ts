// Pedido de exclusão (R17): limpa foto de rosto ("Atleta") e documento ("AtletaDocumento") e apaga os arquivos dos
// buckets. Os valores cifrados (CPF, documento, telefones) saem junto com a linha de AtletaDocumento, que o
// pedido de exclusão apaga logo em seguida. Tolerante: coluna ou tabela ausente = nada a limpar.
import { supabaseAdmin } from '@/lib/supabase-admin'

const db = supabaseAdmin as any

const BUCKET_FOTO = 'atleta-foto-rosto'
const BUCKET_DOCUMENTO = 'atleta-documento'

export async function limparDadosDeElenco(atletaId: string): Promise<{ limpo: boolean }> {
  try {
    let foto: string | null = null
    let documento: string | null = null
    const fotoLida = await db.from('Atleta').select('fotoRostoPath').eq('id', atletaId).maybeSingle()
    if (!fotoLida.error) foto = (fotoLida.data as { fotoRostoPath?: string | null } | null)?.fotoRostoPath ?? null
    const docLido = await db.from('AtletaDocumento').select('documentoPath').eq('atletaId', atletaId).maybeSingle()
    if (!docLido.error) documento = (docLido.data as { documentoPath?: string | null } | null)?.documentoPath ?? null

    let limpo = true
    if (!fotoLida.error) {
      const limpa = await db.from('Atleta').update({ fotoRostoPath: null, fotoRostoEnviadaEm: null, atualizadoEm: new Date().toISOString() }).eq('id', atletaId).select('id')
      if (limpa.error) {
        console.error('[lgpd] não foi possível limpar a foto do atleta', limpa.error.code ?? '')
        limpo = false
      }
    }
    if (foto) await db.storage.from(BUCKET_FOTO).remove([foto])
    if (documento) await db.storage.from(BUCKET_DOCUMENTO).remove([documento])
    return { limpo }
  } catch {
    console.error('[lgpd] falha ao limpar os dados de elenco do atleta; revisar manualmente')
    return { limpo: false }
  }
}
