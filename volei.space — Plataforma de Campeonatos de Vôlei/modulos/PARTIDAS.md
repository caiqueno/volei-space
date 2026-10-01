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
updated: 2026-10-01
---
# Partidas e calendário

**Implementado:** modelos `Partida`/`SetPartida`, calendário e gestão em `src/app/api/organizador/ligas/[id]/calendario`, `src/app/api/partidas` e `src/app/api/organizador/partidas`; acompanhamento em `src/app/partidas/[id]/ao-vivo`. A leitura pública e a ao vivo usam o vínculo composto da equipe (`Partida_equipeAId_fkey` e `Partida_equipeBId_fkey`). O vínculo simples antigo fazia o portal e a lista de jogos falharem e aparecerem vazios. O portal separa em andamento, próximos e encerrados e reconsulta a cada 8 segundos. Sem campeonato escolhido, a agenda pública reúne todos os campeonatos que não são simulação; o campeonato mais novo e ainda sem jogos não esconde os demais. Não há inscrição no Realtime. Em `/jogos`, o primeiro nível é a barra com o nome da tabela, como Copa Masculina. Dentro dela ficam as barras de cada rodada. No painel, a tabela de jogos tem a coluna «Árbitro responsável» e a coluna «Acesso do árbitro». O organizador designa, troca ou remove o primeiro árbitro enquanto a partida está agendada. A gravação fica em `EscalaArbitro`. O acesso oficial à tela do jogo é outro: o organizador gera um link com token aleatório, define o código e pode copiar, ver, trocar o código, regenerar o token ou revogar. O código não entra na URL e fica gravado só como hash em `AcessoArbitroJogo`. O árbitro abre `/arbitro/jogo/{token}`, informa o código e segue para `/arbitro/partida/{token}`. Link revogado responde que o organizador revogou o acesso. Cinco códigos errados bloqueiam novas tentativas por 15 minutos. Os eventos ficam em `AcessoArbitroEvento`. Um id numérico de outra partida não abre esse acesso. As tabelas têm RLS e não são legíveis pela chave publicável.

As partidas pertencem a um campeonato e envolvem equipes compatíveis com sua estrutura. Resultado oficial alimenta classificação e rankings. O calendário e confrontos não devem surgir como efeito de **gerar convite** de inscrição; somente etapas operacionais adequadas depois do cadastro e da configuração.

**Aprovado, pendente:** encerramento, vencedor, último set, MVP e correção seguem [[modulos/SUMULA-DIGITAL]]. Quando resultado mudar, rever [[modulos/CLASSIFICACAO]] e [[modulos/SCOUTS]].

**Categorias — aprovado, pendente:** partida e rodada devem pertencer a uma única `CategoriaCampeonato` por `categoriaCampeonatoId` no modelo-alvo. Geração e correção não podem envolver equipe de outra categoria; resultados, campeão e pódio permanecem isolados. `Partida.categoria` textual atual não garante isso. Ver [[references/CATEGORIAS-COMO-COMPETICOES]].
