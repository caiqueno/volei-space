---
title: >-
  Regras de negócio
category: area
tags: [regras]
sources: [repo:athrios/volei-space]
summary: >-
  Regras aprovadas do produto.
status: misto
created: 2026-09-20
updated: 2026-10-10
---
# Regras de negócio aprovadas

> [!warning] Aprovação não é implementação
> As regras abaixo foram definidas para o volei.space. Consulte as notas de módulo para descobrir onde o código ainda diverge.

## Categorias como competições — aprovado, pendente

Cada categoria de uma `Liga` é uma competição interna independente. Equipes, convites, inscrições, grupos, partidas, tabelas, classificados, eliminatórias, scouts, rankings e resultados não se misturam entre categorias. `CategoriaCampeonato` e `categoriaCampeonatoId` são a arquitetura-alvo; o modelo atual por strings precisa de migração. Regras esportivas podem ser comuns ao campeonato, sem presumir variações por categoria. Séries Ouro/Prata são legado LUVA, não divisões do volei.space. Especificação e critérios: [[references/CATEGORIAS-COMO-COMPETICOES]].

Desde 2026-09-28 este working tree grava `CategoriaCampeonato` e a configuração esportiva em `CategoriaConfiguracao`, a pedido de trazer a branch `feature/segregacao-categoria-precificacao` (`108d0b5`). O preço do organizador soma as categorias, com um único valor de ativação. A margem de set aprovada continua sendo a mínima de 2, sem teto: 23×19 com alvo 21 é válido. A branch exigia margem exatamente 2; isso não foi copiado. A classificação conta equipes `ATIVA` da categoria. O pagamento novo só segue depois que cada categoria ativa está `CONCLUIDA`. Sem `PAGAMENTO_HABILITADO`, o checkout simulado permanece. Com `false`, a ativação não é cobrada. Com `true`, a estrutura espera a confirmação. O levantamento está em `docs/comparacao-segregacao-categoria-precificacao.md`.

## Inscrições

Em cada categoria, o organizador pode apontar equipes a convidar. O link exclusivo nasce **antes de existir `Equipe`**. O líder cadastra equipe e jogadores pelo link, retoma dados após reload e conclui a inscrição **sem aprovação manual**. O token deve restringir no servidor o acesso ao par `ligaId` + `categoriaCampeonatoId`, ao convite e à equipe resultante. Ver [[modulos/INSCRICOES]], [[references/CATEGORIAS-COMO-COMPETICOES]] e [[references/INSCRICOES-POR-EQUIPE]].

## Sets, resultado e classificação

O organizador escolhe livremente a pontuação dos sets regulares (`Np`) e configura separadamente a do último set/tie-break (`Nt`). Um set termina ao atingir o alvo com **diferença mínima de dois pontos**, sem teto. Em melhor de 3, o terceiro set pode ser obrigatório; se não for, 2×0 encerra. Se for, 3×0 e 2×1 são resultados possíveis. O organizador define os pontos do vencedor **e do perdedor** para margens de **1 set** e de **2 ou mais sets**; 2×0 e 3×0 pertencem à mesma faixa. Ver [[modulos/SUMULA-DIGITAL]], [[modulos/CLASSIFICACAO]] e [texto canônico](https://github.com/athrios/volei-space/blob/main/docs/requisitos/SUMULA-DIGITAL-E-CLASSIFICACAO.md).

## Substituições, MVP e correção

Oito substituições por equipe e set. O par fica vinculado no set: quem entrou só sai para o titular voltar e, depois da volta, os dois não se substituem de novo naquele set. O requisito bruto ainda descreve a repetição do par dentro do limite; a decisão de 10/10/2026 fecha o par. Líbero gera apenas registro informativo e não entra na cota. Não há substituição excepcional. Antes da oficialização, selecionar MVP da vencedora; sugerir pelos scouts da partida e destacar nome, número, posição e scouts no resumo. O link corrige a súmula até 30 minutos do primeiro encerramento; depois, somente o organizador autorizado. Correção não renova o prazo e deve atualizar dados derivados. Ver [[modulos/SUMULA-DIGITAL]].

## Simulação — implementado no desenvolvimento

A Central de Simulações fica em `/admin/simulacoes` e só responde fora de produção, com o administrador oficial. Os campeonatos criados têm `Liga.simulacao = true` e não entram no portal, na lista pública, na classificação, no sitemap nem na inscrição rápida. A limpeza apaga somente essas linhas. Um campeonato real `FINALIZADO` continua bloqueado; a exceção do trigger vale só quando `simulacao = true`, para o cenário de teste poder ser recriado.

O relógio de cada partida fica em `Liga.simulacaoRelogio`. O painel lê o servidor a cada 8 segundos e desenha o tempo a partir desse instante, para duas telas não dependerem cada uma do próprio relógio. A tabela inteira não entra no Realtime. A migration `20261010140000` liga o RLS de `Liga`, mas ainda não foi aplicada, e a publicação continua sem as colunas da simulação. Quando uma partida de teste encerra, a classificação usa a função já existente `recalcular_classificacao_liga` (3 pontos no 2×0, 2 no 2×1, 1 para quem perde de 2×1). O requisito da súmula pede pares configuráveis por margem; essa função do banco ainda não lê `pontuacaoResultado`. O árbitro de teste passa a ter senha só fora de produção, para operar a partida em que foi escalado. Em produção esse e-mail não entra. A limpeza continua apagando só linhas `simulacao=true`.

O organizador designa o árbitro na tabela de jogos do painel, na coluna «Árbitro responsável». A alteração vale enquanto a partida está agendada. O árbitro vê e opera somente essa escala. Ele não se candidata à partida. Na operação, confirma ou marca ausente cada atleta daquela partida; isso não tira o atleta da equipe nem da inscrição. Iniciar a partida grava `EM_ANDAMENTO` e abre a súmula pelo id. A leitura da súmula exige o árbitro escalado ou o organizador da liga. A súmula grava o placar com a regra já existente do set (alvo configurado e diferença mínima de 2, sem teto) e recusa lançamento depois do encerramento. Cada gravação deixa uma ocorrência «Registro de placar», «Registro de presença» ou «Registro de início», com o árbitro e o horário. O MVP obrigatório antes de oficializar continua pendente na API.

## Finalização do campeonato — implementado

O status operacional ativo continua `ATIVA`. `ENCERRADA` segue o encerramento de temporada já existente. `FINALIZADO` é o estado terminal de consulta: o organizador dono, ou o administrador já autorizado, confirma em `POST /api/organizador/ligas/[id]/finalizar`. A gravação leva `status`, `finalizadoEm` e `finalizadoPor`, fecha inscrições e não apaga histórico. Depois disso, o painel só consulta e a API recusa alteração operacional. O portal público mantém a página pelo slug, com o selo Finalizado, fora do carrossel de ativos. A sincronização automática de status pelas partidas não reabre um campeonato finalizado.

## Outras regras

Formato, grupos, calendário, eliminatórias e critérios de desempate variam conforme a parametrização do campeonato; não transplante regras fixas da LUVA. Para regras implementadas consulte `src/lib/championship-validation.ts`, `src/lib/mata-mata.ts`, `src/lib/eliminatorias.ts` e migrations de classificação.
