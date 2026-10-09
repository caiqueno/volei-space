---
title: >-
  Hot cache da sessão
category: area
tags: [hot, llm-wiki]
sources: [repo:athrios/volei-space]
summary: >-
  Correções de interface: marca volei.space, nova partida, inscrição e sair do admin.
status: implementado
created: 2026-09-25
updated: 2026-10-09
---

# Hot

## Foco atual

Correções só de interface, sem API nem banco. O cabeçalho e o rodapé mostram «volei.space». Fora da home, o cabeçalho reserva 72px até ler a sessão. Nova partida trata falha de rede e resposta que não é JSON, mostra erro e carregamento de campeonatos e equipes, busca as equipes uma vez e lista as categorias em `GET /api/categorias?ligaId=`. A inscrição da equipe não deixa o botão preso se a rede cair, avisa quando a sessão não tem equipe e separa erro de sucesso. Sair no admin reutiliza `encerrarSessaoPublica()`. Aprovar súmula não chama falha de conexão quando o corpo não é JSON.

"Ver mais" na agenda e em Jogos do painel não recolhe mais quando o Realtime relê a partida. A auditoria de 6 de outubro de 2026 correu antes de gerar qualquer massa e parou em seis falhas: a chave publicável lia `sumulaToken` e `Jogador` inteiro e aceitava `PATCH` em `Partida`; executava as RPC de classificação sem sessão; `GET /api/jogadores` devolvia CPF, documento e `qrCodeToken` sem sessão; a vitrine pública oferecia a súmula, que pede login; o acompanhamento ao vivo recusava partida de campeonato marcado como teste, deixando sem resposta o link da própria agenda; e a súmula engolia a falha do PUT. Todas corrigidas, publicadas na `main` e aplicadas em produção. O botão Sem jogador da súmula soma o ponto do time na hora, com `jogadorId` vazio e sem ação. A classificação pública e a do organizador mostram as equipes ativas com zero e passam a contar o set já encerrado enquanto a partida segue. Jogos, vitórias, derrotas e pontos do campeonato entram quando a súmula encerra. A agenda, o acompanhamento e a tabela escutam o Realtime e relêem o campeonato afetado ao reconectar. O painel desmonta a seção que saiu de vista. A galeria fica no campeonato, com foto principal em `Liga.capaUrl` e fotos em `Midia.thumbUrl`. O organizador cria o primeiro campeonato com nome, categoria e link; a estrutura não espera o pagamento simulado. «Finalizar campeonato» só aparece com status `ATIVA`. Esta fatia segue para a `main`. Fonte: [[modulos/PARTIDAS]].

## Key Takeaways

- A triagem de 4 de outubro de 2026 está na `main`. O portal por campeonato, a galeria e o botão Finalizar só em campeonato ativo entram na `main` em 5 de outubro.
- Em 5 de outubro a produção ganhou a função `selecionar_categorias_campeonato`, as políticas de upload e a coluna `Midia.thumbUrl`.
- A parametrização por categoria ativa e a comparação da replicação entram na `main` junto com o portal e a galeria.
- Produção, no commit `6f9c8f6`, responde `GET /api/ping` com alvo `producao`.
- Cada vaga parametrizada tem um link em `ConviteVagaEquipe`. O painel de jogos lê o `ligaId` da URL.
- O ao vivo do operador abre no painel (`/painel?secao=aovivo`). A súmula pública é só o registro; o lançamento fica em `/sumula/{token}/lancar`.

## Abrir primeiro

1. [[synthesis/PRONTIDAO-E-APIS]]
2. [[00-INICIO]]
3. [[modulos/INSCRICOES]] se a tarefa for inscrição
