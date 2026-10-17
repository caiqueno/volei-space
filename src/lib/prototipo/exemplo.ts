export const AVISO_EXEMPLO = 'PROTÓTIPO — dados de exemplo'

export interface AtletaExemplo {
  id: string
  nome: string
  camisa: number
  posicao: string
}

export const TIME_A = 'Time Exemplo A'
export const TIME_B = 'Time Exemplo B'

export const ATLETAS_EXEMPLO: AtletaExemplo[] = [
  { id: 'a1', nome: 'Atleta Exemplo 1', camisa: 1, posicao: 'Levantador' },
  { id: 'a2', nome: 'Atleta Exemplo 2', camisa: 4, posicao: 'Ponteiro' },
  { id: 'a3', nome: 'Atleta Exemplo 3', camisa: 7, posicao: 'Central' },
  { id: 'a4', nome: 'Atleta Exemplo 4', camisa: 9, posicao: 'Oposto' },
  { id: 'a5', nome: 'Atleta Exemplo 5', camisa: 11, posicao: 'Ponteiro' },
  { id: 'a6', nome: 'Atleta Exemplo 6', camisa: 13, posicao: 'Central' },
  { id: 'a7', nome: 'Atleta Exemplo 7', camisa: 15, posicao: 'Líbero' },
  { id: 'a8', nome: 'Atleta Exemplo 8', camisa: 18, posicao: 'Ponteiro' },
]

export const NOTIFICACOES_EXEMPLO = [
  { id: 'n1', texto: 'Atleta Exemplo 3 aceitou o convite.', quando: 'há 2 min' },
  { id: 'n2', texto: 'Falta a autorização do responsável de Atleta Exemplo 8.', quando: 'há 1 h' },
  { id: 'n3', texto: 'Seu time foi aprovado na competição exemplo.', quando: 'ontem' },
]

export const CLASSIFICACAO_EXEMPLO = [
  { time: 'Time Exemplo A', jogos: 3, vitorias: 3, pontos: 9 },
  { time: 'Time Exemplo B', jogos: 3, vitorias: 2, pontos: 6 },
  { time: 'Time Exemplo C', jogos: 3, vitorias: 1, pontos: 3 },
  { time: 'Time Exemplo D', jogos: 3, vitorias: 0, pontos: 0 },
]

export const SUMULAS_EXEMPLO = [
  { id: 's1', jogo: 'Exemplo A x Exemplo B', situacao: 'Em andamento' },
  { id: 's2', jogo: 'Exemplo C x Exemplo D', situacao: 'Fechada' },
  { id: 's3', jogo: 'Exemplo A x Exemplo C', situacao: 'Aguardando assinaturas' },
]

export const PLANILHA_EXEMPLO = [
  'nome;nascimento;camisa',
  'Atleta Exemplo 1;2000-03-10;1',
  'Atleta Exemplo 2;2001-07-22;4',
  ';1999-01-01;7',
  'Atleta Exemplo 4;data-errada;9',
  'Atleta Exemplo 5;1998-11-05;1',
].join('\n')
