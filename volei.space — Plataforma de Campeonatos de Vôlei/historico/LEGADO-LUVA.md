---
title: >-
  Legado LUVA
category: historico
tags: [historico, luva]
sources: [repo:athrios/volei-space]
summary: >-
  Origem histórica do código.
status: historico
created: 2026-09-20
updated: 2026-09-25
---
# Origem LUVA

O sistema nasceu para uma liga específica. O vault original continua em [`athrios/luv-liga-unica-de-volei/LUV - Liga Ultra Volleyball`](https://github.com/athrios/luv-liga-unica-de-volei/tree/main/LUV%20-%20Liga%20Ultra%20Volleyball) e contém regulamento, operação, financiamento, materiais e súmula daquela liga.

O produto atual é **volei.space**: cada organizador cria seus campeonatos. No código, `Liga`/`ligaId` podem designar campeonato, enquanto `LUV`/`LUVA` aparecem como legado. Não renomeie entidades técnicas apenas por estética sem examinar schema, migrations, APIs e dados.

**Exemplos que não devem migrar como regra geral:** três sets obrigatórios, 21 pontos, seis substituições, aprovação manual de equipes, administração de uma liga única e pontuação fixa. Regras atuais: [[03-REGRAS-DE-NEGOCIO]].
