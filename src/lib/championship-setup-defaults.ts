import type { FieldRequirement } from '@/lib/schemas'

// Default de formularioInscricaoConfig para campeonato e categoria novos,
// e para quem ainda não gravou o JSON. A inscrição trata data de nascimento
// e documento do atleta como opcionais mesmo se um JSON antigo disser required.
//
// Exceção deliberada: atleta.foto nasce 'required' no JSON (o schema atual
// permite fotoRostoUrl vazio) porque qrCodeEnabled também nasce `true` por
// padrão, e a regra do wizard é QR ligado -> nome e foto do atleta
// obrigatórios. A inscrição ignora essa exigência de foto e grava o arquivo
// só quando ele é enviado.
//
// Campos que hoje não têm equivalente algum no schema/banco (a chave `rg`,
// altura e instagram do atleta; cpf, dataNascimento, documento e foto do
// líder; nomeAbreviado e cidade da equipe) nascem 'disabled'. O RG informado
// no cadastro entra em `atleta.documento`, que nasce 'optional'.
//
// email, celular e telefoneEmergencia do atleta NÃO são configuráveis por
// esta estrutura — continuam sempre obrigatórios em playerInscricaoSchema,
// fora do escopo da spec de campos configuráveis.
export function getDefaultFormularioInscricaoConfig() {
  const required: FieldRequirement = 'required'
  const optional: FieldRequirement = 'optional'
  const disabled: FieldRequirement = 'disabled'

  return {
    equipe: {
      nome: required,
      nomeAbreviado: disabled,
      logo: optional,
      cidade: disabled,
      instagram: optional,
    },
    lider: {
      nomeCompleto: required,
      cpf: disabled,
      dataNascimento: disabled,
      whatsapp: optional,
      email: required,
      documento: disabled,
      foto: disabled,
    },
    atleta: {
      nomeCompleto: required,
      cpf: optional,
      rg: disabled,
      dataNascimento: optional,
      foto: required,
      numeroCamisa: optional,
      posicao: optional,
      altura: disabled,
      instagram: disabled,
      documento: optional,
    },
  }
}

// Exemplo de pontuacaoResultado só para pré-popular o futuro formulário —
// NÃO é usado como fallback pela função SQL (o fallback de verdade, que
// reproduz a fórmula hardcoded histórica, vive dentro de
// calcular_pontos_resultado() e é agnóstico ao formato de sets).
export function getExamplePontuacaoResultado(setsPorPartida: number) {
  if (setsPorPartida >= 5) {
    return [
      { setsVencedor: 3, setsPerdedor: 0, pontosVencedor: 3, pontosPerdedor: 0 },
      { setsVencedor: 3, setsPerdedor: 1, pontosVencedor: 3, pontosPerdedor: 0 },
      { setsVencedor: 3, setsPerdedor: 2, pontosVencedor: 2, pontosPerdedor: 1 },
    ]
  }
  return [
    { setsVencedor: 2, setsPerdedor: 0, pontosVencedor: 3, pontosPerdedor: 0 },
    { setsVencedor: 2, setsPerdedor: 1, pontosVencedor: 2, pontosPerdedor: 1 },
  ]
}

export const DEFAULT_CRITERIOS_CLASSIFICACAO = ['PONTOS', 'VITORIAS', 'SALDO_SETS', 'SALDO_PONTOS']

// Vocabulário fechado reconhecido pela função SQL recalcular_classificacao_liga
// (whitelist fixa no ORDER BY dinâmico — qualquer outro valor salvo em
// criteriosClassificacao é descartado em silêncio pelo banco). A UI nunca
// deve oferecer texto livre aqui.
export const CLASSIFICATION_CRITERIA_LABELS: Record<string, string> = {
  PONTOS: 'Pontos',
  CONFRONTO_DIRETO: 'Confronto direto',
  VITORIAS: 'Vitórias',
  DERROTAS: 'Derrotas (menos derrotas primeiro)',
  SALDO_SETS: 'Saldo de sets',
  SALDO_PONTOS: 'Saldo de pontos',
  SETS_PRO: 'Sets vencidos',
  PONTOS_PRO: 'Pontos marcados',
}
