# 27 - Desafio de vídeo, Rodada 11

Estado: **implementado como API, atrás da flag `DESAFIO_ATIVO=1`** (desligada = 404; no app de banco, desligada mantém o 501 anterior). Depende da tabela `"DesafioVideo"` (migration 0041, a cargo do agente `banco-de-dados`); sem ela responde **503** `Recurso ainda não habilitado neste ambiente.`. Não há tela.

Código: `src/lib/desafio/` (regras puras em `modelo.ts`, casos de uso em `servico.ts`), `src/app/api/sumula/[token]/desafios/**`, integração em `src/lib/banco/servico.ts`. Teste: `npm run test:desafio`.

## Rotas da súmula

| Rota | Acesso | Resposta |
| --- | --- | --- |
| `POST /api/sumula/[token]/desafios` `{ setNumero, equipeId, motivo?, linkVideo? }` | escrita da súmula (apontador, árbitro escalado, organizador dono) | 201 `{ data: { desafio } }` estado `SOLICITADO` |
| `GET /api/sumula/[token]/desafios` | leitura da súmula | 200 `{ data: [desafio] }` |
| `POST /api/sumula/[token]/desafios/[id]/decidir` `{ decisao: 'MANTIDA' \| 'REVERTIDA' \| 'CANCELADO' }` | escrita da súmula | 200 `{ data: { desafio } }` |

Erros: 400 dados inválidos (inclui `linkVideo`); 422 equipe fora da partida ou limite excedido (`codigo: LIMITE_EXCEDIDO`); 409 campeonato finalizado, partida encerrada (criar) ou decisão contrária a uma já tomada (`codigo: DESAFIO_JA_DECIDIDO`); 404 desafio inexistente ou de outra partida.

Decidir é idempotente: repetir a mesma decisão devolve 200; decisão diferente de uma já tomada devolve 409. Desafio decidido nunca volta a aberto. A decisão é condicional (`estado in (SOLICITADO, EM_ANALISE)`), então duas decisões simultâneas não se sobrepõem.

## Campos

`desafio`: `id, setNumero, equipeId, estado (SOLICITADO|EM_ANALISE|MANTIDA|REVERTIDA|CANCELADO), motivo, linkVideo, pedidoBancoId, solicitadoEm, decididoEm`. `decididoPor` fica só no banco (auditoria).

`linkVideo`: opcional; só `http(s)`, sem usuário/senha na URL, sem espaços, até 500 caracteres. `motivo`: até 300.

## Limite por equipe por set ([M], NÃO CONFIRMADO)

- O limite é **configurável**: `DESAFIO_LIMITE_POR_SET` (inteiro de 1 a 10). Sem a variável vale o padrão **2**, uma suposição de produto, não regra oficial.
- Convenção de contagem (também não confirmada): contam `SOLICITADO`, `EM_ANALISE` e `MANTIDA`. `REVERTIDA` (a equipe tinha razão) devolve o desafio e não conta; `CANCELADO` não conta.
- Corrida: depois de gravar, o servidor recontagem; se estourou, cancela o próprio registro e responde 422. Em disputa simultânea as duas requisições podem ser recusadas; o cliente tenta de novo.
- A regra oficial (FIVB/CBV e regulamento de cada competição) precisa ser confirmada antes de tratar isto como regra de negócio fechada.

## App de banco

`POST /api/banco/[token]/pedidos` com `{ tipo: 'DESAFIO', motivo?, linkVideo? }` deixa de responder 501 (com a flag ligada) e cria um `PedidoBanco` `PENDENTE` com `payload { setNumero, motivo?, linkVideo? }`. Recusas: 422 `LIMITE_EXCEDIDO`, 409 `DESAFIO_PENDENTE` (um pedido de desafio pendente por equipe por set), 400 link inválido, 409 partida encerrada.

Quando o apontador aceita (`POST /api/sumula/[token]/pedidos-banco/[id]/decidir` `{ decisao: 'ACEITO' }`) o servidor cria o `DesafioVideo` `EM_ANALISE` com `pedidoBancoId`, e a resposta traz `{ pedido, desafio }`. Repetir o aceite devolve o mesmo desafio (idempotente por `pedidoBancoId`). Se o limite estourou entre o pedido e a decisão, ou a tabela sumiu, o aceite é recusado (422/503) e o pedido continua `PENDENTE`. `RECUSADO` não cria desafio. O limite de TEMPO/SUBSTITUICAO do aceite não se aplica ao DESAFIO.

## Pendências

- Migration 0041 e tela do desafio.
- O desafio ainda não gera evento `DESAFIO` no log do motor (o tipo existe no log, mas esta rota só registra o pedido e a decisão).
- Regra oficial de limite e de devolução em caso de reversão.
