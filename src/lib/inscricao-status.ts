// A inscrição é automática: quem se inscreve (pelo link de categoria ou pela tela de
// campeonatos) entra direto, sem fila de aprovação. O limite de vagas continua valendo.
// O parâmetro existe só por compatibilidade com quem ainda passa o antigo
// Liga.inscricaoAprovacaoAutomatica; ele não muda mais o resultado.

export const STATUS_INSCRICAO_AUTOMATICA = 'APROVADA'

export function statusInicialDaInscricao(_aprovacaoAutomatica?: boolean | null) {
  void _aprovacaoAutomatica
  return STATUS_INSCRICAO_AUTOMATICA
}
