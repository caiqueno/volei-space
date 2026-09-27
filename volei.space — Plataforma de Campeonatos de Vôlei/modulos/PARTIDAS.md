---
title: >-
  Partidas
category: modulo
tags: [partidas]
sources: [repo:athrios/volei-space]
summary: >-
  Confrontos entre equipes.
status: misto
created: 2026-09-20
updated: 2026-09-25
---
# Partidas e calendário

**Implementado:** modelos `Partida`/`SetPartida`, calendário e gestão em `src/app/api/organizador/ligas/[id]/calendario`, `src/app/api/partidas` e `src/app/api/organizador/partidas`; acompanhamento em `src/app/partidas/[id]/ao-vivo`. Em `/jogos`, o primeiro nível é a barra com o nome da tabela, como Copa Masculina. Dentro dela ficam as barras de cada rodada.

As partidas pertencem a um campeonato e envolvem equipes compatíveis com sua estrutura. Resultado oficial alimenta classificação e rankings. O calendário e confrontos não devem surgir como efeito de **gerar convite** de inscrição; somente etapas operacionais adequadas depois do cadastro e da configuração.

**Aprovado, pendente:** encerramento, vencedor, último set, MVP e correção seguem [[modulos/SUMULA-DIGITAL]]. Quando resultado mudar, rever [[modulos/CLASSIFICACAO]] e [[modulos/SCOUTS]].

**Categorias — aprovado, pendente:** partida e rodada devem pertencer a uma única `CategoriaCampeonato` por `categoriaCampeonatoId` no modelo-alvo. Geração e correção não podem envolver equipe de outra categoria; resultados, campeão e pódio permanecem isolados. `Partida.categoria` textual atual não garante isso. Ver [[references/CATEGORIAS-COMO-COMPETICOES]].
