// Seleções explícitas de colunas para respostas de API que não são do dono do dado.
// Regra: nunca `*`, nunca PII (cpf, documento, nascimento, telefones, documentosUrls),
// nunca organizadorId nem campo interno. Coluna nova no banco só aparece depois de entrar aqui.
// Os testes (scripts/projecoes-publicas.test.ts) reprovam nomes proibidos nestas constantes.

/** Nomes que nenhuma projeção pública ou de operação pode conter. */
export const COLUNAS_PROIBIDAS = [
  'cpf',
  'documentoTipo',
  'documentoNumero',
  'dataNascimento',
  'telefone',
  'telefoneEmergencia',
  'documentosUrls',
  'qrCodeGeradoEm',
  'senhaHash',
  'email',
  'organizadorId',
  'seedKey',
  'pagamentoConfirmadoEm',
  'finalizadoPor',
  'simulacaoRelogio',
  'lider',
  'tecnico',
  'cref',
  'diplomaUrl',
] as const

// ── Equipes ──────────────────────────────────────────────────────────────────
export const EQUIPE_COLUNAS = 'id,nome,slug,logoUrl,corHex,categoria,categoriaCampeonatoId,ligaId,statusEquipe,serie'
export const EQUIPE_LISTA_COLUNAS = 'id,nome,slug,logoUrl,corHex,categoria,ligaId,categoriaCampeonatoId,statusEquipe'
export const EQUIPE_LIGA_RESUMO_COLUNAS = 'id,nome,slug,nomeCurto,status'
export const EQUIPE_JOGADOR_COLUNAS = 'id,nome,numero,posicao,fotoUrl,fotoRostoUrl'
export const EQUIPE_JOGADOR_LISTA_COLUNAS = 'id,nome,numero,posicao,fotoUrl,fotoRostoUrl,equipeId'

// ── Súmula e árbitro ─────────────────────────────────────────────────────────
/** Atleta na súmula: o que a papeleta precisa. qrCodeToken fica de fora (a validação por QR tem rota própria). */
export const JOGADOR_SUMULA_COLUNAS = 'id,nome,numero,posicao,fotoUrl,fotoRostoUrl,equipeId'
/** Partida da operação (árbitro, organizador): sem origemVaga, que entra por consultarComVaga. */
export const PARTIDA_OPERACAO_BASE_COLUNAS = 'id,ligaId,equipeAId,equipeBId,categoria,serie,categoriaCampeonatoId,grupoId,fase,rodada,status,dataHora,localNome,localEndereco,setsPorA,setsPorB,pontosPorA,pontosPorB,vencedorId,sumulaToken,sumulaTokenExpira,sumulaSubmetidaEm,sumulaAprovadaEm'
/** Campeonato embutido na partida. Sem organizadorId: a posse é checada por consulta própria. */
export const LIGA_OPERACAO_COLUNAS = 'id,nome,slug,status,simulacao'
export const EQUIPE_SUMULA_COLUNAS = 'id,nome,slug,logoUrl,corHex,categoria,ligaId,categoriaCampeonatoId'
export const ARBITRO_ESCALA_COLUNAS = 'id,nome'
export const ESCALA_COLUNAS = 'id,partidaId,arbitroId,cargo'
export const PRESENCA_COLUNAS = 'id,partidaId,jogadorId,equipeId,presente,numero'
export const SET_COLUNAS = 'id,partidaId,numero,pontosA,pontosB'
export const OCORRENCIA_COLUNAS = 'id,partidaId,tipo,descricao,set,jogadorId'
export const DESTAQUE_COLUNAS = 'id,partidaId,jogadorId,tipo'

function equipeComElenco(chaveEstrangeira: string) {
  return `Equipe!${chaveEstrangeira}(${EQUIPE_SUMULA_COLUNAS},jogadores:Jogador(${JOGADOR_SUMULA_COLUNAS}))`
}

/** Embeds da partida na operação do árbitro (sem sets, ocorrências nem destaques). */
export const PARTIDA_OPERACAO_EMBEDS = [
  `liga:Liga!Partida_ligaId_fkey(${LIGA_OPERACAO_COLUNAS})`,
  `equipeA:${equipeComElenco('Partida_equipeAId_fkey')}`,
  `equipeB:${equipeComElenco('Partida_equipeBId_fkey')}`,
  `presencas:SumulaPresenca(${PRESENCA_COLUNAS},jogador:Jogador(${JOGADOR_SUMULA_COLUNAS}))`,
  `escala:EscalaArbitro(${ESCALA_COLUNAS},arbitro:Arbitro(${ARBITRO_ESCALA_COLUNAS}))`,
].join(',')

/** Embeds da súmula completa: operação mais sets, ocorrências e destaques. */
export const PARTIDA_SUMULA_EMBEDS = [
  PARTIDA_OPERACAO_EMBEDS,
  `sets:SetPartida(${SET_COLUNAS})`,
  `ocorrencias:OcorrenciaPartida(${OCORRENCIA_COLUNAS})`,
  `destaques:DestaquesPartida(${DESTAQUE_COLUNAS},jogador:Jogador(${JOGADOR_SUMULA_COLUNAS}))`,
].join(',')
