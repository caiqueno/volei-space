---
title: >-
  Parametrização
category: modulo
tags: [parametrizacao]
sources: [repo:athrios/volei-space]
summary: >-
  Configuração do campeonato.
status: misto
created: 2026-09-20
updated: 2026-09-27
---
# Parametrização do campeonato

**Implementado no código:** central em `src/app/painel/parametrizacao`, endpoints `src/app/api/organizador/ligas/[id]/setup/*` e estados/validações em `src/lib/championship-setup-*.ts`. Seções encontradas: informações, estrutura, inscrições, classificação, eliminatórias, calendário e prévia.

O nome que vale nas listas é o campo Nome do campeonato. Se ele ainda estiver no provisório «Novo campeonato» e o nome curto estiver preenchido, o nome curto passa a ser o nome do campeonato. No passo Identidade, o organizador envia uma imagem. Essa mesma imagem fica em `logoUrl` e `capaUrl`. Formato e quantidade de equipes podem ser gravados enquanto não houver partida iniciada ou encerrada. Em qualquer seção, o campo obrigatório que ficou vazio pisca em vermelho e a tela volta até ele. Em Calendário e local, a data aceita o fuso que o banco devolve e o motivo da falha aparece embaixo do campo (início, término, nome, endereço ou quadra). Os critérios de classificação só contam depois que o organizador escolhe ao menos um.

**Aprovado, pendente:** configuração de alvo livre dos sets regulares, alvo distinto do último set, terceiro set obrigatório em melhor de 3 e pontos de vencedor/perdedor por margem. Inscrição deve admitir convites por categoria antes da criação de equipes, sem aprovação manual. Conferir campos e dependências antes de concluir uma seção.

**Categorias — aprovado, pendente:** na primeira etapa, informar quantidade e nomes das categorias. Cada registro persistido de `CategoriaCampeonato` pertencerá à `Liga`; os registros, não um contador textual, serão a fonte de verdade. Regras esportivas podem ser comuns ao campeonato; configurações diferentes por categoria dependem de nova decisão. Modelo atual por strings requer migração. Ver [[references/CATEGORIAS-COMO-COMPETICOES]].

**Dependências:** [[modulos/INSCRICOES]], [[modulos/SUMULA-DIGITAL]], [[modulos/CLASSIFICACAO]], [[modulos/PAGAMENTOS]]. A parametrização define regras; não deve inventar equipe, partida ou pagamento somente por salvar uma seção.
