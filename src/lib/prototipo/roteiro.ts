export type PerfilId = 'lider' | 'atleta' | 'apontador' | 'banco' | 'arbitro' | 'organizador' | 'espectador'

export interface Passo {
  id: string
  titulo: string
  resumo: string
}

export interface Perfil {
  id: PerfilId
  nome: string
  descricao: string
  passos: Passo[]
}

export const PERFIS: Perfil[] = [
  {
    id: 'lider',
    nome: 'Líder do time',
    descricao: 'Cadastra o time, convida atletas, importa planilha e acompanha avisos.',
    passos: [
      { id: 'cadastrar-time', titulo: 'Cadastrar time', resumo: 'Informe nome e cidade do time.' },
      { id: 'convidar', titulo: 'Convidar atleta por link', resumo: 'Gere um link de convite para o atleta.' },
      { id: 'importar', titulo: 'Importar planilha', resumo: 'Veja a prévia com os erros antes de confirmar.' },
      { id: 'notificacoes', titulo: 'Notificações', resumo: 'Acompanhe os avisos do time.' },
    ],
  },
  {
    id: 'atleta',
    nome: 'Atleta convidado',
    descricao: 'Abre o convite recebido e preenche os próprios dados.',
    passos: [
      { id: 'convite', titulo: 'Abrir convite', resumo: 'Veja quem convidou e para qual time.' },
      { id: 'dados', titulo: 'Preencher dados', resumo: 'Nome, nascimento e posição.' },
      { id: 'menor', titulo: 'Aviso de menor', resumo: 'Atletas menores precisam de um responsável.' },
    ],
  },
  {
    id: 'apontador',
    nome: 'Apontador',
    descricao: 'Marca pontos, rotação, substituições e fecha a súmula.',
    passos: [
      { id: 'placar', titulo: 'Placar e pontos', resumo: 'Toque para marcar pontos de cada time.' },
      { id: 'rotacao', titulo: 'Rotação', resumo: 'A rotação muda quando o time ganha o saque.' },
      { id: 'substituicao', titulo: 'Substituição e tempo', resumo: 'Registre trocas e pedidos de tempo.' },
      { id: 'pedido-banco', titulo: 'Pedido do banco', resumo: 'Aceite ou recuse o pedido enviado pelo banco.' },
      { id: 'desafio', titulo: 'Desafio', resumo: 'Registre um pedido de desafio.' },
      { id: 'fechamento', titulo: 'Fechamento e assinaturas', resumo: 'Confira o resultado e colete as assinaturas.' },
    ],
  },
  {
    id: 'banco',
    nome: 'Banco da equipe',
    descricao: 'Monta a papeleta de 6 posições e faz pedidos ao apontador.',
    passos: [
      { id: 'papeleta', titulo: 'Montar papeleta', resumo: 'Escolha um atleta para cada posição.' },
      { id: 'enviar', titulo: 'Enviar papeleta', resumo: 'Envie a papeleta ao apontador.' },
      { id: 'pedidos', titulo: 'Pedir tempo ou troca', resumo: 'Envie pedidos durante o jogo.' },
    ],
  },
  {
    id: 'arbitro',
    nome: 'Árbitro',
    descricao: 'Consulta o jogo ao vivo, sem alterar a súmula.',
    passos: [{ id: 'consulta', titulo: 'Consulta ao vivo', resumo: 'Placar, rotação e histórico em modo leitura.' }],
  },
  {
    id: 'organizador',
    nome: 'Organizador',
    descricao: 'Acompanha competição, tabela, súmulas e exporta o scout.',
    passos: [
      { id: 'competicao', titulo: 'Competição', resumo: 'Visão geral do campeonato.' },
      { id: 'tabela', titulo: 'Tabela', resumo: 'Classificação e jogos da rodada.' },
      { id: 'sumulas', titulo: 'Súmulas', resumo: 'Situação das súmulas dos jogos.' },
      { id: 'exportar', titulo: 'Exportar scout', resumo: 'Baixe os dados de exemplo do scout.' },
    ],
  },
  {
    id: 'espectador',
    nome: 'Espectador',
    descricao: 'Acompanha o placar ao vivo em tela cheia.',
    passos: [{ id: 'ao-vivo', titulo: 'Placar ao vivo', resumo: 'Placar grande, ideal para telão e celular.' }],
  },
]

export function getPerfil(id: string): Perfil | undefined {
  return PERFIS.find((p) => p.id === id)
}

export function getPasso(perfilId: string, passoId: string): Passo | undefined {
  return getPerfil(perfilId)?.passos.find((s) => s.id === passoId)
}

export function rotaPasso(perfilId: string, passoId: string): string {
  return `/prototipo/${perfilId}/${passoId}`
}

export interface Navegacao {
  indice: number
  total: number
  anterior: string | null
  proximo: string | null
}

export function navegacao(perfilId: string, passoId: string): Navegacao | null {
  const perfil = getPerfil(perfilId)
  if (!perfil) return null
  const indice = perfil.passos.findIndex((s) => s.id === passoId)
  if (indice < 0) return null
  return {
    indice,
    total: perfil.passos.length,
    anterior: indice > 0 ? rotaPasso(perfilId, perfil.passos[indice - 1].id) : null,
    proximo: indice < perfil.passos.length - 1 ? rotaPasso(perfilId, perfil.passos[indice + 1].id) : null,
  }
}

export function prototipoAtivo(valor: string | undefined = process.env.NEXT_PUBLIC_PROTOTIPO_ATIVO): boolean {
  return valor === '1'
}
