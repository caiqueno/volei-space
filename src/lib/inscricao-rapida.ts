import { formularioInscricaoConfigSchema, categorias, series, type FieldRequirement } from '@/lib/schemas'
import { getDefaultFormularioInscricaoConfig } from '@/lib/championship-setup-defaults'
import { formatCategoriaLabel } from '@/lib/equipe-categoria'

// Só os campos da parametrização de Inscrições que já têm coluna real no
// banco (ver mapeamento em src/app/api/inscricao-rapida/route.ts). Os demais
// campos configuráveis (líder: cpf, dataNascimento, whatsapp, email,
// documento, foto; equipe: nomeAbreviado, cidade, instagram; atleta: rg,
// altura, instagram) não têm onde salvar e ficam de fora deste tipo — mesmo
// que o organizador os marque como obrigatórios em Liga.formularioInscricaoConfig.
export type ResolvedFormularioRapidaConfig = {
  equipe: { logo: FieldRequirement }
  lider: { nomeCompleto: FieldRequirement }
  atleta: {
    numeroCamisa: FieldRequirement
    posicao: FieldRequirement
    foto: FieldRequirement
    cpf: FieldRequirement
    dataNascimento: FieldRequirement
    documento: FieldRequirement
  }
}

export function resolveFormularioRapidaConfig(raw: unknown): ResolvedFormularioRapidaConfig {
  const defaults = getDefaultFormularioInscricaoConfig()
  const parsed = formularioInscricaoConfigSchema.safeParse(raw ?? {})
  const data = parsed.success ? parsed.data : {}

  return {
    equipe: { logo: data.equipe?.logo ?? defaults.equipe.logo },
    lider: { nomeCompleto: data.lider?.nomeCompleto ?? defaults.lider.nomeCompleto },
    atleta: {
      numeroCamisa: data.atleta?.numeroCamisa ?? defaults.atleta.numeroCamisa,
      posicao: data.atleta?.posicao ?? defaults.atleta.posicao,
      foto: data.atleta?.foto ?? defaults.atleta.foto,
      cpf: data.atleta?.cpf ?? defaults.atleta.cpf,
      dataNascimento: data.atleta?.dataNascimento ?? defaults.atleta.dataNascimento,
      documento: data.atleta?.documento ?? defaults.atleta.documento,
    },
  }
}

export function isFieldEnabled(req: FieldRequirement) {
  return req !== 'disabled'
}
export function isFieldRequired(req: FieldRequirement) {
  return req === 'required'
}

// Liga.categoriasConfig é uma taxonomia livre digitada pelo organizador
// (JSON de strings "CATEGORIA:SERIE", ex. "MASCULINO:OURO" — a "série" aqui
// às vezes foge do enum fixo de Equipe.serie, ex. "LIVRE"). Quando o
// campeonato já tem exatamente 1 opção, o cadastro rápido deriva
// categoria/série dela e nem pergunta; com 0 ou 2+ opções, a pergunta
// aparece (ver src/app/inscricao-rapida/page.tsx e o componente do form).
export type CategoriaSerieOption = { categoria: string; serie: string; label: string }

export function parseCategoriaSerieOptions(categoriasConfig: string | null | undefined): CategoriaSerieOption[] {
  if (!categoriasConfig) return []
  try {
    const raw = JSON.parse(categoriasConfig)
    if (!Array.isArray(raw)) return []
    return raw
      .filter((entry): entry is string => typeof entry === 'string' && entry.includes(':'))
      .map((entry) => {
        const [categoria, serie] = entry.split(':')
        return { categoria, serie, label: formatCategoriaLabel(categoria, serie) }
      })
  } catch {
    return []
  }
}

export function buildFallbackCategoriaSerieOptions(): CategoriaSerieOption[] {
  return categorias.flatMap((categoria) => series.map((serie) => ({ categoria, serie, label: formatCategoriaLabel(categoria, serie) })))
}
