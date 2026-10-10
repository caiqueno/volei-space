---
title: >-
  Equipes e atletas
category: modulo
tags: [equipes]
sources: [repo:athrios/volei-space]
summary: >-
  Gestão de equipes e atletas.
status: misto
created: 2026-09-20
updated: 2026-10-10
---
# Equipes e atletas

**Implementado:** entidades `Equipe` e `Jogador` em `prisma/schema.prisma`; APIs de equipes/jogadores, foto, QR e inscrição em `src/app/api`. Categorias/séries aparecem na equipe e na configuração do campeonato. A página pública `/equipes/[slug]` lista os jogos pelos sets (`setsPorA`/`setsPorB`).

O nome da equipe é gravado em maiúsculas no servidor, com `normalizarNomeEquipe` (NFC, espaços colapsados, `pt-BR`). Entram criação e edição de equipe, rascunho e finalização da inscrição, candidatura, capitão, convite, vaga, webhook, simulação, massa de QA e a importação de times em `scripts/import-winners.mjs`. A função `finalizar_inscricao_equipe_rascunho` copia o nome do rascunho; o rascunho é atualizado antes da chamada. Não houve migration. Nome de atleta, árbitro e quadra não muda. Na tela, `NomeEquipe` e a classe `.nome-equipe` repetem a maiúscula. O slug continua em minúsculas.

**Aprovado, pendente:** a equipe do fluxo novo é criada pelo líder a partir de um convite específico; não precisa existir nem ser aprovada antes de gerar o link. O organizador acompanha elenco e estado por categoria. Dados salvos sobrevivem ao reload e respeitam regras de edição do campeonato.

**Isolamento aprovado, pendente:** a equipe deverá pertencer a uma `CategoriaCampeonato` da `Liga` por `categoriaCampeonatoId` sempre que aplicável. A string `Equipe.categoria` e a série legada não garantem esse isolamento; equipes de categorias diferentes não podem compartilhar grupos, classificação ou confrontos. Ver [[references/CATEGORIAS-COMO-COMPETICOES]].

Atenção a jogadores banidos, números de camisa e presença. A foto do atleta é opcional na inscrição e no painel do capitão, mesmo com QR; o envio continua quando a imagem é escolhida. Não confunda cadastro de atletas com autorização de participação em outra equipe ou campeonato. Ver [[modulos/INSCRICOES]] e [[modulos/SUMULA-DIGITAL]].
