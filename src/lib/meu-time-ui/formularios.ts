// Validação de formulário só para dar retorno rápido; o servidor valida tudo de novo.
import { dataNascimentoValida } from './selecao'
import type { Naipe, NovaEquipe, NovoAtleta, NovoMembroComissao } from './tipos'

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
): Resultado<NovoAtleta, 'nome' | 'dataNascimento' | 'numero'> {
  const erros: Partial<Record<'nome' | 'dataNascimento' | 'numero', string>> = {}
  const nome = entrada.nome.replace(/\s+/g, ' ').trim()
  if (nome.length < 2) erros.nome = 'Escreva o nome do atleta.'
  if (!dataNascimentoValida(entrada.dataNascimento, hoje)) erros.dataNascimento = 'Informe a data de nascimento completa (dia, mês e ano).'
  const numeroTexto = entrada.numero.trim()
  if (numeroTexto && !/^\d{1,2}$/.test(numeroTexto)) erros.numero = 'A camisa vai de 1 a 99.'
  if (numeroTexto && /^\d{1,2}$/.test(numeroTexto) && Number(numeroTexto) < 1) erros.numero = 'A camisa vai de 1 a 99.'
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
  if (!entrada.funcao) erros.funcao = 'Escolha a função.'
  if (Object.keys(erros).length > 0) return { valido: false, erros }
  return { valido: true, dados: { nome, funcao: entrada.funcao }, erros }
}
