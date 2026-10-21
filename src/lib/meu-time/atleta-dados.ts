// Dados pessoais do atleta (R17): CPF, documento e telefones. Tudo é validado e cifrado no servidor
// (cifrarContato, AES-256-GCM); o CPF também gera um hash HMAC com sal do servidor para bloquear duplicidade
// no mesmo time. O valor em claro nunca é gravado, logado nem devolvido: as leituras só trazem máscara.
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { cifrarContato } from '@/lib/lgpd/cifra'
import {
  hashCpf,
  hashDocumento,
  normalizarDocumentoNumero,
  normalizarTelefone,
  soDigitos,
} from '@/lib/lgpd/documentos'
import { ErroMeuTime, violacaoUnica } from '@/lib/meu-time/acesso'
import {
  editarAtleta,
  exigirAtletaDoClube,
  idsComConsentimento,
  listarAtletasDoClube,
  paraAtleta,
  type AtletaPublico,
} from '@/lib/meu-time/dados'
import { lerElenco, recursoElencoAusente, indisponivelElenco } from '@/lib/meu-time/elenco'
import { CAMPOS_SENSIVEIS_ATLETA, editarAtletaElencoSchema } from '@/lib/meu-time/schemas'

const db = supabaseAdmin as any

type EntradaElenco = z.infer<typeof editarAtletaElencoSchema>

const COLUNAS_PII = 'id,cpfCifrado,cpfHash,documentoTipo,documentoHash,documentoNumeroCifrado,telefoneCifrado,telefoneEmergenciaCifrado'

/**
 * Edita o atleta com os dados pessoais. Ordem pensada para não deixar a ficha pela metade:
 * 1) valida e cifra tudo (falha de chave = 503 antes de tocar no banco);
 * 2) confere as colunas novas e a duplicidade de CPF no time (409 CPF_DUPLICADO);
 * 3) grava os campos comuns (nome, nascimento...) e, por último, os dados pessoais.
 */
export async function editarAtletaCompleto(
  clubeId: string,
  atletaId: string,
  entrada: EntradaElenco,
  usuarioId: string,
): Promise<AtletaPublico> {
  await exigirAtletaDoClube(clubeId, atletaId)
  const sensiveis: Record<string, unknown> = {}
  const comuns: Record<string, unknown> = {}
  for (const [chave, valor] of Object.entries(entrada)) {
    if (valor === undefined) continue
    if ((CAMPOS_SENSIVEIS_ATLETA as string[]).includes(chave)) sensiveis[chave] = valor
    else comuns[chave] = valor
  }

  let colunas: Record<string, unknown> | null = null
  if (Object.keys(sensiveis).length > 0) {
    colunas = prepararColunas(entrada)
    // As colunas novas existem neste banco? Se não, 503 antes de gravar qualquer coisa.
    lerElenco(await db.from('Atleta').select(COLUNAS_PII).eq('id', atletaId).maybeSingle(), 'conferir colunas de dados pessoais')
    if (typeof colunas.cpfHash === 'string') {
      const outros = (await listarAtletasDoClube(clubeId)).filter((linha) => linha.id !== atletaId)
      if (outros.some((linha) => linha.cpfHash && linha.cpfHash === colunas!.cpfHash)) {
        throw new ErroMeuTime('Já existe um atleta com este CPF no time.', 409, 'CPF_DUPLICADO')
      }
    }
  }

  if (Object.keys(comuns).length > 0) {
    await editarAtleta(clubeId, atletaId, comuns as any, usuarioId)
  }

  if (colunas) {
    const gravado = await db
      .from('Atleta')
      .update({ ...colunas, atualizadoEm: new Date().toISOString() })
      .eq('id', atletaId)
      .select('id')
    if (gravado.error) {
      if (violacaoUnica(gravado.error)) {
        const texto = `${gravado.error.message ?? ''} ${gravado.error.details ?? ''}`
        throw /documento/i.test(texto)
          ? new ErroMeuTime('Este documento já está cadastrado.', 409, 'DOCUMENTO_DUPLICADO')
          : new ErroMeuTime('Já existe um atleta com este CPF.', 409, 'CPF_DUPLICADO')
      }
      if (recursoElencoAusente(gravado.error)) throw indisponivelElenco()
      console.error('[elenco] gravar dados pessoais do atleta', gravado.error.code ?? '')
      throw new ErroMeuTime('Não foi possível concluir a operação. Tente novamente.', 500)
    }
  }

  const linha = await exigirAtletaDoClube(clubeId, atletaId)
  return paraAtleta(linha, await idsComConsentimento([linha]))
}

/** Valores já normalizados e cifrados, prontos para o UPDATE. `null` apaga a coluna e o hash correspondente. */
function prepararColunas(entrada: EntradaElenco): Record<string, unknown> {
  const colunas: Record<string, unknown> = {}
  if (entrada.cpf !== undefined) {
    if (entrada.cpf === null) {
      colunas.cpfCifrado = null
      colunas.cpfHash = null
    } else {
      const digitos = soDigitos(entrada.cpf)
      colunas.cpfHash = hashCpf(digitos)
      colunas.cpfCifrado = cifrarContato(digitos)
    }
  }
  if (entrada.documentoTipo !== undefined) {
    if (entrada.documentoTipo === null || entrada.documentoNumero == null) {
      colunas.documentoTipo = null
      colunas.documentoHash = null
      colunas.documentoNumeroCifrado = null
    } else {
      const numero = normalizarDocumentoNumero(entrada.documentoNumero)
      if (!numero) throw new ErroMeuTime('Número de documento inválido.', 422, 'DADOS_INVALIDOS')
      colunas.documentoTipo = entrada.documentoTipo
      colunas.documentoHash = hashDocumento(entrada.documentoTipo, numero)
      colunas.documentoNumeroCifrado = cifrarContato(numero)
    }
  }
  for (const [campo, coluna] of [['telefone', 'telefoneCifrado'], ['telefoneEmergencia', 'telefoneEmergenciaCifrado']] as const) {
    const valor = entrada[campo]
    if (valor === undefined) continue
    if (valor === null) colunas[coluna] = null
    else {
      const normalizado = normalizarTelefone(valor)
      if (!normalizado) throw new ErroMeuTime('Telefone inválido. Use DDD + número.', 422, 'DADOS_INVALIDOS')
      colunas[coluna] = cifrarContato(normalizado)
    }
  }
  return colunas
}
