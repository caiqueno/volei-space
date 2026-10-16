# 07 - Arquitetura do backend: motor de regras e log de eventos

Agente: backend. Escopo desta rodada: **módulo puro + testes**. O motor ainda NÃO está ligado à tela (`lancar/page.tsx`) nem às rotas (`src/app/api`). Nada aqui está em produção.

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

## Fora desta rodada (próxima)

- Ligar o motor às rotas da súmula e à tela; trocar o delete+insert não atômico por RPC (pede `banco-de-dados`: tabela de eventos com `UNIQUE (partida_id, seq)` e `UNIQUE (partida_id, client_event_id)`).
- Concorrência entre dois apontadores (J03): versão otimista por `seq` (o cliente envia `seqEsperado`; o servidor responde 409).
- Derivar `EstadoEquipe` completo do log (hoje `derivarPlacar` deriva placar, formação, saque e contadores; validar substituição/líbero usa o estado entregue pelo chamador).
- Praia (RG-PRA), assinatura e fechamento (RG-FEC), protestos (RG-PRO), PDF e súmula anexa.
- Permissões: toda escrita futura usa `exigirOrganizador*` / token de súmula; o motor não faz autorização.
