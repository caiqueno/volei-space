// Dados do time (R17): CNPJ, contato e cores. O telefone de contato é cifrado; as leituras só trazem máscara.
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { cifrarContato } from '@/lib/lgpd/cifra'
import { formatarCnpj, mascararCifrado, mascararTelefone, normalizarTelefone, soDigitos } from '@/lib/lgpd/documentos'
import { ErroMeuTime } from '@/lib/meu-time/acesso'
import { recursoElencoAusente, indisponivelElenco, lerElenco } from '@/lib/meu-time/elenco'
import { CAMPOS_DADOS_TIME, editarEquipeElencoSchema } from '@/lib/meu-time/schemas'

const db = supabaseAdmin as any

const COLUNAS = 'cnpj,contatoEmail,contatoTelefoneCifrado,corPrimaria,corSecundaria,escudoPath'

export type DadosDoTime = {
  cnpj: string | null
  contatoEmail: string | null
  contatoTelefoneMascarado: string | null
  corPrimaria: string | null
  corSecundaria: string | null
  temEscudo: boolean
}

export function paraDadosDoTime(linha: any): DadosDoTime {
  return {
    cnpj: linha?.cnpj ? formatarCnpj(String(linha.cnpj)) : null,
    contatoEmail: linha?.contatoEmail ?? null,
    contatoTelefoneMascarado: mascararCifrado(linha?.contatoTelefoneCifrado, mascararTelefone),
    corPrimaria: linha?.corPrimaria ?? null,
    corSecundaria: linha?.corSecundaria ?? null,
    temEscudo: Boolean(linha?.escudoPath),
  }
}

/** Leitura tolerante (telas de leitura não caem por coluna ausente): sem as colunas novas devolve tudo vazio. */
export async function lerDadosDoTime(timeId: string): Promise<DadosDoTime> {
  const resposta = await db.from('TimeClube').select(COLUNAS).eq('id', timeId).maybeSingle()
  if (resposta.error) {
    if (recursoElencoAusente(resposta.error)) return paraDadosDoTime(null)
    console.error('[elenco] dados do time', resposta.error.code ?? '')
    throw new ErroMeuTime('Não foi possível concluir a operação. Tente novamente.', 500)
  }
  return paraDadosDoTime(resposta.data)
}

type EntradaTime = z.infer<typeof editarEquipeElencoSchema>

export function temCamposDoTime(entrada: EntradaTime) {
  return CAMPOS_DADOS_TIME.some((campo) => entrada[campo] !== undefined)
}

/** Confere que as colunas novas existem neste banco (503 se não), sem gravar. */
export async function conferirColunasDoTime(timeId: string) {
  lerElenco(await db.from('TimeClube').select(COLUNAS).eq('id', timeId).maybeSingle(), 'conferir colunas do time')
}

export async function gravarDadosDoTime(timeId: string, entrada: EntradaTime): Promise<DadosDoTime> {
  const campos: Record<string, unknown> = {}
  if (entrada.cnpj !== undefined) campos.cnpj = entrada.cnpj === null ? null : soDigitos(entrada.cnpj)
  if (entrada.contatoEmail !== undefined) campos.contatoEmail = entrada.contatoEmail === null ? null : entrada.contatoEmail.toLowerCase()
  if (entrada.contatoTelefone !== undefined) {
    if (entrada.contatoTelefone === null) campos.contatoTelefoneCifrado = null
    else {
      const telefone = normalizarTelefone(entrada.contatoTelefone)
      if (!telefone) throw new ErroMeuTime('Telefone inválido. Use DDD + número.', 422, 'DADOS_INVALIDOS')
      campos.contatoTelefoneCifrado = cifrarContato(telefone)
    }
  }
  if (entrada.corPrimaria !== undefined) campos.corPrimaria = entrada.corPrimaria === null ? null : entrada.corPrimaria.toUpperCase()
  if (entrada.corSecundaria !== undefined) campos.corSecundaria = entrada.corSecundaria === null ? null : entrada.corSecundaria.toUpperCase()

  const gravado = await db.from('TimeClube').update(campos).eq('id', timeId).is('arquivadoEm', null).select('id')
  if (gravado.error) {
    if (recursoElencoAusente(gravado.error)) throw indisponivelElenco()
    console.error('[elenco] gravar dados do time', gravado.error.code ?? '')
    throw new ErroMeuTime('Não foi possível concluir a operação. Tente novamente.', 500)
  }
  return lerDadosDoTime(timeId)
}
