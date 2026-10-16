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

## Fora desta rodada (próxima)

- Aplicar a migration (pede `banco-de-dados` e aprovação), ampliar o CHECK de `tipo`, `recalcular_placar_partida` e materialização em `SetPartida`/`Partida`.
- Tela/cliente falando com a rota; migração das súmulas em andamento (SNAPSHOT) e decisão de quando a rota nova substitui o PUT atual.
- Motor ainda pendente: formação recalculada por replay após falta de rotação (hoje só `formacaoCorrigida`); substituições em lote por pedido (`trocas[]`, contando uma por jogador); primeira troca de líbero com papeleta conferida; tolerância de WO (RG-WO-002) exige o horário, que não está no evento; RG-LIB-004 só é conferido quando o evento traz o sacador ou o líbero está na posição I.
- Itens [M] seguem configuráveis e sem teste que os fixe como oficiais: WO em melhor de 3, WO duplo, sanções mistas, saque em 0x0 após penalidade entre sets, placar exato do CJ-03.
- Praia (RG-PRA), assinatura e fechamento (RG-FEC), protestos (RG-PRO), PDF e súmula anexa.
