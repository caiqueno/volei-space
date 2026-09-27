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
updated: 2026-09-27
---
# Classificação

**Implementado:** a página `/classificacao` mostra uma tabela por campeonato, fechada. O nome do campeonato fica numa barra e o botão + fica no fim dela. Dentro do campeonato, categorias diferentes não entram na mesma tabela. A página lê a tabela já gravada. O recálculo roda quando um resultado é registrado (súmula, resultado manual ou aprovação), não a cada visita. A pontuação vigente é a da função SQL daquele campeonato: 3 pontos na vitória por 2×0 e 2 pontos na vitória por 2×1.

**Aprovado, pendente:** organizador define pontos do vencedor e do perdedor para **margem de 1 set** e **margem de 2 ou mais sets**. 2×0 e 3×0 compartilham a mesma faixa, e 2×1 usa a outra. O cálculo por placar exato existente não pode retornar fallback silencioso para um resultado que pertença à faixa configurada.

Resultado manual, aprovação histórica, súmula e correção precisam produzir tabela coerente. Classificação de fase de grupos e eliminatórias requer escopo correto; não misturar jogos de campeonatos ou fases. Ver [[modulos/SUMULA-DIGITAL]] e [[06-BANCO-DE-DADOS]].

**Categorias — aprovado, pendente:** cada `CategoriaCampeonato` terá tabela e classificados próprios. Recálculo e consulta pública devem usar `categoriaCampeonatoId` na arquitetura-alvo e jamais somar partidas de outra categoria; o modelo atual por strings pode misturá-las. Ver [[references/CATEGORIAS-COMO-COMPETICOES]].
