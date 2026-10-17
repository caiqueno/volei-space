# 07 - Arquitetura do backend: motor de regras e log de eventos

Agente: backend. Rodada 1: **módulo puro + testes**. Rodada 2 (seção abaixo): motor ligado a uma rota NOVA, desligada por padrão (`SUMULA_EVENTOS_ATIVO=1`). O motor continua sem ligação com a tela (`lancar/page.tsx`) e com o fluxo atual da súmula. Nada aqui está em produção.

Fontes: `03-regras-validaveis.md`, `09-casos-de-jogo-e-validacao-arbitragem.md`, `10-estrategia-de-qualidade.md`, `04-gap-analysis-e-roadmap.md` (J01 a J10, J22), `docs/requisitos/SUMULA-DIGITAL-E-CLASSIFICACAO.md` (aprovado, implementação pendente).

## Decisões

1. **Módulo puro** em `src/lib/regras-volei/`: sem Next, sem Supabase, sem I/O, sem relógio. Entra estado e pedido, sai resultado. Serve ao cliente (aviso imediato) e ao servidor (bloqueio definitivo, J01).
2. **Resultado explicável**: `{ ok: true, avisos[] } | { ok: false, codigo: 'RG-XXX-000', mensagem }`. O código é o ID do `03`; a mensagem é em português para o apontador.
3. **Perfis configuráveis** (`config.ts`): `PERFIL_FIVB_CBV` (6 substituições, par A-B bloqueado) e `PERFIL_AMADOR` (8 com alerta de ilegalidade acima de 6; par repetido com aviso). Resolve D1 e D3 sem apresentar 8 como regra oficial.
4. **Itens [M] do `03` não viram teste.** Estão em `CONFIG_ITENS_M` com TODO: pontuação do WO em melhor de 3, combinação de categorias de sanção no mesmo membro, saque em 0x0 após penalidade entre sets, redesignado não joga como linha, placar exato do CJ-03, tempo técnico, contagem de substituição por jogador.
5. **Event sourcing** (J02): o log é append-only; placar, saque, rotação e contadores são derivados por `derivarPlacar(log, config)`. "Desfazer" é um evento `DESFAZ` com `desfazId`; o evento original nunca é apagado. Idempotência por `clientEventId`. Falta de rotação é um evento que cancela pontos da equipe faltosa na derivação (reversão seletiva, CJ-03) e pode ser desfeito.
6. **Estado de equipe serializável** (`EstadoEquipe`, arrays em vez de Set/Map) para ir em snapshot ou payload.

## Módulos

| Arquivo | Conteúdo | Regras |
| --- | --- | --- |
| `tipos.ts` | Resultado, aviso, equipe | todas |
| `config.ts` | Perfis, `ConfigPartida`, `CONFIG_ITENS_M` | D1, D2, D10 |
| `set-partida.ts` | Alvo, margem, decisivo, fim de partida, troca aos 8, saque inicial, tempos | RG-SET, RG-FOR-002/003, RG-TMP-001/002 |
| `rotacao.ts` | Rodízio, saque fora de ordem, falta de posição, reversão seletiva | RG-SAQ, RG-POS, RG-ROT |
| `estado-equipe.ts` | Estado por equipe e set | base |
| `substituicoes.ts` | Limite por perfil, par A-B, excepcional, incompleta, ilegal | RG-SUB-001..014 |
| `libero.ts` | Fundo, rally entre trocas, redesignação | RG-LIB |
| `sancoes.ts` | Sanções progressivas, atraso | RG-SAN, RG-TMP-007/008 |
| `wo-interrupcao.ts` | WO, WO duplo, incompleta, interrupção, set anulado | RG-WO, RG-INT |
| `eventos.ts` | `SumulaEvento`, `anexarEvento`, `derivarPlacar` | J02, RG-LOG |

`RG-LOG-001..006` são códigos do motor (não existem no `03`): 001 `clientEventId` ausente/repetido, 002 desfazer inválido, 003 alvo já desfeito ou DESFAZ de DESFAZ, 004 `seq` não contígua, 005 imutabilidade, 006 reconstrução determinística.

## Rodada 2: motor ligado ao servidor (implementado, rota DESLIGADA por padrão)

Estado: **implementado em código e testado com banco falso; não aplicado em banco algum**. A tabela `"SumulaEvento"` e o RPC `registrar_evento_sumula` vêm da migration PENDENTE `supabase/pendentes/migrations/202610170023_sumula_evento_append_only.sql` (não aplicada). O fluxo atual da súmula (`api/sumula/[token]` PUT/POST: delete+insert em `SetPartida`) **não foi tocado** e continua sendo o oficial.

### Derivação completa do estado das equipes

`derivarPlacar(log, config, contexto?)`: com o `ContextoDerivacao` (relação nominal de cada equipe, montada pelo servidor a partir de `Jogador`/`SumulaPresenca`, nunca vinda do cliente) devolve `estadoEquipes` = `EstadoEquipe` de A e B no set corrente (pares de substituição, contadores regular/excepcional, rally desde a última troca de líbero, pedido na interrupção, expulsos no set, desqualificados, sem retorno, líberos incapazes) mais o histórico de sanções. Sem contexto o resultado é o de antes. A derivação **revalida** substituição, troca/redesignação de líbero, sanção (recalculada pelo histórico; vale a calculada), tempo, interrupção (repetição decidida pela soma das paralisações), ordem de saque e saque de líbero, e registra `inconsistencias` em vez de confiar no que veio do cliente.

### Módulo `src/lib/sumula-eventos/`

| Arquivo | Papel |
| --- | --- |
| `servico.ts` | PURO. `validarNovoEvento(log, config, contexto, evento)`: idempotência, integridade do log, estado da partida, regra do tipo e simulação (anexa e deriva: se surgir inconsistência nova, recusa; cobre desfazer fora de ordem). `projetarEstado`: placar, saque, rotação, contadores, impedidos, limites. |
| `esquema.ts` | Zod do envelope e do payload por tipo (lote de até 50 eventos; `clientEventId` UUID). Sanção: o cliente envia só `equipe`, `membro`, `categoria`, `entreSets`; o servidor calcula `sancao` e `pontoParaAdversario`. |
| `mapeamento.ts` | Evento do motor <-> linha da tabela. O CHECK de `tipo` da tabela é menor que o do motor: o tipo do motor vai em `payload._motor` (fonte da verdade na leitura). `DESFAZ` da tabela aponta o `id` da linha; o do motor, o `seq`. Pendência para `banco-de-dados`: ampliar o CHECK. |
| `repositorio.ts` | Supabase (cliente injetado): leitura paginada por `seq`, chamada do RPC e tradução de erros (`40001` conflito, `23514` oficializada, `42P01`/`PGRST205`/`PGRST202` migration ausente). |
| `lote.ts` | Orquestra: duplicados, `seqEsperado`, validação, gravação evento a evento com `p_seq_esperado` = último seq local, aceitos/rejeitados. |
| `config-partida.ts`, `contexto.ts` | `CategoryMatchRules` -> `ConfigPartida` (limite de substituições >6 = perfil amador com aviso; tempos por set) e elenco da partida. |

Assinatura real do RPC usada: `registrar_evento_sumula(p_partida_id, p_client_event_id uuid, p_tipo, p_payload, p_autor_tipo, p_autor_ref, p_set_numero, p_equipe_id, p_jogador_id, p_desfaz_id, p_ocorrido_em, p_seq_esperado)` retornando `{ id, seq, duplicado }`. `p_jogador_id` vai nulo (os ids de jogador ficam no payload).

### Rota `GET/POST /api/sumula/[token]/eventos`

- **Flag**: sem `SUMULA_EVENTOS_ATIVO=1` responde **404** (antes de qualquer acesso a banco). Com a flag e sem a tabela/RPC: **503** com mensagem em português.
- **Autorização**: a mesma da súmula. GET: `requireSumulaTokenAccess` + `requireSumulaLeitura`. POST: `requireArbitroPartidaAccess` (link do jogo, árbitro escalado ou organizador da liga), mais `timesDefinidos` e `rejectIfCampeonatoFinalizado`. `sumula-access.ts` e `arbitro-access.ts` não foram alterados.
- **POST** `{ seqEsperado?, eventos: [{ clientEventId, tipo, payload, desfazId?, ocorridoEm? }] }` devolve `200 { data: { aceitos, rejeitados, estado } }`. Rejeitado = `{ indice, clientEventId, codigo: 'RG-xxx', mensagem }`. O primeiro rejeitado interrompe o lote; os seguintes voltam como `RG-LOG-009` (não processados). Reenvio com o mesmo `clientEventId` volta `aceito` com `duplicado: true`, sem regravar. `seqEsperado` desatualizado: **409** `{ error, details: { codigo: 'RG-LOG-010', seqAtual, aceitos, estado } }`, sem gravar nada (o reenvio do próprio lote já gravado não gera 409).
- **GET** devolve `{ data: { estado, eventos } }` (`?apartirDeSeq=N` filtra os eventos; o estado é sempre completo).

Códigos novos do servidor: `RG-LOG-007` desfazer deixaria o log inconsistente, `008` súmula oficializada, `009` não processado por rejeição anterior, `010` conflito de versão, `011` dados inválidos.

### Motor: correções desta rodada

WO: `placarPartida` (presente vence, ausente 0 [M]) separado de `parciaisRegistrados` (sets jogados + sets de WO com o alvo de cada set), `setInterrompido` guardado, WO recusado depois do último set. `declararLiberoIncapaz` sem exigir redesignação. `OBSERVACAO` continua válida depois de WO/repetição.

## Fora da rodada 2 (histórico; replay, lote, tolerância de WO, fechamento e protesto foram fechados na rodada 3, abaixo)

- Aplicar a migration (pede `banco-de-dados` e aprovação), ampliar o CHECK de `tipo`, `recalcular_placar_partida` e materialização em `SetPartida`/`Partida`.
- Tela/cliente falando com a rota; migração das súmulas em andamento (SNAPSHOT) e decisão de quando a rota nova substitui o PUT atual.
- Motor ainda pendente: formação recalculada por replay após falta de rotação (hoje só `formacaoCorrigida`); substituições em lote por pedido (`trocas[]`, contando uma por jogador); primeira troca de líbero com papeleta conferida; tolerância de WO (RG-WO-002) exige o horário, que não está no evento; RG-LIB-004 só é conferido quando o evento traz o sacador ou o líbero está na posição I.
- Itens [M] seguem configuráveis e sem teste que os fixe como oficiais: WO em melhor de 3, WO duplo, sanções mistas, saque em 0x0 após penalidade entre sets, placar exato do CJ-03.
- Praia (RG-PRA), assinatura e fechamento (RG-FEC), protestos (RG-PRO), PDF e súmula anexa.


## Rodada 3: pendências do motor fechadas (branch `feat/r3-motor-regras`)

Estado: **implementado em código e testado; rota ainda desligada (`SUMULA_EVENTOS_ATIVO`)**. Nenhuma tela, rota (`src/app`), migration ou banco foi tocado. Os tipos de evento novos precisam, quando a migration for ampliada, entrar no CHECK de `tipo` da tabela (hoje todos vão como `SAQUE` com o tipo real em `payload._motor`, ver `mapeamento.ts`).

### O que mudou

- **Lote por pedido (RG-SUB-007)**: `SUBSTITUICAO` aceita `trocas: [{ sai, entra }]` (1 a 6) OU `sai`/`entra`, nunca as duas formas. Cada jogador que entra conta 1 no limite do set (nos dois perfis); tudo ou nada; o "um pedido por interrupção" vale entre pedidos, não dentro do pedido. Excepcional segue 1 jogador por pedido.
- **Replay do rodízio (RG-ROT-001/002)**: a reversão (falta de rotação, discrepância de papeleta) refaz quem saca e as duas formações a partir da formação inicial do set, reaplicando só os pontos vivos e as trocas (substituição, líbero, redesignação) em ordem (`reconstruirRodizio`). `formacaoCorrigida` informada pelo árbitro continua prevalecendo para a equipe faltosa. O placar exato após o cancelamento continua [M] (CJ-03) e **nenhum teste o fixa**.
- **Papeleta (RG-FOR-006..009)**: `papeleta.ts` + evento `DISCREPANCIA_PAPELETA { equipe, fase, causa, jogador?, momentoSeq?, pontoDoRallyDaFaltaSeq?, formacaoCorrigida? }`. ANTES_DO_SET: sem sanção, sem ponto, rotação intacta. DEPOIS_DO_INICIO: reversão seletiva + ponto e saque ao adversário (RG-FOR-008; RG-FOR-009 para jogador fora da relação nominal). Segundo `SET_INICIADO` do mesmo set e `formacaoCorrigida` que muda jogador antes do set voltam `RG-FOR-006`. Fica de fora: perda de sets anteriores (0x25) quando o não registrado entrou em set anterior.
- **Elenco e líberos (RG-ELE-001/004/005, RG-LIB-001)**: `elenco.ts` (`validarElenco`, `capitaoEmJogo`, `validarDesignacaoDeCapitao`). Evento `CAPITAO_EM_JOGO`; `ContextoDerivacao.capitao` opcional; `PlacarDerivado.capitaesEmJogo`. No perfil, `maxJogadoresElenco` e `exigeDoisLiberosAcimaDe12` são **opt-in** (campos opcionais; `PERFIL_FIVB_COMPETICAO` os liga: 14 e 2 líberos acima de 12). Sem o campo o servidor não limita o elenco no `SET_INICIADO`.
- **Protesto (RG-PRO-001..003)**: eventos `PROTESTO_ANUNCIADO`, `PROTESTO_REGISTRADO` (com relato) e `PROTESTO_DESISTIDO`; `PlacarDerivado.protestos`. Registro e desistência valem depois do fim (inclusive WO). O motor **não decide o mérito** (RG-PRO-004): status, vencedor e sets não mudam. Exigir o anúncio prévio é o item [M] "não aceite": `ConfigPartida.protestoExigeAnuncio` (ausente = exige); o teste cobre as duas posições da flag, sem fixar a padrão como oficial.
- **Fechamento (RG-FEC-004, RG-SET-007/008)**: `calcularFechamento(log, config, contexto?)` devolve por set (placar, tempos, substituições, sanções por equipe, início, fim, duração) e totais da partida (tempos, substituições, sanções incluindo sets anulados, pontos, sets, início, fim, duração total com intervalos `"2h00"`, soma dos sets). Horários só existem quando o evento traz `criadoEm`; sem ele ficam `null`. `validarFechamento` recusa partida não terminada, log inconsistente e fim antes do início. Contadores novos: `contadores.{A,B}.sancoes` (sanção entre sets conta no set seguinte) e `SetDerivado.rallysRepetidos`.
- **RALLY_REPETIDO (RG-INT-001/002)**: payload `{ motivo? }` (`ACIDENTE_COM_BOLA_EM_JOGO`, `INTERFERENCIA_EXTERNA`, `OUTRO`). Sem ponto, mesmo sacador, formações intactas, e **não conta como rally concluído** (não libera novo pedido de substituição nem nova troca de líbero).
- **Tolerância de WO (RG-WO-002)**: `ConfigPartida.toleranciaWOMinutos` e `toleranciaWODuploMinutos` (do regulamento; os 30 e 15 minutos do Guia são só exemplos e **não são padrão**). `avaliarToleranciaWO(config, { horarioPrevisto, agora, duplo })` é pura. `validarNovoEvento(log, config, contexto, evento, agora?)` aplica a regra ao `WO` antes de qualquer set quando recebe `agora` e `contexto.horarioPrevisto`; a rota atual não passa `agora`, então a conferência fica inativa até a rota ser ligada ao relógio do servidor.

### Itens [M] / NÃO CONFIRMADOS: continuam configuráveis e sem teste que os fixe

WO em melhor de 3, WO duplo, sanções de categorias diferentes no mesmo membro, saque em 0x0 após penalidade entre sets, placar exato do CJ-03, líbero redesignado na linha, contagem de substituição por jogador (aqui aplicada por ordem da rodada, via `CONFIG_ITENS_M.substituicaoContaPorJogador`, que segue decorativa), tolerância de WO e exigência de anúncio de protesto.

### Tabela final: regra -> arquivo -> teste

| Regra | Arquivo (`src/lib/…`) | Teste (`scripts/…`) |
| --- | --- | --- |
| RG-SUB-007 (lote por pedido) | `regras-volei/substituicoes.ts` (`aplicarSubstituicaoLote`), `regras-volei/eventos.ts` (`trocasDoPayload`), `sumula-eventos/esquema.ts`, `servico.ts` | `regras-volei-substituicoes.test.ts`, `regras-volei-eventos.test.ts`, `sumula-eventos.test.ts` |
| RG-ROT-001/002 (replay) | `regras-volei/rotacao.ts` (`reconstruirRodizio`), `eventos.ts` (`reverterEPontuar`) | `regras-volei-eventos.test.ts` |
| RG-FOR-006 | `regras-volei/papeleta.ts`, `eventos.ts` | `regras-volei-papeleta.test.ts` |
| RG-FOR-007/008/009 | `regras-volei/papeleta.ts`, `eventos.ts`, `sumula-eventos/servico.ts` | `regras-volei-papeleta.test.ts`, `sumula-eventos.test.ts` |
| RG-ELE-001/004 | `regras-volei/elenco.ts`, `config.ts`, `sumula-eventos/servico.ts` | `regras-volei-elenco.test.ts` |
| RG-ELE-005 | `regras-volei/elenco.ts`, `eventos.ts` (`CAPITAO_EM_JOGO`) | `regras-volei-elenco.test.ts`, `regras-volei-papeleta.test.ts` |
| RG-LIB-001 | `regras-volei/libero.ts`, `config.ts` (`PERFIL_FIVB_COMPETICAO`), `servico.ts` | `regras-volei-elenco.test.ts`, `regras-volei-libero.test.ts` |
| RG-PRO-001..003 | `regras-volei/eventos.ts`, `sumula-eventos/esquema.ts`, `servico.ts` | `regras-volei-protesto.test.ts`, `sumula-eventos.test.ts` |
| RG-INT-001/002 (rally repetido) | `regras-volei/eventos.ts` | `regras-volei-protesto.test.ts`, `regras-volei-eventos.test.ts` |
| RG-FEC-004, RG-SET-007/008 | `regras-volei/fechamento.ts` | `regras-volei-fechamento.test.ts` |
| RG-WO-002 (tolerância) | `regras-volei/wo-interrupcao.ts`, `config.ts`, `sumula-eventos/servico.ts` | `regras-volei-wo-interrupcao.test.ts`, `sumula-eventos.test.ts` |

Agregador: `npm run test:regras-volei-r3`.

### Fora desta rodada

Ordem de assinatura (RG-FEC-002) e capitão ausente (RG-FEC-003); perda de sets anteriores no RG-FOR-009; passar `agora` e `horarioPrevisto` da partida a partir da rota; ampliar o CHECK de `tipo` na tabela; praia (RG-PRA); PDF e súmula anexa; RG-TMP-003/005/006; RG-LIB-014; os itens [M] acima.

## Rodada 8: revalidação no servidor em MODO SOMBRA (branch `feat/r8-servidor-sombra`)

Status: implementado, DESLIGADO por padrão. Não bloqueia nada.

### O que faz

Com `SUMULA_SERVIDOR_SOMBRA=1`, o `PUT /api/sumula/[token]` grava exatamente como antes e, só depois de gravar, revalida as ocorrências recebidas com o motor. A resposta ganha campos ADITIVOS; status HTTP e dados gravados não mudam. Sem a flag (ou com qualquer valor diferente de `1`) a resposta é idêntica à anterior e nenhuma computação extra acontece.

Fluxo (`src/lib/sumula-servidor/`): `interpretar.ts` lê o texto que a tela grava (`<hora> | <placar> | <texto>`, mais novo primeiro, marcadores `[[ROT]]`, `[[SAQUE]]`, `[[SAN]]`, `[[EXC]]`, `[[OVR]]`) e põe em ordem cronológica (`emOrdemCronologica`); `sombra.ts` traduz com `traduzirOcorrencia` (adaptador da tela), valida cada evento com `validarNovoEvento` contra o log acumulado, deriva o placar com `derivarPlacar` e compara com os sets gravados. O que o motor recusaria entra no log mesmo assim (a derivação o ignora), para o placar comparado refletir o que a tela registrou. Falha interna vira o aviso `SOMBRA-ERRO-INTERNO` (info) e o PUT segue.

### Como ler a resposta

```
{ salva: true, oficial: false, status: 'EM_ANDAMENTO',
  avisosMotor: [{ codigo, mensagem, severidade }],   // [] quando tudo confere
  divergenciaPlacar?: { sets: [{ numero, gravado:{a,b}, derivado:{a,b}|null }] } }
```

| severidade | significado |
| --- | --- |
| `erro` | o motor recusaria o lance se a regra já bloqueasse (código RG-*). Candidato a bloqueio. |
| `aviso` | o servidor não conseguiu provar a consistência: `SOMBRA-PLACAR-DIVERGENTE` ou `SOMBRA-SANCAO-SEM-MARCADOR`. |
| `info` | ressalvas do motor, itens [M]/NÃO CONFIRMADOS (RG-SAN-001/003/004/005), bloqueio já justificado por `[[OVR:<código>]]` do árbitro, ocorrência fora do que a sombra traduz (`SOMBRA-NAO-TRADUZIDA`) e `SOMBRA-ERRO-INTERNO`. Nunca viram bloqueio. |

Cada PUT com a sombra ligada escreve uma linha `console.info('[sumula-sombra] {...}')` com `partidaId`, total de avisos, erros, nº de sets divergentes e contagem por código. Sem nomes, camisas, textos nem ids de atletas.

### Limites conhecidos (não bloqueiam a medição, mas contam como ruído)

- Redesignação de líbero (`[[LIBRED]]`), protesto, discrepância de papeleta e capitão não são traduzidos; sanção sem `[[SAN]]` gera aviso.
- O sacador não é enviado ao motor (ele deriva o saque pelo rodízio); a camisa é resolvida pela presença da súmula e, depois, pelo cadastro.
- Súmulas iniciadas antes do `set_start` com formação (ou sem `[[ROT]]`) geram `SOMBRA-NAO-TRADUZIDA` e, em seguida, erros de "set não iniciado" nos lances: não são falha de regra.
- O motor recusa substituição excepcional enquanto houver substituição regular possível (RG-SUB-011); a tela pode estar aceitando por decisão do árbitro.

### Quando é seguro passar da sombra para o bloqueio

Critérios sugeridos (decisão do produto, não automática):
1. Pelo menos 2 semanas de partidas reais com a sombra ligada e uma amostra mínima combinada (por exemplo 300 PUTs, 20 partidas encerradas).
2. `SOMBRA-PLACAR-DIVERGENTE` em menos de 1% dos PUTs, e as divergências restantes explicadas (causa conhecida e corrigida), não ruído de tradução.
3. `erro` por código: os códigos que forem bloquear precisam ter taxa de falso positivo próxima de zero (cada `erro` revisado em amostra). Começar pelos mais objetivos (RG-SUB limite, RG-TMP-001, RG-SET); deixar sanção e itens [M] por último e nunca bloquear NÃO CONFIRMADO.
4. Zero `SOMBRA-ERRO-INTERNO` recorrente e `SOMBRA-NAO-TRADUZIDA` residual baixo, para o motor enxergar a partida inteira.
5. O bloqueio precisa manter a saída do árbitro (override `[[OVR]]`) e ser ligado por flag própria, por código e, de preferência, por campeonato, com rollback imediato.

Teste: `npm run test:sumula-servidor-sombra` (partida consistente, 7ª troca regular, sanção com e sem marcador, penalidade sem dupla contagem, ponto divergente, excepcional/override, flag desligada e erro interno).

Ordem de assinatura (RG-FEC-002) e capitão ausente (RG-FEC-003); perda de sets anteriores no RG-FOR-009; passar `agora` e `horarioPrevisto` da partida a partir da rota; ampliar o CHECK de `tipo` na tabela; praia (RG-PRA); PDF e súmula anexa; os itens [M] acima. (RG-FEC-002/003, RG-FOR-009 completo, RG-TMP-003/005/006 e RG-LIB-014 foram fechados na rodada 8, abaixo.)

## Rodada 8: o que sobrava do motor (branch `feat/r8-motor-restante`)

Estado: **implementado em código e testado; nada ligado a tela, rota nova de `src/app`, migration ou banco**. A rota de eventos continua atrás de `SUMULA_EVENTOS_ATIVO`. O tipo novo de evento (`PEDIDO_INDEVIDO`) vai na tabela como `TEMPO` com o tipo real em `payload._motor` (mesma pendência do CHECK de `tipo`, para `banco-de-dados`).

### O que mudou

- **Fechamento (RG-FEC-002/003)**: `assinaturas.ts`. `validarAssinaturasFechamento` confere a ordem apontador, capitães, árbitros (pela posição `ordem` informada), a presença de apontador, árbitro e um registro de capitão por equipe. Capitão ausente (`AUSENTE_SUBSTITUIDO`): assina o capitão em jogo (`jogadorId` conferido contra `capitaesEmJogo`) com observação do fato. Capitão que recusa (`RECUSA`): campo em branco com o motivo na observação, sem entrar na ordem. `validarFechamentoComAssinaturas` junta isso aos totais (RG-FEC-004). Também `validarAssinaturasDeAbertura` (RG-FEC-001) e `validarAlteracaoDeResultado` (RG-FEC-005: a equipe não altera depois de oficializada; o organizador corrige com motivo). A janela de 30 minutos por link (D6) é regra de produto e não está aqui.
- **Jogador não registrado de set anterior (RG-FOR-009 completo)**: `nao-registrado.ts` (`calcularPerdaPorNaoRegistrado`, pura) ligada à derivação. `DISCREPANCIA_PAPELETA` aceita `setEntrada` (set anterior ao corrente, só com causa `JOGADOR_NAO_REGISTRADO` e fase `DEPOIS_DO_INICIO`) e `momentoSeq` passa a ser o ponto, dentro desse set, em que ele entrou. Set de entrada: a faltosa perde os pontos desde o momento e, se tinha vencido o set, perde o set (o adversário recebe os pontos necessários). Sets posteriores à entrada: set vencido pela faltosa vira derrota com parcial 0 x alvo (0x25). No set corrente caem todos os pontos da faltosa e o adversário ganha ponto e saque (reversão que já existia). **Configurável [M]**: `ConfigPartida.naoRegistradoZeraSetsJaPerdidos` (se os sets que a faltosa já tinha perdido também têm os pontos zerados; padrão: mantêm o parcial real). O parcial exato do set de entrada vencido pela faltosa é interpretação e nenhum teste o fixa. Limitação: o `alvo` e o flag `decisivo` do set corrente continuam os calculados no início dele; se a perda de sets mudar o placar de sets, a observação `JOGADOR NÃO REGISTRADO ...` registra o antes e o depois.
- **Pedidos de interrupção (RG-TMP-003/005/006)**: `pedidos.ts` + evento `PEDIDO_INDEVIDO { equipe, tipo?, atrasaOJogo? }`. Na mesma interrupção cabem até 2 tempos e 1 pedido de substituição (a excepcional e a troca de líbero ficam fora); o 3º tempo ou o 2º pedido de substituição seguidos viram inconsistência `RG-TMP-003` (com contexto da relação nominal, quem acusa o 2º pedido de substituição continua sendo `RG-SUB-007`). O 1º pedido indevido da equipe na partida, sem atrasar o jogo, é só registrado (`REGISTRO_SEM_SANCAO`); os seguintes são `ATRASO`, e a derivação devolve a sanção sugerida (advertência na 1ª, penalidade nas seguintes) em `pedidosIndevidos`; **quem lança a `SANCAO` de atraso é o apontador** (o motor não grava sanção sozinho). A advertência de atraso por pedido indevido bloqueia novo pedido regular da equipe (`RG-TMP-006`) até o fim do próximo rally concluído (penalidade de conduta não encerra a interrupção). A rota devolve a consequência como aviso ao receber o evento.
- **Folha de controle de líbero (RG-LIB-014)**: `folha-libero.ts` (`montarFolhaControleLibero`). Por set e equipe: ordem, nº do líbero ("Líb."), nº do regular ("Troca", em branco entre dois líberos), posição em quadra, placar da hora com o da equipe que troca primeiro (`"9X6"`), redesignações com líbero antigo e novo. Quem é líbero vem de `liberosA/B` do `SET_INICIADO` e das redesignações; sem isso a linha sai com `liberoInferido`. Trocas desfeitas não entram. A assinatura do apontador assistente é do PDF.
- **Intervalo (RG-SET-005)**: `set-partida.ts` (`duracaoDoIntervalo`, `validarConfigIntervalo`, `conferirIntervalo`); `ConfigPartida.intervaloLongoEntre2e3Minutos` (3 a 10, a pedido do organizador). RG-SET-007 já estava coberto no fechamento.
- **Complementos com o ID no nome do teste**: RG-ELE-002 (`validarAlteracaoDeRelacao`, `validarEntradaEmQuadra`; se a escalação trava na assinatura continua decisão de produto, o parâmetro é `assinada`), RG-FOR-001 (`resolverSorteio`), RG-FOR-004 (`validarEntregaDaPapeleta`), RG-SAQ-003 (`avaliarExecucaoDoSaque`, 8 s), RG-POS-001/002/005 (`posicoes.ts`: medidas `x`/`y` informadas, equipe sacadora livre), RG-PTO-001/002 (`decidirFaltasDoRally`, motivo `FALTA_DUPLA` em `RALLY_REPETIDO`), RG-SAN-008, RG-WO-003 (`validarPresencaDaVencedoraNoWO`, `quadroResultadosWO`).

### Cobertura das regras do 03

`scripts/regras-volei-cobertura.test.ts` lê o `03` e falha listando todo ID indoor sem caso de teste com o ID no nome (aceita `RG-ROT-001/002` e `RG-PRO-001..003`). Resultado: **97 de 97 IDs exigidos cobertos**. Exceções documentadas no próprio teste e conferidas contra o `03` (uma exceção velha ou um [M] novo sem entrada na lista faz o teste falhar):

- **[M] (6)**: RG-SUB-002, RG-TMP-009, RG-SAN-010, RG-PRO-002, RG-PRO-004, RG-WO-001. Ficam configuráveis. Quatro têm teste só da parte verificada (RG-SUB-002, RG-SAN-010, RG-PRO-002, RG-WO-001); nenhum teste fixa o trecho [M] como oficial.
- **Praia (11)**: RG-PRA-001..011, fora do motor (que é só indoor).
- **Papel ou PDF (11)**: RG-ELE-003/006/007, RG-FOR-010/011, RG-PTO-003, RG-SUB-005/015, RG-TMP-004, RG-INT-006/007. Descrevem preenchimento em papel ou layout do PDF; precisam de teste do gerador de PDF/tela, não do motor. A lista só pode encolher.

### Tabela: regra -> arquivo -> teste (rodada 8)

| Regra | Arquivo (`src/lib/…`) | Teste (`scripts/…`) |
| --- | --- | --- |
| RG-FEC-001/002/003/005 | `regras-volei/assinaturas.ts`, `fechamento.ts` (`validarFechamentoComAssinaturas`) | `regras-volei-assinaturas.test.ts`, `regras-volei-complementos.test.ts` |
| RG-FOR-009 (set anterior) | `regras-volei/nao-registrado.ts`, `eventos.ts`, `sumula-eventos/esquema.ts` | `regras-volei-nao-registrado.test.ts` |
| RG-TMP-003/005/006 | `regras-volei/pedidos.ts`, `eventos.ts`, `sumula-eventos/{esquema,mapeamento,servico}.ts` | `regras-volei-pedidos.test.ts` |
| RG-LIB-014 | `regras-volei/folha-libero.ts` | `regras-volei-folha-libero.test.ts` |
| RG-SET-005 | `regras-volei/set-partida.ts`, `config.ts` | `regras-volei-intervalo.test.ts` |
| RG-ELE-002, RG-FOR-001/004, RG-SAQ-003, RG-POS-001/002/005, RG-PTO-001/002, RG-SAN-008, RG-WO-003 | `elenco.ts`, `set-partida.ts`, `papeleta.ts`, `rotacao.ts`, `posicoes.ts`, `eventos.ts`, `wo-interrupcao.ts` | `regras-volei-complementos.test.ts` |
| Cobertura dos IDs do 03 | (lê `docs/analise/03-regras-validaveis.md`) | `regras-volei-cobertura.test.ts` |

Agregador: `npm run test:regras-volei-r8` (testes novos mais a cobertura). Segue valendo `npm run test:regras-volei-r3`.

### Itens [M] / NÃO CONFIRMADOS depois da rodada 8

Os mesmos da rodada 3, mais o tratamento dos sets que a faltosa já tinha perdido no RG-FOR-009 (`naoRegistradoZeraSetsJaPerdidos`) e o parcial do set de entrada vencido por ela. Continuam configuráveis e sem teste que os fixe como oficiais.

### Fora da rodada 8

Passar `agora`/`horarioPrevisto` da rota; ampliar o CHECK de `tipo` na tabela; praia; PDF e súmula anexa (inclui a folha de controle de líbero impressa e as 11 regras de papel/PDF acima); lançar a `SANCAO` de atraso automaticamente a partir do `PEDIDO_INDEVIDO` (hoje é o apontador); decidir se a escalação trava na assinatura da relação (RG-ELE-002).
