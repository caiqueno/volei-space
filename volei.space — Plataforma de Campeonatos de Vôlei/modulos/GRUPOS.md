---
title: >-
  Grupos
category: modulo
tags: [grupos]
sources: [repo:athrios/volei-space]
summary: >-
  Fase de grupos.
status: misto
created: 2026-09-20
updated: 2026-10-10
---
# Grupos

**Implementado:** configuração de quantidade e regras em `setup/estrutura`; distribuição real de equipes e confrontos em `src/app/api/organizador/ligas/[id]/estrutura/route.ts`; migrations de grupos em `supabase/migrations`. A geração exige o id de uma `CategoriaCampeonato` do campeonato, usa a `CategoriaConfiguracao` dessa categoria e não grava `Liga.quantidadeGrupos`. Apaga só grupos, vínculos e partidas ainda não iniciadas das fases `GRUPOS` e `GERAL` dessa categoria; se a exclusão esbarrar em chave, esses jogos são cancelados. Mata-mata não entra. Jogo em andamento, encerrado, com súmula, placar ou vencedor dessa categoria bloqueia a nova geração. Outra categoria permanece. A tela `/painel/estrutura` escolhe a categoria antes de salvar grupos ou calendário. O insert grava `categoriaCampeonatoId` e deixa `serie` nula — o gatilho `guard_category_scope` recusa série. Confrontos novos recebem `sumulaToken` aleatório; o token já salvo não é trocado. `GET` da estrutura devolve `setsPorA`, `setsPorB` e `sumulaToken`, senão a súmula do árbitro não acha a partida. `Partida.atualizadoEm` tem default `now()` na migration `202610090004_partida_atualizado_em_default.sql`; sem isso o insert do cliente chega nulo e o banco recusa o confronto. Essa migration ainda não está aplicada em produção. O isolamento desta nota não criou migration.

A definição de grupos do campeonato não se confunde com o convite de equipe por categoria. Convites não devem entrar na distribuição competitiva até o cadastro da equipe estar concluído. Quantidade de classificados deve ser compatível com a fase eliminatória configurada.

Para apresentação pública e classificação, preserve o campeonato, categoria e fase corretos. Ver [[modulos/PARAMETRIZACAO]], [[modulos/INSCRICOES]], [[modulos/MATA-MATA]].

**Aprovado, pendente:** campeonato legado, sem categoria nas equipes, recebe 422 e não é apagado por inteiro. Leituras que ainda usam a string `categoria` fora deste fluxo continuam. O requisito em `docs/requisitos/CATEGORIAS-COMO-COMPETICOES.md` descreve o isolamento inteiro; convite e recálculo SQL não entraram aqui. Ver [[references/CATEGORIAS-COMO-COMPETICOES]].
