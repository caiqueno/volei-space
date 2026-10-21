// Textos curtos de privacidade e ajuda, em linguagem simples (docs/analise/25-lgpd-menores.md).

export const PRIVACIDADE_FOTO = 'A foto serve para conferir quem joga. Só você e a organização do campeonato veem.'
export const PRIVACIDADE_DOCUMENTO = 'O documento fica guardado em área protegida. Só a organização do campeonato pode abrir, e só quando precisa conferir.'
export const PRIVACIDADE_CPF = 'O CPF e os telefones ficam guardados em segredo. Depois de salvos, aparecem só com parte escondida.'
export const AVISO_MENOR_RESPONSAVEL = 'Atleta menor de 18 anos: o responsável legal precisa autorizar o uso da foto, do documento e dos dados.'
export const TEXTO_ALTERAR = 'Alterar'
export const TEXTO_MANTER = 'Manter como está'
export const TEXTO_SALVE_PRIMEIRO = 'Depois de salvar o atleta você poderá enviar a foto e o documento. Se já escolheu os arquivos, eles são enviados ao salvar.'

export function textoCampoMascarado(mascara: string): string {
  return `Salvo: ${mascara}`
}
