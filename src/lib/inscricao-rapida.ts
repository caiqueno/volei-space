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

function campoOpcionalNaInscricao(valor: FieldRequirement | undefined, padrao: FieldRequirement): FieldRequirement {
  return (valor ?? padrao) === 'disabled' ? 'disabled' : 'optional'
}

function campoConfigurado(valor: FieldRequirement | undefined, padrao: FieldRequirement): FieldRequirement {
  const escolhido = valor ?? padrao
  if (escolhido === 'disabled' || escolhido === 'optional' || escolhido === 'required') return escolhido
  return padrao
}

function grupoDeFormulario(valor: unknown) {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return {}
  return valor as Record<string, unknown>
}

/** A categoria gravada na parametrização prevalece. Chave ausente herda o campeonato. */
export function formularioDaInscricao(liga: unknown, categoria: unknown) {
  const base = grupoDeFormulario(liga)
  const sobre = grupoDeFormulario(categoria)
  if (Object.keys(sobre).length === 0) return liga ?? {}
  return {
    ...base,
    ...sobre,
    equipe: { ...grupoDeFormulario(base.equipe), ...grupoDeFormulario(sobre.equipe) },
    lider: { ...grupoDeFormulario(base.lider), ...grupoDeFormulario(sobre.lider) },
    atleta: { ...grupoDeFormulario(base.atleta), ...grupoDeFormulario(sobre.atleta) },
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
      // A foto nasce required no JSON por causa do QR. A inscrição só oculta
      // quando está disabled; required antigo não bloqueia o cadastro.
      foto: campoOpcionalNaInscricao(data.atleta?.foto, 'optional'),
      cpf: data.atleta?.cpf ?? defaults.atleta.cpf,
      dataNascimento: campoConfigurado(data.atleta?.dataNascimento, 'optional'),
      documento: campoConfigurado(data.atleta?.documento, 'optional'),
    },
  }
}

export function isFieldEnabled(req: FieldRequirement) {
  return req !== 'disabled'
}
export function isFieldRequired(req: FieldRequirement) {
  return req === 'required'
}

export function pendenciasDoAtleta(atleta: { dataNascimento?: string | null; documentoNumero?: string | null }, config: ResolvedFormularioRapidaConfig) {
  const pendencias: string[] = []
  if (isFieldRequired(config.atleta.dataNascimento) && !atleta.dataNascimento?.trim()) pendencias.push('Data de nascimento é obrigatória.')
  if (isFieldRequired(config.atleta.documento) && !atleta.documentoNumero?.trim()) pendencias.push('Documento é obrigatório.')
  return pendencias
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

export function championshipCategoryName(nome: string, nomeCurto?: string | null) {
  return (nomeCurto || nome).trim()
}

/** Sem categorias próprias, o cadastro usa o nome parametrizado do campeonato. */
export function resolveInscricaoCategoria(liga: { nome: string; nomeCurto?: string | null; categoriasConfig?: string | null }) {
  const parametrized = parseCategoriaSerieOptions(liga.categoriasConfig)
  if (parametrized.length > 1) return { categoriaFixa: null as CategoriaSerieOption | null, categoriaOptions: parametrized }
  if (parametrized.length === 1) return { categoriaFixa: parametrized[0], categoriaOptions: [] as CategoriaSerieOption[] }
  const label = championshipCategoryName(liga.nome, liga.nomeCurto)
  return {
    categoriaFixa: { categoria: label, serie: 'GERAL', label },
    categoriaOptions: [] as CategoriaSerieOption[],
  }
}
