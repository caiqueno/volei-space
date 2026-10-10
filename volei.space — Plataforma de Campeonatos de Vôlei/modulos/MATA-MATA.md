---
title: >-
  Mata-mata
category: modulo
tags: [mata-mata]
sources: [repo:athrios/volei-space]
summary: >-
  Classificados incluem os melhores gerais; a final define o campeão antes de finalizar.
status: misto
created: 2026-09-20
updated: 2026-10-10
---
# Mata-mata

**Implementado:** funções em `src/lib/mata-mata.ts`, `src/lib/classificados.ts` e `src/lib/eliminatorias.ts`; rotas de estrutura e chaveamento em `src/app/api/organizador/ligas/[id]/mata-mata`. A parametrização define formato e fase eliminatória; as validações de capacidade estão em `src/lib/championship-validation.ts`. O insert da chave grava `categoriaCampeonatoId` da equipe e `serie` nula, e recusa confronto entre categorias diferentes. Slot, alimentadores e classificados são lidos só nessa categoria, então duas categorias podem ter a mesma final na rodada 1. Com categoria informada, fase e disputa de 3º lugar vêm de `CategoriaConfiguracao`. O mata-mata é jogo único: volta responde 409 na rota e o índice parcial do banco também impede o segundo jogo. A classificação vigente soma só fases `GERAL` e `GRUPOS`; a chave não entra na tabela. A página pública `/campeonatos/[slug]` e `/fase-mata-mata` mostram a chave da categoria escolhida (a primeira, se a URL não pedir outra) e, com status `FINALIZADO`, o pódio de `getChampionshipPodium` dessa categoria (final e disputa de 3º lugar).

A chave legado usa os N primeiros de cada grupo e, em seguida, `melhoresClassificadosGerais`. Sem grupos, o mata-mata puro leva todas as equipes da tabela. O confronto seguinte só aceita os vencedores dos dois jogos que o alimentam; o 3º lugar só aceita os perdedores das semifinais e só existe quando `disputaTerceiroLugar` não está desligado. WO com `vencedorId` e sets 0×0 também avança. `POST /api/organizador/ligas/[id]/finalizar` recusa o campeonato sem campeão: final decidida no mata-mata, ou líder com jogo válido nos pontos corridos. A disputa de 3º lugar, quando ligada e há semifinal, também precisa estar decidida.

**Ainda no banco:** `classificados_categoria` não devolve ninguém quando o formato não é mata-mata e não há grupos. `criar_confronto_categoria` ignora `vencedorId` e não tem vaga para ida e volta — o índice único é um jogo por fase e slot. Um número ímpar de equipes no calendário automático continua sem bye, porque não há coluna para isso.

Relacionados: [[modulos/GRUPOS]], [[modulos/PARTIDAS]], [[modulos/SUMULA-DIGITAL]].

**Categorias — aprovado, pendente:** sem `CategoriaConfiguracao`, a chave ainda cai em `Liga.faseEliminatoria`. O índice único do mata-mata já inclui a categoria; esta entrega não criou migration. Ver [[references/CATEGORIAS-COMO-COMPETICOES]].
