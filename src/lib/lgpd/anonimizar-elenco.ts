// Pedido de exclusão (R17): limpa os dados pessoais das colunas novas de "Atleta" (CPF, documento, telefones cifrados,
// caminhos de foto e documento) e apaga os arquivos dos buckets. Tolerante: se as colunas da migration ainda não
// existem neste banco, não há nada a limpar e a exclusão segue pelo caminho antigo.
import { supabaseAdmin } from '@/lib/supabase-admin'

const db = supabaseAdmin as any

const BUCKET_FOTO = 'atleta-foto-rosto'
const BUCKET_DOCUMENTO = 'atleta-documento'

export async function limparDadosDeElenco(atletaId: string): Promise<{ limpo: boolean }> {
  try {
    const lida = await db.from('Atleta').select('fotoRostoPath,documentoPath').eq('id', atletaId).maybeSingle()
    if (lida.error) return { limpo: false }
    const foto = (lida.data as { fotoRostoPath?: string | null } | null)?.fotoRostoPath ?? null
    const documento = (lida.data as { documentoPath?: string | null } | null)?.documentoPath ?? null

    const agora = new Date().toISOString()
    const limpa = await db
      .from('Atleta')
      .update({
        cpfCifrado: null,
        cpfHash: null,
        documentoTipo: null,
        documentoHash: null,
        documentoNumeroCifrado: null,
        telefoneCifrado: null,
        telefoneEmergenciaCifrado: null,
        fotoRostoPath: null,
        documentoPath: null,
        fotoRostoEnviadaEm: null,
        documentoEnviadoEm: null,
        atualizadoEm: agora,
      })
      .eq('id', atletaId)
      .select('id')
    if (limpa.error) {
      console.error('[lgpd] não foi possível limpar os dados de elenco do atleta', limpa.error.code ?? '')
      return { limpo: false }
    }
    if (foto) await db.storage.from(BUCKET_FOTO).remove([foto])
    if (documento) await db.storage.from(BUCKET_DOCUMENTO).remove([documento])
    return { limpo: true }
  } catch {
    console.error('[lgpd] falha ao limpar os dados de elenco do atleta; revisar manualmente')
    return { limpo: false }
  }
}
