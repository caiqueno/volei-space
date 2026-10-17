import { z } from 'zod'
import { normalizarNomeEquipe } from '@/lib/nome-equipe'

const nomeEquipeObrigatorio = z.string().trim().min(1).transform(normalizarNomeEquipe)

export const categorias = ['FEMININO', 'FEMININO_MASTER', 'MISTO', 'MASCULINO', 'MASCULINO_MASTER'] as const

export const categoriaSelecaoSchema = z.object({
  categorias: z.array(z.object({
    codigo: z.string().trim().min(1).max(40).optional(),
    id: z.string().uuid().optional(),
    nome: z.string().trim().min(2).max(40).optional(),
  }).refine((item) => Boolean(item.codigo || item.id || item.nome), 'Informe a categoria.')).min(1).max(20),
})
export const series = ['OURO', 'PRATA'] as const
export const generosEquipe = ['MASCULINO', 'FEMININO', 'MISTO'] as const
export const categoriasEtariasEquipe = ['SUB15', 'SUB18', 'SUB21', 'ADULTO', 'MASTER'] as const
export const niveisEquipe = ['INICIANTE', 'INTERMEDIARIO', 'AVANCADO'] as const
export const diasSemana = ['Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta', 'Sabado', 'Domingo'] as const
export const posicoesJogador = ['LV', 'PT', 'OP', 'CT', 'LB'] as const

const optionalPhone = z.string().trim().optional().nullable().or(z.literal(''))

export const horarioTreinoSchema = z.object({
  diaSemana: z.enum(diasSemana),
  horario: z.string().regex(/^\d{2}:\d{2}$/),
})

export const horarioQuadraSchema = z.object({
  diaSemana: z.enum(diasSemana),
  horaInicio: z.string().regex(/^\d{2}:\d{2}$/),
  horaFim: z.string().regex(/^\d{2}:\d{2}$/),
})

export const equipeSchema = z.object({
  nome: nomeEquipeObrigatorio,
  ligaId: z.number().int().positive(),
  categoria: z.enum(categorias),
  serie: z.enum(series).default('PRATA'),
  corHex: z.string().optional(),
  logoUrl: z.string().url().optional().or(z.literal('')),
})

const urlDeFotoOpcional = z.string().url().optional().nullable().or(z.literal(''))

export const jogadorSchema = z.object({
  nome: z.string().min(1),
  equipeId: z.number().int().positive(),
  fotoUrl: urlDeFotoOpcional,
  posicao: z.string().optional(),
  numero: z.number().int().optional(),
  banido: z.boolean().optional(),
})

export const arbitroSchema = z.object({
  nome: z.string().min(1),
  email: z.string().email(),
  telefone: z.string().optional(),
  cref: z.string().optional(),
  diplomaUrl: z.string().url().optional().or(z.literal('')),
})

const partidaCamposSchema = z.object({
  ligaId: z.number().int().positive(),
  equipeAId: z.number().int().positive(),
  equipeBId: z.number().int().positive(),
  categoria: z.enum(categorias),
  serie: z.enum(series).optional().nullable(),
  rodada: z.number().int().positive(),
  dataHora: z.string().datetime().optional(),
  localNome: z.string().optional(),
  localEndereco: z.string().optional(),
})

export const partidaSchema = partidaCamposSchema.refine(
  (partida) => partida.equipeAId !== partida.equipeBId,
  { message: 'As duas equipes devem ser diferentes.', path: ['equipeBId'] },
)

export const partidaAtualizacaoSchema = partidaCamposSchema.partial().refine(
  (partida) => partida.equipeAId == null || partida.equipeBId == null || partida.equipeAId !== partida.equipeBId,
  { message: 'As duas equipes devem ser diferentes.', path: ['equipeBId'] },
)

export const idInteiroPositivoSchema = z.coerce.number().int().positive()

export const fieldRequirementValues = ['disabled', 'optional', 'required'] as const
export const fieldRequirementSchema = z.enum(fieldRequirementValues)
export type FieldRequirement = typeof fieldRequirementValues[number]

// Regra de pontuação por resultado (Classificação). Substitui o hardcode
// histórico da função SQL recalcular_classificacao_liga quando presente;
// quando ausente/null, a função usa o fallback idêntico ao comportamento
// atual (vitória seca=3, vitória c/ sets cedidos=2, derrota não-seca=1,
// derrota seca=0).
export const pontuacaoResultadoSchema = z.array(z.object({
  setsVencedor: z.number().int().min(0),
  setsPerdedor: z.number().int().min(0),
  pontosVencedor: z.number().int().min(0),
  pontosPerdedor: z.number().int().min(0),
}))

// Formulário dinâmico de inscrição (estrutura de dados apenas — o front de
// seleção desses campos é responsabilidade de uma etapa futura). Os campos
// de "lider" e "atleta" que já são hoje hard-required em
// candidaturaEquipeSchema/playerInscricaoSchema (ex.: email, celular,
// telefoneEmergencia do atleta) NÃO entram aqui de propósito — continuam
// sempre obrigatórios, fora do escopo de configuração desta refatoração.
export const formularioInscricaoConfigSchema = z.object({
  equipe: z.object({
    nome: fieldRequirementSchema,
    nomeAbreviado: fieldRequirementSchema,
    logo: fieldRequirementSchema,
    cidade: fieldRequirementSchema,
    instagram: fieldRequirementSchema,
  }).partial(),
  lider: z.object({
    nomeCompleto: fieldRequirementSchema,
    cpf: fieldRequirementSchema,
    dataNascimento: fieldRequirementSchema,
    whatsapp: fieldRequirementSchema,
    email: fieldRequirementSchema,
    documento: fieldRequirementSchema,
    foto: fieldRequirementSchema,
  }).partial(),
  atleta: z.object({
    nomeCompleto: fieldRequirementSchema,
    cpf: fieldRequirementSchema,
    rg: fieldRequirementSchema,
    dataNascimento: fieldRequirementSchema,
    foto: fieldRequirementSchema,
    numeroCamisa: fieldRequirementSchema,
    posicao: fieldRequirementSchema,
    altura: fieldRequirementSchema,
    instagram: fieldRequirementSchema,
    documento: fieldRequirementSchema,
  }).partial(),
}).partial()

// Cadastro rápido de equipe (link único, sem login, já aprovado) — só cobre
// os campos da parametrização de Inscrições que já têm coluna real no banco
// (ver mapeamento em src/app/api/inscricao-rapida/route.ts). Requisitos por
// campo (obrigatório/opcional/desabilitado) vêm de Liga.formularioInscricaoConfig
// e são checados em runtime na rota, não aqui — este schema só valida forma.
// Foto, data de nascimento e documento do atleta não entram nessa exigência:
// ausência, null e string vazia passam. Data preenchida continua no formato AAAA-MM-DD.
const dataNascimentoOpcional = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida').optional().nullable().or(z.literal(''))
const documentoOpcional = z.string().trim().max(80).optional().nullable().or(z.literal(''))

export const inscricaoRapidaJogadorSchema = z.object({
  nome: z.string().trim().min(1),
  numero: z.number().int().min(0).max(999).optional(),
  posicao: z.string().trim().optional(),
  fotoUrl: urlDeFotoOpcional,
  cpf: z.string().trim().optional(),
  dataNascimento: dataNascimentoOpcional,
  documentoTipo: documentoOpcional,
  documentoNumero: documentoOpcional,
  sexo: z.enum(['MASCULINO', 'FEMININO']).nullable().optional(),
})

export const inscricaoRapidaSchema = z.object({
  ligaId: z.number().int().positive(),
  nomeEquipe: nomeEquipeObrigatorio,
  logoUrl: z.string().url().optional().or(z.literal('')),
  lider: z.string().trim().optional(),
  tecnico: z.string().trim().optional(),
  categoria: z.string().trim().optional(),
  serie: z.string().trim().optional(),
  jogadores: z.array(inscricaoRapidaJogadorSchema).min(1, 'Cadastre ao menos um jogador'),
})

const nullableTrimmedString = z.string().trim().optional().nullable()
const nullableUrl = z.string().url().optional().nullable().or(z.literal(''))

export const criarInscricaoEquipeRascunhoSchema = z.object({
  ligaId: z.number().int().positive().optional(),
  linkToken: z.string().trim().min(16).max(64).optional().nullable(),
  tokenCategoria: z.string().trim().min(16).max(64).optional().nullable(),
  nomeEquipe: z.string().trim().min(2).max(160).transform(normalizarNomeEquipe),
  categoria: nullableTrimmedString,
  serie: nullableTrimmedString,
}).refine((valor) => Boolean(valor.ligaId || valor.linkToken || valor.tokenCategoria), 'Informe o campeonato.')

export const atualizarInscricaoEquipeRascunhoSchema = z.object({
  nomeEquipe: z.string().trim().min(2).max(160).transform(normalizarNomeEquipe).optional(),
  logoUrl: nullableUrl,
  lider: nullableTrimmedString,
  tecnico: nullableTrimmedString,
  categoria: nullableTrimmedString,
  serie: nullableTrimmedString,
}).strict().refine((value) => Object.keys(value).length > 0, 'Informe ao menos um campo para atualizar.')

export const criarJogadorInscricaoRascunhoSchema = inscricaoRapidaJogadorSchema.extend({
  nome: z.string().trim().min(1).max(160),
})

export const atualizarJogadorInscricaoRascunhoSchema = criarJogadorInscricaoRascunhoSchema.partial().strict()
  .refine((value) => Object.keys(value).length > 0, 'Informe ao menos um campo para atualizar.')

export const finalizarInscricaoEquipeRascunhoSchema = z.object({}).strict()

export const interessadoSchema = z.object({
  nomeCompleto: z.string().trim().min(1),
  email: z.string().trim().email(),
  whatsapp: z.string().trim().min(1),
  cidade: z.string().trim().min(1),
})

export const ligaLocalSchema = z.object({
  nome: z.string().min(1),
  endereco: z.string().optional().or(z.literal('')),
  quadra: z.string().optional().or(z.literal('')),
  ordem: z.number().int().min(1).optional(),
})

export const ligaSchema = z.object({
  nome: z.string().min(1),
  slug: z.string().min(1),
  organizadorId: z.string().optional(),
  nomeCurto: z.string().max(20).optional().or(z.literal('')),
  subtitulo: z.string().optional(),
  descricao: z.string().optional(),
  regulamento: z.string().optional(),
  premiacao: z.string().optional(),
  quantidadeEquipes: z.number().int().positive().optional(),
  quantidadeEquipesMinima: z.number().int().positive().optional(),
  quantidadeEquipesMaxima: z.number().int().positive().optional(),
  formato: z.string().optional(),
  inscricoesAbertas: z.boolean().optional(),
  categoriasConfig: z.string().optional(),
  logoUrl: z.string().url().optional().or(z.literal('')),
  capaUrl: z.string().url().optional().or(z.literal('')),
  corTematica: z.string().optional(),
  status: z.enum(['EM_BREVE', 'ATIVA', 'ENCERRADA']).optional(),
  dataInicio: z.string().datetime({ offset: true }).optional(),
  dataFim: z.string().datetime({ offset: true }).optional(),
  prazoAlteracaoElencoDias: z.number().int().min(0).max(365).optional(),
  setsPorPartida: z.number().int().min(1).max(5).optional(),
  limiteSubstituicoesPorSet: z.number().int().min(1).max(30).nullable().optional(),
  alertaRodizioIlegal: z.boolean().optional(),
  limiteTemposPorSet: z.number().int().min(1).max(4).nullable().optional(),
  separarTempos: z.boolean().optional(),
  tempoMedico: z.boolean().optional(),
  substituicaoPorLesao: z.boolean().optional(),
  exigirLiberoInicial: z.boolean().optional(),
  quantidadeLiberos: z.number().int().min(1).max(2).nullable().optional(),
  setsPorPartidaFinal: z.number().int().min(1).max(5).nullable().optional(),
  setsPorPartidaSemifinal: z.number().int().min(1).max(5).nullable().optional(),
  setsPorPartidaQuartas: z.number().int().min(1).max(5).nullable().optional(),
  setsPorPartidaOitavas: z.number().int().min(1).max(5).nullable().optional(),
  setsPorPartidaTerceiroLugar: z.number().int().min(1).max(5).nullable().optional(),
  pontosPorSet: z.number().int().min(1).max(99).optional(),
  setsFormato: z.enum(['MELHOR_DE', 'QUANTIDADE_FIXA']).optional(),
  diferencaMinimaSet: z.number().int().min(1).max(10).optional(),
  turnoReturno: z.boolean().optional(),
  tieBreakUltimoSet: z.boolean().optional(),
  pontosUltimoSet: z.number().int().min(1).max(99).optional().nullable(),
  quantidadeGrupos: z.number().int().min(1).max(32).optional(),
  nomesGrupos: z.string().optional(),
  criteriosClassificacao: z.string().optional(),
  woSetsVencedor: z.number().int().min(1).max(5).nullable().optional(),
  woSetsPerdedor: z.number().int().min(0).max(5).nullable().optional(),
  woPontosSetVencedor: z.number().int().min(0).max(99).nullable().optional(),
  woPontosSetPerdedor: z.number().int().min(0).max(99).nullable().optional(),
  woPunicaoPontos: z.number().int().min(0).max(20).nullable().optional(),
  pontuacaoResultado: pontuacaoResultadoSchema.optional().nullable(),
  classificadosPorGrupo: z.number().int().min(0).max(64).optional(),
  melhoresClassificadosGerais: z.number().int().min(0).max(64).optional(),
  faseEliminatoria: z.enum(['NENHUMA', 'FINAL', 'SEMIFINAL', 'QUARTAS', 'OITAVAS', 'DEZESSEIS_AVOS']).optional(),
  metodoChaveamento: z.enum(['RANKING_GERAL', 'CRUZAMENTO_GRUPOS', 'SORTEIO', 'MANUAL']).optional(),
  eliminatoriaIdaVolta: z.boolean().optional(),
  disputaTerceiroLugar: z.boolean().optional(),
  goldenSet: z.boolean().optional(),
  rebaixados: z.number().int().min(0).max(64).optional(),
  podioDestaques: z.string().optional(),
  inscricoesAberturaEm: z.string().datetime({ offset: true }).optional().nullable(),
  inscricoesEncerramentoEm: z.string().datetime({ offset: true }).optional().nullable(),
  inscricaoAprovacaoAutomatica: z.boolean().optional(),
  inscricaoPermiteEdicaoAposEnvio: z.boolean().optional(),
  inscricaoPrazoEdicaoDias: z.number().int().min(0).max(365).optional().nullable(),
  elencoQuantidadeMinima: z.number().int().min(1).optional().nullable(),
  elencoQuantidadeMaxima: z.number().int().min(1).optional().nullable(),
  elencoCadastroDuranteInscricao: z.boolean().optional(),
  elencoCadastroAposAprovacao: z.boolean().optional(),
  qrCodeEnabled: z.boolean().optional(),
  sumulaScoutsEnabled: z.boolean().optional(),
  formularioInscricaoConfig: formularioInscricaoConfigSchema.optional().nullable(),
  genero: z.enum(['MASCULINO', 'FEMININO', 'MISTO']).nullable().optional(),
  idadeMinima: z.number().int().min(0).max(120).nullable().optional(),
  idadeMaxima: z.number().int().min(0).max(120).nullable().optional(),
})

// Sub-schemas por sessão da Central de Parametrização — cada PATCH aceita
// payload parcial (nunca exige a sessão 100% preenchida para persistir).
export const setupInformacoesSchema = ligaSchema.pick({
  nome: true,
  nomeCurto: true,
  subtitulo: true,
  descricao: true,
  logoUrl: true,
  capaUrl: true,
  corTematica: true,
  status: true,
  // regulamento/premiacao passam a ser editados aqui: o modal de /painel,
  // que era a única UI deles, foi reduzido a criação mínima.
  regulamento: true,
  premiacao: true,
}).partial()

export const setupEstruturaSchema = ligaSchema.pick({
  quantidadeEquipes: true,
  quantidadeEquipesMinima: true,
  quantidadeEquipesMaxima: true,
  formato: true,
  quantidadeGrupos: true,
  turnoReturno: true,
  setsFormato: true,
  setsPorPartida: true,
  limiteSubstituicoesPorSet: true,
  alertaRodizioIlegal: true,
  limiteTemposPorSet: true,
  separarTempos: true,
  tempoMedico: true,
  substituicaoPorLesao: true,
  exigirLiberoInicial: true,
  quantidadeLiberos: true,
  pontosPorSet: true,
  diferencaMinimaSet: true,
  tieBreakUltimoSet: true,
  pontosUltimoSet: true,
  // Recurso comercial cobrado por partida, configurado junto das regras de
  // partida (o QR Code fica em Inscrições, onde vive sua regra de foto/nome).
  sumulaScoutsEnabled: true,
}).partial()

// Formatos canônicos de competição. `Liga.formato` é texto livre no banco;
// esta é a lista que a UI oferece. COPA_CURTA é legado e é normalizado para
// MATA_MATA pelas rotas de Liga.
export const COMPETITION_FORMATS = [
  { value: 'PONTOS_CORRIDOS', label: 'Pontos corridos', temGrupos: true, temMataMata: false },
  { value: 'GRUPOS_MATA_MATA', label: 'Grupos + mata-mata', temGrupos: true, temMataMata: true },
  { value: 'MATA_MATA', label: 'Mata-mata', temGrupos: false, temMataMata: true },
] as const

export type CompetitionFormat = typeof COMPETITION_FORMATS[number]['value']

export function formatoTemFaseDeGrupos(formato?: string | null): boolean {
  return formato !== 'MATA_MATA' && formato !== 'COPA_CURTA'
}

export const setupClassificacaoSchema = ligaSchema.pick({
  criteriosClassificacao: true,
  pontuacaoResultado: true,
  classificadosPorGrupo: true,
  melhoresClassificadosGerais: true,
  woSetsVencedor: true,
  woSetsPerdedor: true,
  woPontosSetVencedor: true,
  woPontosSetPerdedor: true,
  woPunicaoPontos: true,
}).partial()

export const setupEliminatoriasSchema = ligaSchema.pick({
  faseEliminatoria: true,
  metodoChaveamento: true,
  eliminatoriaIdaVolta: true,
  disputaTerceiroLugar: true,
  goldenSet: true,
  setsPorPartidaFinal: true,
  setsPorPartidaSemifinal: true,
  setsPorPartidaQuartas: true,
  setsPorPartidaOitavas: true,
  setsPorPartidaTerceiroLugar: true,
}).partial()

export const setupCalendarioSchema = ligaSchema.pick({
  dataInicio: true,
  dataFim: true,
}).partial()

export const setupInscricoesSchema = ligaSchema.pick({
  inscricoesAbertas: true,
  inscricoesAberturaEm: true,
  inscricoesEncerramentoEm: true,
  inscricaoAprovacaoAutomatica: true,
  inscricaoPermiteEdicaoAposEnvio: true,
  inscricaoPrazoEdicaoDias: true,
  elencoQuantidadeMinima: true,
  elencoQuantidadeMaxima: true,
  elencoCadastroDuranteInscricao: true,
  elencoCadastroAposAprovacao: true,
  qrCodeEnabled: true,
  formularioInscricaoConfig: true,
  prazoAlteracaoElencoDias: true,
  genero: true,
  idadeMinima: true,
  idadeMaxima: true,
}).partial().extend({
  // Competição privada. Opcional no PATCH: omitido não altera; a leitura devolve PUBLICA por padrão.
  visibilidade: z.enum(['PUBLICA', 'PRIVADA']).optional(),
})

export const inscricaoCampeonatoSchema = z.object({
  candidaturaId: z.string().min(1),
  ligaId: z.number().int().positive(),
})

export const mensagemSchema = z.object({
  ligaId: z.number().int().positive(),
  autor: z.string().min(1),
  texto: z.string().min(1),
})

export const mensagemAprovacaoSchema = z.object({
  aprovada: z.boolean(),
}).strict()

export const midiaSchema = z.object({
  ligaId: z.number().int().positive(),
  tipo: z.enum(['FOTO', 'VIDEO']),
  url: z.string().url(),
  thumbUrl: z.string().url().optional(),
  titulo: z.string().optional(),
  tag: z.enum(['DESTAQUE', 'RODADA', 'PREMIACAO']).optional(),
})

export const sumulaSchema = z.object({
  presencas: z.array(z.object({
    jogadorId: z.number().int(),
    equipeId: z.number().int(),
    presente: z.boolean().nullable(),
    numero: z.number().int().optional().nullable(),
  })),
  sets: z.array(z.object({
    numero: z.number().int(),
    pontosA: z.number().int(),
    pontosB: z.number().int(),
  })),
  ocorrencias: z.array(z.object({
    tipo: z.enum([
      'CARTAO_AMARELO',
      'CARTAO_VERMELHO',
      'ADVERTENCIA',
      'PENALIDADE',
      'EXPULSAO',
      'DESQUALIFICACAO',
      'WO',
      'OBSERVACAO',
      'point',
      'attack',
      'block',
      'ace',
      'timeout',
      'substitution',
      'lesao',
      'troca_libero',
      'anotacao',
      'set_start',
      'set_end',
      'system',
    ]),
    descricao: z.string().optional(),
    set: z.number().int().optional(),
    jogadorId: z.number().int().optional().nullable(),
  })).optional(),
  destaques: z.array(z.object({
    jogadorId: z.number().int(),
    tipo: z.enum(['MVP', 'MELHOR_SAQUE', 'MELHOR_BLOQUEIO']),
  })).optional(),
  versao: z.number().int().nonnegative().optional(),
})

// Candidatura schemas (new)
export const candidaturaEquipeSchema = z.object({
  nome: nomeEquipeObrigatorio,
  responsavel: z.string().min(1),
  email: z.string().email(),
  telefone: optionalPhone,
  senha: z.string().min(8),
  emblemaUrl: z.string().url().optional().or(z.literal('')),
  categoria: z.enum(categorias),
  serie: z.enum(series),
  genero: z.enum(generosEquipe).optional(),
  categoriaEtaria: z.enum(categoriasEtariasEquipe).optional(),
  nivel: z.enum(niveisEquipe).optional(),
  possuiLocalTreino: z.boolean().optional(),
  horariosTreino: z.array(horarioTreinoSchema).optional(),
  cederQuadra: z.boolean().optional(),
  temInstagram: z.boolean().optional(),
  instagram: z.string().optional().or(z.literal('')),
  diasDisponiveis: z.array(z.string()).min(1),
  horarios: z.object({
    manha: z.boolean(),
    tarde: z.boolean(),
    noite: z.boolean(),
  }),
  quadraInfo: z.object({
    cobertura: z.boolean(),
    piso: z.string().optional(),
    banheiro: z.boolean(),
    cep: z.string().optional(),
    endereco: z.string().optional(),
    bairro: z.string().optional(),
  }),
  ligaId: z.number().int().positive().optional(),
  conviteToken: z.string().uuid().optional(),
})

export const candidaturaArbitroSchema = z.object({
  nome: z.string().min(1),
  email: z.string().email(),
  telefone: optionalPhone,
  senha: z.string().min(8),
  cref: z.string().optional(),
  diplomaUrl: z.string().url().optional().or(z.literal('')),
})

export const candidaturaOrganizadorSchema = z.object({
  nome: z.string().min(1),
  email: z.string().email(),
  telefone: optionalPhone,
  senha: z.string().min(8),
  codigoAcesso: z.string().trim().min(8, 'Informe o ID de acesso fornecido pelo administrador.'),
  // Não é mais coletado no cadastro — preenchido depois, no onboarding
  // pós-login (OrganizacaoForm / PATCH /api/organizador/perfil).
  organizacao: z.string().optional().or(z.literal('')),
  cidade: z.string().optional().or(z.literal('')),
  plano: z.enum(['PADRAO', 'STARTER', 'PRO', 'ELITE']).default('PADRAO'),
})

// Reaproveitado pelo onboarding pós-login e por Configurações — mesmas
// regras, mesmo formulário (OrganizacaoForm), só o endpoint muda (PATCH em
// vez de criar uma candidatura nova).
export const organizadorPerfilSchema = z.object({
  organizacao: z.string().min(1, 'Informe o nome da organização.'),
  cidade: z.string().optional().or(z.literal('')),
  logoUrl: z.string().url().optional().or(z.literal('')),
})

export const candidaturaQuadraSchema = z.object({
  nome: z.string().min(1),
  responsavel: z.string().min(1),
  email: z.string().email(),
  telefone: optionalPhone,
  senha: z.string().min(8),
  instagram: z.string().optional().or(z.literal('')),
  cep: z.string().optional(),
  endereco: z.string().min(1),
  bairro: z.string().optional(),
  estrutura: z.string().optional(),
  horarios: z.object({
    horariosDisponiveis: z.array(horarioQuadraSchema).optional(),
  }).optional(),
  fotosUrls: z.array(z.string().url()).max(8).optional(),
  cobertura: z.boolean().optional(),
  banheiro: z.boolean().optional(),
  estacionamento: z.boolean().optional(),
  ligaId: z.number().int().positive().optional(),
})

export const playerInscricaoSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  dataNascimento: dataNascimentoOpcional,
  documentoTipo: documentoOpcional,
  documentoNumero: documentoOpcional,
  cpf: z.string().optional().nullable().or(z.literal('')),
  email: z.string().email('E-mail inválido'),
  celular: z.string().min(10, 'Celular inválido'),
  telefoneEmergencia: z.string().min(10, 'Telefone de emergência inválido'),
  fotoRostoUrl: urlDeFotoOpcional,
  documentosUrls: z.array(z.string().url()).optional(),
  posicao: z.enum(posicoesJogador).optional(),
  numero: z.number().int().optional(),
})
