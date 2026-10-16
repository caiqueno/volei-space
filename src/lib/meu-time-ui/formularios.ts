// Validação de formulário só para dar retorno rápido; o servidor valida tudo de novo.
import { dataNascimentoValida } from './selecao'
import { FUNCOES_COMISSAO_CODIGOS, POSICOES_CODIGOS, type EdicaoEquipe, type FuncaoComissao, type Naipe, type NovaEquipe, type NovoAcesso, type NovoAtleta, type NovoMembroComissao, type PosicaoCodigo } from './tipos'

export type Resultado<D, C extends string> = { valido: true; dados: D; erros: Partial<Record<C, string>> } | { valido: false; erros: Partial<Record<C, string>> }

const NAIPES: Naipe[] = ['FEMININO', 'MASCULINO', 'MISTO']

export function validarNovoTime(entrada: { nome: string; cidade: string; naipe: string; escudoUrl: string }): Resultado<NovaEquipe, 'nome' | 'naipe' | 'escudoUrl'> {
  const erros: Partial<Record<'nome' | 'naipe' | 'escudoUrl', string>> = {}
  const nome = entrada.nome.replace(/\s+/g, ' ').trim()
  if (nome.length < 2) erros.nome = 'Escreva o nome do time (pelo menos 2 letras).'
  if (!NAIPES.includes(entrada.naipe as Naipe)) erros.naipe = 'Escolha o naipe do time: feminino, masculino ou misto.'
  const escudo = entrada.escudoUrl.trim()
  if (escudo && !/^https?:\/\/\S+$/i.test(escudo)) erros.escudoUrl = 'O endereço do escudo precisa começar com https://. Ou deixe em branco.'
  if (Object.keys(erros).length > 0) return { valido: false, erros }
  const dados: NovaEquipe = { nome, naipe: entrada.naipe as Naipe }
  const cidade = entrada.cidade.replace(/\s+/g, ' ').trim()
  if (cidade) dados.cidade = cidade
  if (escudo) dados.escudoUrl = escudo
  return { valido: true, dados, erros }
}

export function validarNovoAtleta(
  entrada: { nome: string; dataNascimento: string; numero: string; posicao: string },
  hoje: Date = new Date(),
): Resultado<NovoAtleta, 'nome' | 'dataNascimento' | 'numero' | 'posicao'> {
  const erros: Partial<Record<'nome' | 'dataNascimento' | 'numero' | 'posicao', string>> = {}
  const nome = entrada.nome.replace(/\s+/g, ' ').trim()
  if (nome.length < 2) erros.nome = 'Escreva o nome do atleta.'
  if (!dataNascimentoValida(entrada.dataNascimento, hoje)) erros.dataNascimento = 'Informe a data de nascimento completa (dia, mês e ano).'
  const numeroTexto = entrada.numero.trim()
  if (numeroTexto && !/^\d{1,2}$/.test(numeroTexto)) erros.numero = 'A camisa vai de 1 a 99.'
  if (numeroTexto && /^\d{1,2}$/.test(numeroTexto) && Number(numeroTexto) < 1) erros.numero = 'A camisa vai de 1 a 99.'
  if (entrada.posicao && !POSICOES_CODIGOS.includes(entrada.posicao as PosicaoCodigo)) erros.posicao = 'Escolha uma posição da lista ou deixe em branco.'
  if (Object.keys(erros).length > 0) return { valido: false, erros }
  const dados: NovoAtleta = { nome, dataNascimento: entrada.dataNascimento }
  if (numeroTexto) dados.numeroPreferido = Number(numeroTexto)
  if (entrada.posicao) dados.posicao = entrada.posicao
  return { valido: true, dados, erros }
}

export function validarMembroComissao(entrada: { nome: string; funcao: string }): Resultado<NovoMembroComissao, 'nome' | 'funcao'> {
  const erros: Partial<Record<'nome' | 'funcao', string>> = {}
  const nome = entrada.nome.replace(/\s+/g, ' ').trim()
  if (nome.length < 2) erros.nome = 'Escreva o nome da pessoa.'
  if (!FUNCOES_COMISSAO_CODIGOS.includes(entrada.funcao as FuncaoComissao)) erros.funcao = 'Escolha a função.'
  if (Object.keys(erros).length > 0) return { valido: false, erros }
  return { valido: true, dados: { nome, funcao: entrada.funcao }, erros }
}

export function validarEdicaoTime(entrada: { nome: string; cidade: string; escudoUrl: string }): Resultado<EdicaoEquipe, 'nome' | 'escudoUrl'> {
  const erros: Partial<Record<'nome' | 'escudoUrl', string>> = {}
  const nome = entrada.nome.replace(/\s+/g, ' ').trim()
  if (nome.length < 2) erros.nome = 'Escreva o nome do time (pelo menos 2 letras).'
  const escudo = entrada.escudoUrl.trim()
  if (escudo && !/^https?:\/\/\S+$/i.test(escudo)) erros.escudoUrl = 'O endereço do escudo precisa começar com https://. Ou deixe em branco.'
  if (Object.keys(erros).length > 0) return { valido: false, erros }
  const cidade = entrada.cidade.replace(/\s+/g, ' ').trim()
  // Campo apagado vira null: é assim que o servidor entende "remover".
  return { valido: true, dados: { nome, cidade: cidade || null, escudoUrl: escudo || null }, erros }
}

export function validarNovoAcesso(entrada: { email: string; papel: string }): Resultado<NovoAcesso, 'email' | 'papel'> {
  const erros: Partial<Record<'email' | 'papel', string>> = {}
  const email = entrada.email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) erros.email = 'Escreva o e-mail da pessoa, como nome@exemplo.com.'
  if (entrada.papel !== 'TECNICO' && entrada.papel !== 'ASSISTENTE') erros.papel = 'Escolha o que a pessoa pode fazer.'
  if (Object.keys(erros).length > 0) return { valido: false, erros }
  return { valido: true, dados: { email, papel: entrada.papel as NovoAcesso['papel'] }, erros }
}
