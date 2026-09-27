---
title: >-
  Banco de dados
category: area
tags: [dados]
sources: [repo:athrios/volei-space]
summary: >-
  Entidades e relações.
status: implementado
created: 2026-09-20
updated: 2026-09-25
---
# Modelo de dados

`prisma/schema.prisma` descreve entidades; `supabase/migrations` documenta mudanças SQL e políticas. Confira o estado aplicado ao banco antes de concluir que uma coluna ou policy está ativa.

## Relações centrais

- Organizador → campeonatos (`Liga` no código).
- Campeonato → configuração de categorias, inscrições, partidas e estrutura competitiva.
- Inscrição → equipe (`Equipe`) → atletas (`Jogador`).
- Partida → sets (`SetPartida`), presenças (`SumulaPresenca`), ocorrências/scouts (`OcorrenciaPartida`) e destaques (`DestaquesPartida`).
- Campeonato → entradas da classificação calculada e grupos/chaveamentos.

`categoriasConfig` é configuração do campeonato; não presuma que «categoria» já corresponde a tabela própria. O requisito de convites por categoria exige escopo persistente mesmo antes da criação da equipe. Ver [[modulos/INSCRICOES]].

## Modelo-alvo de categorias — aprovado, pendente

`Liga` deverá conter registros próprios de `CategoriaCampeonato`. A quantidade declarada na parametrização precisa corresponder aos registros persistidos, que são a fonte de verdade. Convites e inscrições devem guardar no servidor o par `ligaId` + `categoriaCampeonatoId`; equipes, grupos, rodadas, partidas, classificação, classificados, chaveamento, scouts, rankings e resultados devem relacionar-se por `categoriaCampeonatoId` sempre que aplicável. Nenhuma dessas relações é aqui declarada existente. Campos textuais atuais de categoria e série exigem migração explícita e podem causar mistura entre categorias. Ver [[references/CATEGORIAS-COMO-COMPETICOES]].

## Invariantes

Uma equipe, inscrição, partida ou token deve ser verificado no campeonato correto. Resultado alterado exige recálculo de classificação e scouts relacionados. Para a súmula corrigível, preservar histórico e atomicidade da gravação; ver [[07-SEGURANCA]] e [[modulos/SUMULA-DIGITAL]].

No modelo-alvo, validar também a categoria persistida em toda leitura, gravação e recálculo competitivo; a integridade do campeonato isoladamente não garante isolamento entre categorias.
