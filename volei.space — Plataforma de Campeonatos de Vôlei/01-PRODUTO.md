---
title: >-
  Produto
category: area
tags: [produto]
sources: [repo:athrios/volei-space]
summary: >-
  Visão, usuários e vocabulário do SaaS.
status: implementado
created: 2026-09-20
updated: 2026-09-25
---
# Produto

**volei.space** é uma plataforma SaaS para organizações e organizadores criarem, configurarem, operarem e divulgarem campeonatos de vôlei. A organização administra seus campeonatos; atletas, líderes de equipe, árbitros e público interagem com partes específicas do fluxo. O produto não organiza uma liga própria.

## Vocabulário

| Produto | Significado | Termo técnico encontrado no legado |
| --- | --- | --- |
| Organização | Entidade responsável pelos campeonatos | Campos de perfil do organizador |
| Organizador | Usuário que configura e opera seus campeonatos | `organizadorId` |
| Campeonato | Competição criada pelo organizador | `Liga`, `ligaId` |
| Categoria | Recorte competitivo configurado no campeonato | `categoriasConfig`, categoria/série em equipes |
| Equipe | Time participante de um campeonato | `Equipe` |
| Atleta | Jogador cadastrado em uma equipe | `Jogador` |
| Partida | Confronto entre duas equipes | `Partida` |
| Súmula | Registro da partida e dos scouts | `SetPartida`, `OcorrenciaPartida`, `DestaquesPartida` |

## Limites e estado

O código contém painel, área pública, parametrização, inscrições, estrutura competitiva, partidas, súmula e classificação. Existência de rota não comprova que todo o fluxo esteja pronto para produção. O produto está em validação.

**Aprovado, pendente:** inscrição iniciada por convite exclusivo da equipe dentro da categoria, sem aprovação manual; súmula subordinada à parametrização de sets, classificação por margem, MVP obrigatório e correções temporizadas. Ver [[03-REGRAS-DE-NEGOCIO]].

A liga LUVA é origem histórica do código. Seus regulamentos, cronogramas e políticas comerciais não são regras globais do volei.space. Ver [[historico/LEGADO-LUVA]].
