---
title: >-
  Regras de negócio
category: area
tags: [regras]
sources: [repo:athrios/volei-space]
summary: >-
  Regras aprovadas do produto.
status: misto
created: 2026-09-20
updated: 2026-09-25
---
# Regras de negócio aprovadas

> [!warning] Aprovação não é implementação
> As regras abaixo foram definidas para o volei.space. Consulte as notas de módulo para descobrir onde o código ainda diverge.

## Categorias como competições — aprovado, pendente

Cada categoria de uma `Liga` é uma competição interna independente. Equipes, convites, inscrições, grupos, partidas, tabelas, classificados, eliminatórias, scouts, rankings e resultados não se misturam entre categorias. `CategoriaCampeonato` e `categoriaCampeonatoId` são a arquitetura-alvo; o modelo atual por strings precisa de migração. Regras esportivas podem ser comuns ao campeonato, sem presumir variações por categoria. Séries Ouro/Prata são legado LUVA, não divisões do volei.space. Especificação e critérios: [[references/CATEGORIAS-COMO-COMPETICOES]].

## Inscrições

Em cada categoria, o organizador pode apontar equipes a convidar. O link exclusivo nasce **antes de existir `Equipe`**. O líder cadastra equipe e jogadores pelo link, retoma dados após reload e conclui a inscrição **sem aprovação manual**. O token deve restringir no servidor o acesso ao par `ligaId` + `categoriaCampeonatoId`, ao convite e à equipe resultante. Ver [[modulos/INSCRICOES]], [[references/CATEGORIAS-COMO-COMPETICOES]] e [[references/INSCRICOES-POR-EQUIPE]].

## Sets, resultado e classificação

O organizador escolhe livremente a pontuação dos sets regulares (`Np`) e configura separadamente a do último set/tie-break (`Nt`). Um set termina ao atingir o alvo com **diferença mínima de dois pontos**, sem teto. Em melhor de 3, o terceiro set pode ser obrigatório; se não for, 2×0 encerra. Se for, 3×0 e 2×1 são resultados possíveis. O organizador define os pontos do vencedor **e do perdedor** para margens de **1 set** e de **2 ou mais sets**; 2×0 e 3×0 pertencem à mesma faixa. Ver [[modulos/SUMULA-DIGITAL]], [[modulos/CLASSIFICACAO]] e [texto canônico](https://github.com/athrios/volei-space/blob/main/docs/requisitos/SUMULA-DIGITAL-E-CLASSIFICACAO.md).

## Substituições, MVP e correção

Oito substituições por equipe e set; o mesmo par pode trocar e retornar repetidamente, respeitando o limite. Líbero gera apenas registro informativo. Antes da oficialização, selecionar MVP da vencedora; sugerir pelos scouts da partida e destacar nome, número, posição e scouts no resumo. O link corrige a súmula até 30 minutos do primeiro encerramento; depois, somente o organizador autorizado. Correção não renova o prazo e deve atualizar dados derivados. Ver [[modulos/SUMULA-DIGITAL]].

## Outras regras

Formato, grupos, calendário, eliminatórias e critérios de desempate variam conforme a parametrização do campeonato; não transplante regras fixas da LUVA. Para regras implementadas consulte `src/lib/championship-validation.ts`, `src/lib/mata-mata.ts`, `src/lib/eliminatorias.ts` e migrations de classificação.
