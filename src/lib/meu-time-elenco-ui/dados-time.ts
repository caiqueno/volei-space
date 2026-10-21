// Dados do time (CNPJ, contato, cores). Retorno rápido no navegador; o servidor valida de novo.
import { cnpjValido, emailValido, soDigitos, telefoneValido } from './mascaras'
import { corValida, normalizarCor, type CampoDadosTime, type EntradaDadosTime } from './cores'

export type DadosTimeEnvio = {
  cnpj?: string | null
  contatoEmail?: string | null
  contatoTelefone?: string | null
  corPrimaria?: string | null
  corSecundaria?: string | null
}

/** O que o servidor devolve hoje: CNPJ e telefone podem vir mascarados. */
export type DadosTimeSalvos = {
  cnpj?: string | null
  contatoEmail?: string | null
  contatoTelefone?: string | null
  corPrimaria?: string | null
  corSecundaria?: string | null
}

/**
 * Valida só o que mudou. CNPJ e telefone (guardados com máscara) só vão ao servidor quando algo novo é digitado.
 * E-mail e cores apagados vão como null (limpar), igual ao escudo.
 */
export function validarDadosTime(entrada: EntradaDadosTime, salvos: DadosTimeSalvos = {}): { valido: boolean; erros: Partial<Record<CampoDadosTime, string>>; dados: DadosTimeEnvio } {
  const erros: Partial<Record<CampoDadosTime, string>> = {}
  const dados: DadosTimeEnvio = {}

  const cnpj = soDigitos(entrada.cnpj)
  if (cnpj) {
    if (!cnpjValido(cnpj)) erros.cnpj = 'Esse CNPJ não parece certo. Confira os 14 números ou deixe em branco.'
    else dados.cnpj = cnpj
  }

  const email = entrada.contatoEmail.trim()
  if (email) {
    if (!emailValido(email)) erros.contatoEmail = 'Esse e-mail não parece certo. Exemplo: time@exemplo.com.'
    else if (email.toLowerCase() !== (salvos.contatoEmail ?? '').toLowerCase()) dados.contatoEmail = email
  } else if (salvos.contatoEmail) dados.contatoEmail = null

  const tel = soDigitos(entrada.contatoTelefone)
  if (tel) {
    if (!telefoneValido(tel)) erros.contatoTelefone = 'Confira o telefone com DDD. Exemplo: (11) 91234-5678.'
    else dados.contatoTelefone = tel
  }

  for (const campo of ['corPrimaria', 'corSecundaria'] as const) {
    const cor = entrada[campo].trim()
    if (cor) {
      if (!corValida(cor)) erros[campo] = 'Escolha uma cor da lista ou digite no formato #1D4ED8.'
      else if (normalizarCor(cor) !== normalizarCor(salvos[campo] ?? '')) dados[campo] = normalizarCor(cor)
    } else if (salvos[campo]) dados[campo] = null
  }

  return { valido: Object.keys(erros).length === 0, erros, dados }
}

export const LIMITE_ESCUDO_TEXTO = 'até 2 MB'
export const AVISO_PRIVACIDADE_TIME = 'O contato do time é visto só por você e pela organização do campeonato. Não aparece na página pública.'
