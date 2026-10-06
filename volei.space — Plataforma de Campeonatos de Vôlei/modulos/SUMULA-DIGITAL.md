---
title: >-
  Súmula digital
category: modulo
tags: [sumula]
sources: [repo:athrios/volei-space/docs/requisitos/SUMULA-DIGITAL-E-CLASSIFICACAO.md]
summary: >-
  Registro da partida e scouts.
status: misto
created: 2026-09-20
updated: 2026-10-06
---
# Súmula digital

**Implementado parcialmente:** cada jogo, no painel e no card público, oferece «Súmula digital», «Link público» e «Resumo da partida». Não há tabela separada de súmula: o registro é a `Partida`, com `sumulaToken` único. `/sumula/{token}` é a visualização somente leitura do que o árbitro lançou: informações, escalação, líbero de cada set, sets, tempos, eventos e resultado. O número do líbero continua válido quando a frase termina com ponto. Essa tela não tem acompanhar ao vivo, 2D, 3D, inverter nem campos editáveis. A consulta pública é `GET /api/sumula/{token}?consulta=1` e não devolve documento, telefone nem e-mail. O árbitro continua lançando a partida em `/sumula/{token}/lancar`, com a quadra. Iniciar a partida abre esse lançamento. A rota `/sumula/{token}` também abre pelo id da partida. A quadra do lançamento fica em `src/components/sumula/QuadraVolei.tsx`. Quem opera escolhe 2D ou 3D nessa tela de lançamento. A 3D usa a imagem da quadra. A 2D mostra as duas equipes de frente, com a rede no meio. O botão Inverter troca o lado da quadra também na 2D. O nome do atleta fica abaixo do número. Na pontuação em 3D, o sacador tem ace, ponto de ataque e substituição; a rede (P2, P3, P4) tem ponto, bloqueio e substituição; P5 e P6 têm ponto e substituição. O oval de quem saca pisca em amarelo. Essas ações usam o lançamento de ponto já existente e não criam outro placar. A formação continua sendo a escalação já gravada na ocorrência de rotação; arrastar um atleta só vale antes da confirmação e não mexe no placar. Página `src/app/sumula/[token]/page.tsx`, API `src/app/api/sumula/[token]/route.ts` e leitura em `src/lib/sumula-access.ts`. A rota aceita o id da partida ou o `sumulaToken` já gravado. Abrir exige sessão do árbitro escalado ou do organizador da liga. Sem sessão a resposta é 401; sem escala, 403; partida inexistente, 404; token com `sumulaTokenExpira` no passado, 410. A tela usa essa mensagem e não chama toda falha de link expirado. A presença da partida fica em `SumulaPresenca`: sem linha é Pendente, `presente=true` é Confirmado e `presente=false` é Ausente. O árbitro grava isso em `POST /api/arbitro/partidas/[token]/presenca` sem apagar o atleta. Iniciar a partida marca `EM_ANDAMENTO` uma vez e abre `/sumula/{id}`. Gravar ou encerrar a súmula continua exigindo o árbitro escalado. O placar usa a regra já aprovada do set: alvo configurado e diferença mínima de 2, sem teto. Partida encerrada recusa lançamento comum. Cada gravação de placar, presença ou início acrescenta uma ocorrência «Registro de …», preservada na substituição dos eventos. Oficializar exige o MVP de um atleta da equipe vencedora, na tela e em `POST /api/sumula/[token]`. A substituição por equipe e set fica em 8. A contagem e o par saem das ocorrências já gravadas quando a súmula reabre. Oficializar uma partida já encerrada, mas ainda sem `sumulaAprovadaEm`, grava a súmula e devolve `/partidas/{id}/ao-vivo`. Esse endereço abre sem login. Se a súmula já estava oficial, o botão abre o mesmo endereço. Campeonato real continua exigindo 6 atletas validados; simulação com elenco menor pode oficializar só essa página, sem entrar no portal. Se o recálculo da classificação falhar depois da gravação, a súmula permanece publicada e o endereço público é devolvido. Não há colunas próprias de início; o horário e o árbitro ficam na ocorrência.

**Origem do ponto — implementado:** o `+1` da súmula pede saque, bloqueio ou ataque e o atleta em quadra. O placar da equipe mostra na hora `+1 Ponto de Saque`, `+1 Ponto de Bloqueio` ou `+1 Ponto de Ataque`, com o nome do jogador. A mesma frase entra no histórico da súmula e nos lances de `/partidas/{id}/ao-vivo`. O banco continua em `OcorrenciaPartida`: `partidaId`, `jogadorId` e `tipo` `ace`, `attack` ou `block`. A equipe é a do atleta e o valor do ponto é 1. Ponto genérico, sem origem, fica só para o ponto automático do cartão vermelho. Tentativas que não marcam ponto ainda não são lançadas.

## Regras aprovadas, pendentes de conformidade

- Sets regulares com alvo `Np` livre; último set com alvo `Nt` separado; todo set requer alvo e dois pontos de diferença, sem teto.
- Melhor de 3 termina em 2×0 somente quando terceiro set não for obrigatório. Quando for, registrar o terceiro com pontuação configurada.
- Oito substituições por equipe e set e o MVP da vencedora antes de oficializar estão no fluxo. A sugestão automática por `attack`, `block` e `ace`, com desempate, continua pendente. Líbero somente informativo.
- Resumo público destaca nome, número, posição e scouts da partida do MVP.
- Link corrige até 30 minutos do primeiro encerramento; depois só organizador autenticado e autorizado. Corrigir atualiza dados derivados e preserva autoria/histórico.
- A gravação final não pode deixar resultado, scouts e classificação parcialmente atualizados.

[Requisito completo](https://github.com/athrios/volei-space/blob/main/docs/requisitos/SUMULA-DIGITAL-E-CLASSIFICACAO.md). Ver [[modulos/PARTIDAS]], [[modulos/CLASSIFICACAO]] e [[12-BUGS-E-DEBITOS-TECNICOS]].
