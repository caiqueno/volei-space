import { z } from 'zod'
import { categoriasEtariasEquipe, generosEquipe, niveisEquipe } from '@/lib/schemas'

export const candidaturaTipoSchema = z.enum(['equipe', 'arbitro', 'quadra'])
export type CandidaturaTipo = z.infer<typeof candidaturaTipoSchema>

export const tableByCandidaturaTipo = {
  equipe: 'CandidaturaEquipe',
  arbitro: 'CandidaturaArbitro',
  quadra: 'CandidaturaQuadra',
} as const

export const selectByCandidaturaTipo = {
  equipe: 'id,nome,responsavel,email,telefone,status,equipeId,emblemaUrl,genero,categoria,categoriaEtaria,nivel,instagram,temInstagram,diasDisponiveis,horarios,quadraInfo',
  arbitro: 'id,nome,email,telefone,status,cref,diplomaUrl',
  quadra: 'id,nome,responsavel,email,telefone,status,instagram,cep,endereco,bairro,estrutura,horarios,fotosUrls,cobertura,banheiro,estacionamento',
} as const

const optionalText = z.string().trim().optional().or(z.literal(''))
const optionalPhone = z.string().trim().optional().nullable().or(z.literal(''))

export const candidaturaUpdateSchemas = {
  equipe: z.object({
    nome: z.string().trim().min(1, 'Nome da equipe obrigatorio'),
    responsavel: z.string().trim().min(1, 'Responsavel obrigatorio'),
    telefone: optionalPhone,
    emblemaUrl: z.string().trim().url('Link invalido').optional().or(z.literal('')),
    genero: z.enum(generosEquipe).optional(),
    categoriaEtaria: z.enum(categoriasEtariasEquipe).optional(),
    nivel: z.enum(niveisEquipe).optional(),
    temInstagram: z.boolean().optional(),
    instagram: optionalText,
    diasDisponiveis: z.array(z.string()).optional(),
    horarios: z.object({
      manha: z.boolean(),
      tarde: z.boolean(),
      noite: z.boolean(),
    }).optional(),
    quadraInfo: z.object({
      cobertura: z.boolean().optional(),
      banheiro: z.boolean().optional(),
      piso: optionalText,
      cep: optionalText,
      endereco: optionalText,
      bairro: optionalText,
    }).optional(),
  }),
  arbitro: z.object({
    nome: z.string().trim().min(1, 'Nome obrigatorio'),
    telefone: optionalPhone,
    cref: optionalText,
    diplomaUrl: z.string().trim().url('Link inválido').optional().or(z.literal('')),
  }),
  quadra: z.object({
    nome: z.string().trim().min(1, 'Nome da quadra obrigatorio'),
    responsavel: z.string().trim().min(1, 'Responsavel obrigatorio'),
    telefone: optionalPhone,
    instagram: optionalText,
    cep: optionalText,
    endereco: z.string().trim().min(1, 'Endereco obrigatorio'),
    bairro: optionalText,
    estrutura: optionalText,
    horarios: z.object({
      horariosDisponiveis: z.array(z.object({
        diaSemana: z.string().trim().min(1),
        horaInicio: z.string().regex(/^\d{2}:\d{2}$/),
        horaFim: z.string().regex(/^\d{2}:\d{2}$/),
      })).optional(),
    }).optional(),
    fotosUrls: z.array(z.string().url()).max(8).optional(),
    cobertura: z.boolean().optional(),
    banheiro: z.boolean().optional(),
    estacionamento: z.boolean().optional(),
  }),
} as const

export function parseJsonField<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string') return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}
