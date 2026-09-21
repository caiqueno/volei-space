# Parametrização do campeonato

**Implementado no código:** central em `src/app/painel/parametrizacao`, endpoints `src/app/api/organizador/ligas/[id]/setup/*` e estados/validações em `src/lib/championship-setup-*.ts`. Seções encontradas: informações, estrutura, inscrições, classificação, eliminatórias, calendário e prévia.

**Aprovado, pendente:** configuração de alvo livre dos sets regulares, alvo distinto do último set, terceiro set obrigatório em melhor de 3 e pontos de vencedor/perdedor por margem. Inscrição deve admitir convites por categoria antes da criação de equipes, sem aprovação manual. Conferir campos e dependências antes de concluir uma seção.

**Dependências:** [[modulos/INSCRICOES]], [[modulos/SUMULA-DIGITAL]], [[modulos/CLASSIFICACAO]], [[modulos/PAGAMENTOS]]. A parametrização define regras; não deve inventar equipe, partida ou pagamento somente por salvar uma seção.
