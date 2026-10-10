/**
 * O mesmo atleta não entra em duas equipes da mesma categoria.
 * Com documento, a comparação é o documento. Sem documento, nome e nascimento.
 * Documento vazio não casa com outro vazio. Nome ou nascimento vazio também não.
 */

export type AtletaComparavel = {
  id?: string | number | null
  equipeId?: number | null
  rascunhoId?: string | null
  nomeEquipe?: string | null
  nome?: string | null
  dataNascimento?: string | null
  documentoNumero?: string | null
}

export function normalizarDocumento(valor: unknown) {
  return String(valor ?? '').replace(/[^0-9A-Za-z]/g, '').toUpperCase()
}

export function normalizarNomeAtleta(valor: unknown) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('pt-BR')
}

export function diaNascimento(valor: unknown) {
  const dia = String(valor ?? '').slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(dia) ? dia : ''
}

function mesmaInscricao(candidato: AtletaComparavel, outro: AtletaComparavel) {
  if (candidato.equipeId != null && outro.equipeId != null && Number(candidato.equipeId) === Number(outro.equipeId)) return true
  if (candidato.rascunhoId && outro.rascunhoId && candidato.rascunhoId === outro.rascunhoId) return true
  return false
}

export function mensagemAtletaDuplicado(candidato: AtletaComparavel, outros: AtletaComparavel[]) {
  const documento = normalizarDocumento(candidato.documentoNumero)
  const nome = normalizarNomeAtleta(candidato.nome)
  const dia = diaNascimento(candidato.dataNascimento)
  const deOutraEquipe = outros.filter((outro) => !mesmaInscricao(candidato, outro))
  const achado = documento
    ? deOutraEquipe.find((outro) => normalizarDocumento(outro.documentoNumero) === documento)
    : nome && dia
      ? deOutraEquipe.find((outro) => normalizarNomeAtleta(outro.nome) === nome && diaNascimento(outro.dataNascimento) === dia)
      : undefined
  if (!achado) return null
  const equipe = String(achado.nomeEquipe ?? '').trim()
  return equipe
    ? `Este atleta já está na equipe ${equipe} desta categoria.`
    : 'Este atleta já está em outra equipe desta categoria.'
}
