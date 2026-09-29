---
title: >-
  Fluxos
category: area
tags: [fluxos]
sources: [repo:athrios/volei-space]
summary: >-
  Jornadas ponta a ponta.
status: misto
created: 2026-09-20
updated: 2026-09-28
---
# Fluxos do produto

## Jornada do organizador

O administrador atribui usuário e senha em `/admin/acessos` e pode resetar essa senha na mesma tela. O organizador só entra com esses dados e não cria a própria conta. Na primeira entrada, e de novo depois de cada reset, a tela `/trocar-senha` pede para substituir a senha recebida por uma senha nova antes de abrir `/painel`. Com a conta ativa: perfil/organização → criação do campeonato → o painel mostra o link para a equipe preencher jogadores segundo as regras daquele campeonato → parametrização → estrutura e inscrições → equipes e atletas → calendário e confrontos → operação das partidas → classificação, rankings e área pública. No perfil, Árbitros cria o usuário e a senha de cada árbitro. Na primeira entrada, e depois de cada reset, o árbitro também substitui a senha antes de abrir o painel de partidas. As seções de parametrização têm dependências e validações; ver [[modulos/PARAMETRIZACAO]].

## Jornada do público

O login de administrador, organizador e público fica em `/login` e faz uma consulta só. A sessão já gravada abre a área do perfil sem a tela «Acesso restrito». Essa tela só aparece quando não há sessão. Sair volta para `/login`. O cadastro do perfil público fica em `/cadastro?modo=cadastro` e, ao concluir, volta para `/login?conta=criada` sem entrar automaticamente. A identificação confirma que a conta foi criada. Administrador abre `/admin`. Organizador abre `/painel`. Público abre `/portal` e vê campeonatos, jogos e tabela. No portal dessa conta não aparecem QR Code, súmula, os cartões de tabela e agenda, nem o fluxo da competição. Essa conta não abre o painel de gerenciamento.

**Aprovado, pendente:** na primeira etapa, o organizador informa a quantidade de categorias e nomeia cada competição interna. As categorias persistidas serão a fonte de verdade; os fluxos seguintes operam dentro da categoria selecionada. Ver [[references/CATEGORIAS-COMO-COMPETICOES]].

## Inscrição de equipe — aprovado, pendente

Categoria criada → organizador aponta equipe a convidar → link exclusivo por convite vinculado no servidor a `ligaId` + `categoriaCampeonatoId` → líder informa dados da equipe e jogadores, salva e retoma → conclui → equipe entra diretamente naquela categoria **sem aprovação manual**. O líder não troca a categoria do convite. Gerar link não deve produzir partidas ou classificação. O código atual ainda deve ser comparado a [[modulos/INSCRICOES]] e [[references/CATEGORIAS-COMO-COMPETICOES]].

## Partida — aprovado, pendente

Pré-jogo e escalação → pontuação por set segundo regras do campeonato → substituições/tempos/scouts → apuração do vencedor → seleção obrigatória do MVP da vencedora → oficialização atômica → recálculo de classificação e exibição pública → janela de correção de 30 minutos pelo link; depois, somente organizador. Ver [[modulos/SUMULA-DIGITAL]].

## Área pública

Rotas de campeonatos, equipes, jogos, classificação, rankings, mata-mata e acompanhamento ao vivo existem no código. Disponibilidade e dados expostos dependem do estado do campeonato. Ver [[05-MODULOS]].

**Aprovado, pendente:** permitir selecionar a categoria nas consultas públicas e limitar seus dados competitivos à categoria escolhida. O modelo atual baseado em strings pode misturá-las; ver [[references/CATEGORIAS-COMO-COMPETICOES]].
