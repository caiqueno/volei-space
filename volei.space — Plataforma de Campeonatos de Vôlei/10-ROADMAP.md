---
title: >-
  Roadmap
category: area
tags: [roadmap]
sources: [repo:athrios/volei-space]
summary: >-
  Sequência de trabalho.
status: misto
created: 2026-09-20
updated: 2026-09-25
---
# Roadmap de validação

**Estado em 21/09/2026.** Atualize status a partir dos merges e verificações, não apenas de relatos de trabalho em branches.

| Prioridade | Entrega | Estado |
| --- | --- | --- |
| 1 | Inscrição por categoria, convite exclusivo antes da criação da equipe e sem aprovação manual | Requisito aprovado; PR #1 aberto exige adaptação ao fluxo corrigido |
| 1 | Categorias como competições isoladas, com entidade persistida e migração dos vínculos textuais | Requisito aprovado em [[references/CATEGORIAS-COMO-COMPETICOES]]; implementação pendente; revisar dependência do PR #1 antes do merge |
| 2 | Súmula parametrizada, substituições, MVP, correção e classificação por margem | Requisito aprovado; implementação pendente |
| 3 | Verificação cruzada de banco, RLS, checkout e fluxos públicos | Auditoria antes da validação operacional |
| 4 | Reescrever README e backlog legados à luz do produto entregue | Pendente |

Para qualquer entrega: conferir código atual → implementar em branch → testar fluxos e limites → revisar alterações/migrations → atualizar esta nota e notas de módulo. Não trate um PR aberto como produção. Problemas concretos: [[12-BUGS-E-DEBITOS-TECNICOS]].
