import { z } from 'zod'
import {
  MAXIMO_ATLETAS_POR_PEDIDO,
  NAIPES,
  NUMERO_MAXIMO_CAMISA,
  dataNascimentoValida,
} from '@/lib/meu-time/regras'

export const POSICOES = ['LV', 'PT', 'OP', 'CT', 'LB'] as const
export const MAXIMO_LINHAS_LOTE = 100

const texto = (max: number) => z.string().trim().min(1).max(max)
const dataNascimento = z.string().refine((valor) => dataNascimentoValida(valor), 'Data de nascimento inválida.')
const numeroCamisa = z.number().int().min(0).max(NUMERO_MAXIMO_CAMISA)

export const novaEquipeSchema = z.object({
  nome: texto(200),
  cidade: z.string().trim().max(120).optional().nullable(),
  naipe: z.enum(NAIPES),
  escudoUrl: z.string().trim().url().max(500).optional().nullable(),
})

/** Responsável legal de atleta menor. O contato (telefone ou e-mail) é gravado cifrado e nunca devolvido. */
export const responsavelSchema = z.object({
  nome: texto(200),
  contato: z.string().trim().min(5).max(200),
})

const camposResponsavel = {
  responsavel: responsavelSchema.optional(),
  /** Só `true` vale: o aceite precisa ser afirmativo. */
  aceiteResponsavel: z.literal(true).optional(),
}

const responsavelCompleto = (valor: { responsavel?: unknown; aceiteResponsavel?: unknown }) =>
  Boolean(valor.responsavel) === Boolean(valor.aceiteResponsavel)
const MENSAGEM_RESPONSAVEL = 'Envie "responsavel" e "aceiteResponsavel": true juntos.'

export const novoAtletaSchema = z.object({
  nome: texto(200),
  dataNascimento,
  numeroPreferido: numeroCamisa.optional().nullable(),
  posicao: z.enum(POSICOES).optional().nullable(),
  ...camposResponsavel,
}).refine(responsavelCompleto, MENSAGEM_RESPONSAVEL)

export const editarAtletaSchema = z.object({
  nome: texto(200).optional(),
  dataNascimento: dataNascimento.optional(),
  numeroPreferido: numeroCamisa.optional().nullable(),
  posicao: z.enum(POSICOES).optional().nullable(),
  ...camposResponsavel,
}).refine((valor) => Object.keys(valor).length > 0, 'Informe ao menos um campo.')
  .refine(responsavelCompleto, MENSAGEM_RESPONSAVEL)

/** POST /atletas/:atletaId/consentimento (completar o aceite depois do cadastro). */
export const consentimentoSchema = z.object({
  responsavel: responsavelSchema,
  aceiteResponsavel: z.literal(true),
})

/** DELETE /atletas/:atletaId: corpo opcional com o motivo do pedido de exclusão. */
export const exclusaoAtletaSchema = z.object({
  motivo: z.string().trim().min(1).max(500).optional().nullable(),
})

/** `atletas` é o formato do contrato; `texto` aceita a lista colada do WhatsApp (mesmo parser da inscrição rápida). */
export const loteAtletasSchema = z.object({
  atletas: z.array(z.object({
    nome: z.string().max(200),
    numero: z.union([z.number().int(), z.string().max(3)]).optional().nullable(),
    dataNascimento: dataNascimento.optional().nullable(),
    posicao: z.enum(POSICOES).optional().nullable(),
  })).max(MAXIMO_LINHAS_LOTE).optional(),
  texto: z.string().max(20000).optional(),
}).refine((valor) => valor.atletas != null || valor.texto != null, 'Envie "atletas" ou "texto".')

export const editarEquipeSchema = z.object({
  nome: texto(200).optional(),
  cidade: z.string().trim().max(120).optional().nullable(),
  escudoUrl: z.string().trim().url().max(500).optional().nullable(),
}).refine((valor) => Object.keys(valor).length > 0, 'Informe ao menos um campo.')

export const FUNCOES_COMISSAO_SCHEMA = ['TECNICO', 'ASSISTENTE', 'PREPARADOR_FISICO', 'FISIOTERAPEUTA', 'MEDICO'] as const

export const novaComissaoSchema = z.object({
  nome: texto(200),
  funcao: z.enum(FUNCOES_COMISSAO_SCHEMA),
})

export const novoMembroSchema = z.object({
  email: z.string().trim().email().max(200),
  papel: z.enum(['TECNICO', 'ASSISTENTE']),
})

export const novaInscricaoSchema = z.object({
  categoriaCampeonatoId: z.string().uuid(),
  atletas: z.array(z.object({
    atletaId: z.string().uuid(),
    numero: z.number().int(),
    capitao: z.boolean().optional(),
    libero: z.boolean().optional(),
  })).min(1).max(MAXIMO_ATLETAS_POR_PEDIDO),
  comissao: z.array(z.string().min(1).max(100)).max(20).optional(),
  /** Token do link do organizador (CategoriaCampeonato.tokenInscricao). Se vier, precisa conferir. */
  convite: z.string().trim().max(200).optional(),
})
