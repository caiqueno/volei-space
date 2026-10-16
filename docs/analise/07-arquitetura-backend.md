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
