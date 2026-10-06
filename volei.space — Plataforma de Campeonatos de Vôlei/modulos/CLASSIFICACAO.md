---
title: >-
  Classificação
category: modulo
tags: [classificacao]
sources: [repo:athrios/volei-space/docs/requisitos/SUMULA-DIGITAL-E-CLASSIFICACAO.md]
summary: >-
  Tabela e critérios.
status: aprovado-pendente
created: 2026-09-20
updated: 2026-10-06
---
# Classificação

**Implementado:** a página `/classificacao` lista os campeonatos públicos e abre a tabela na própria tela. Equipes ativas aparecem com zero antes de qualquer partida. A página lê `ClassificacaoEntrada`. A função `recalcular_classificacao_liga` soma jogos, vitórias, derrotas e pontos do campeonato só das partidas encerradas da fase de grupos. O set que já fechou numa partida `EM_ANDAMENTO` entra no saldo de sets e de pontos na hora, sem esperar o fim do jogo. O placar do set em aberto fica na partida, não na tabela. O recálculo do campeonato daquela súmula roda ao iniciar a partida, ao fechar um set e ao encerrar o jogo. A tela escuta `ClassificacaoEntrada` pelo Realtime e relê o campeonato ao reconectar. A pontuação vigente é a da função SQL daquele campeonato.

**Aprovado, pendente:** organizador define pontos do vencedor e do perdedor para **margem de 1 set** e **margem de 2 ou mais sets**. 2×0 e 3×0 compartilham a mesma faixa, e 2×1 usa a outra. O cálculo por placar exato existente não pode retornar fallback silencioso para um resultado que pertença à faixa configurada.

Resultado manual, aprovação histórica, súmula e correção precisam produzir tabela coerente. Classificação de fase de grupos e eliminatórias requer escopo correto; não misturar jogos de campeonatos ou fases. Ver [[modulos/SUMULA-DIGITAL]] e [[06-BANCO-DE-DADOS]].

**Categorias — aprovado, pendente:** cada `CategoriaCampeonato` terá tabela e classificados próprios. Recálculo e consulta pública devem usar `categoriaCampeonatoId` na arquitetura-alvo e jamais somar partidas de outra categoria; o modelo atual por strings pode misturá-las. Ver [[references/CATEGORIAS-COMO-COMPETICOES]].
