# 26 - Scout (base), Rodada 10

Estado: **base (R10) e lançamento manual (R11) implementados, atrás de flag `SCOUT_ATIVO=1`**. Não há exportação `.dvw`. O lançamento manual depende da tabela `"ScoutAcao"` (migration 0040, a cargo do agente `banco-de-dados`); sem ela as rotas de ações respondem 503 e o resumo segue só com o derivado do log.

## R11: lançamento manual de ações

Código: `src/lib/scout/acoes.ts`, `src/app/api/scout/[token]/acoes/route.ts` (GET, POST) e `acoes/[id]/route.ts` (DELETE). Teste: `npm run test:scout-acoes`.

| Rota | Acesso | Resposta |
| --- | --- | --- |
| `POST /api/scout/[token]/acoes` | escrita da súmula (`requireArbitroPartidaAccess`: apontador, árbitro escalado, organizador dono; campeonato finalizado = 409) | 201 `{ data: { acao } }`; repetição do mesmo `clientEventId` = 200 com a mesma ação |
| `GET /api/scout/[token]/acoes?set=` | leitura da súmula | 200 `{ data: [acao] }` (sem anuladas, ordem de lançamento); `set` fora de 1-5 = 400 |
| `DELETE /api/scout/[token]/acoes/[id]` | escrita da súmula | 200 `{ data: { acao } }` com `anuladoEm`; anular de novo = 200 (idempotente); id inexistente ou de outra partida = 404 |

Corpo do POST: `clientEventId` (obrigatório, até 100, `[A-Za-z0-9_.:-]`), `setNumero` (1-5), `equipeId`, `jogadorId?`, `fundamento`, `resultado`, `zonaOrigem?`, `zonaDestino?` (1-9), `rotacao?` (1-6), `placarA?`, `placarB?` (placar do set antes da ação). Validado por zod e por `validarAcao`. Erros: 400 dados inválidos; 422 equipe fora da partida ou jogador que não pertence à equipe; 503 `Recurso ainda não habilitado neste ambiente.` (tabela ausente); flag desligada = 404.

Idempotência por `(partidaId, clientEventId)`; reenviar uma ação já anulada devolve a mesma ação anulada (200), não a recria. Placar ausente vira 0 na agregação/exportação (campo é "placar antes").

### Exportação e resumo com ações manuais

`GET /resumo` e `GET /exportar` incluem as ações não anuladas (`agregarAcoes`). Tabela ausente = lista vazia (não derruba o resumo). **Versões novas:** JSON `scout-json-2`, CSV `scout-csv-2`. Mudanças em relação à versão 1: CSV ganha as colunas `acao_id` e `criado_em` (no fim; linhas `ACAO` as preenchem), JSON `acoes[]` ganha `criadoEm`, e as lacunas "sem lançamento manual" e "zonas dependem de scout manual" saem quando há ações (entra a lacuna de cobertura parcial).

Código: `src/lib/scout/` (modelo, derivação, estatísticas, exportação, leitura do servidor), `src/app/api/scout/[token]/{resumo,exportar}/route.ts`. Testes: `npm run test:scout` (`scripts/scout.test.ts`, `scripts/scout-rota.test.ts`).

## Rotas

Ambas exigem `SCOUT_ATIVO=1` (desligada = 404 `Recurso não encontrado.`) e o mesmo acesso da leitura da súmula (`requireSumulaTokenAccess` + `requireSumulaLeitura`): token opaco da súmula, sessão de acesso do jogo, organizador dono da liga ou árbitro escalado.

| Rota | Resposta |
| --- | --- |
| `GET /api/scout/[token]/resumo` | `{ data: ResumoScout }` |
| `GET /api/scout/[token]/exportar?formato=csv\|json` | arquivo (padrão `csv`); formato inválido = 400 |

Lê o log pela camada existente (`carregarLinhas` + `linhasParaLog` de `sumula-eventos`). Sem `SUMULA_EVENTOS_ATIVO=1` ou com a tabela `SumulaEvento` ausente (migration pendente), responde **503** `Eventos da súmula ainda não habilitados neste ambiente.`. Falha de leitura = 500. Nenhuma escrita, nenhuma migration, nenhum SQL novo.

## Derivado do log (sem scout manual)

A derivação roda sobre `derivarPlacar` (log efetivo: DESFAZ aplicado, pontos cancelados por falta de rotação excluídos) e refaz o rodízio por replay do jornal do set.

- Por ponto: set, equipe, origem (RALLY, PENALIDADE, FALTA_POSICAO, FALTA_ROTACAO, PAPELETA), tipo (`PONTO_NO_SAQUE`, `SIDE_OUT`, `ADMINISTRATIVO`), placar antes, sacador (equipe e jogador, pela posição I), rotação 1 a 6 de cada equipe, tamanho da série.
- Saques e pontos por sacador, saques perdidos, maior série por turno de saque.
- Aproveitamento por rotação, separado em saque e recepção (side-out).
- Séries de pontos (todas e a maior por equipe).
- Pontos por set, por origem, e cancelados.
- Tempos e substituições (regulares, excepcionais, líbero, redesignação) com o placar na hora; contadores por set.
- Duração do set e minutos de interrupção.

Convenções: rotação 1 = formação inicial do set; cresce 1 a cada side-out da equipe. Só ponto de RALLY conta como saque; ponto administrativo (penalidade, falta de posição/rotação, papeleta) entra no placar e nas séries, mas não nas estatísticas de saque e rotação.

## Não derivável (exigiria scout manual, fase posterior)

O log guarda **quem ganhou o rally**, não o que aconteceu nele. Portanto:

- **Ace e erro de saque não saem do log.** Ponto de quem saca pode ser ace, bloqueio, ataque ou erro do adversário; ponto de quem recebe pode ser erro de saque ou rally perdido. A "eficiência de saque" derivada é `pontos no saque / saques` (aproveitamento), não `(aces - erros) / saques`.
- Ataque, bloqueio, defesa, levantamento, contra-ataque, qualidade de recepção, zona de origem/destino (1 a 9) e posição do jogador no lance.
- Horário real do lance: `criadoEm` é a hora de gravação do evento; a duração é aproximada.

## Modelo e estatísticas (prontos para o scout manual)

`AcaoScout`: set, placar antes, equipe, `jogadorId` (nunca nome), fundamento (SAQUE, RECEPCAO, LEVANTAMENTO, ATAQUE, BLOQUEIO, DEFESA, CONTRA_ATAQUE), resultado (PONTO, ERRO, CONTINUA, NEUTRO), rotação 1-6, posição 1-6, zonas 1-9, origem MANUAL/DERIVADA. `validarAcao` confere os domínios.

Agregação por jogador, equipe e set (`agregarAcoes`). **Convenções propostas, a validar com o produto:**

- Eficiência de ataque = (pontos - erros) / tentativas, somando ATAQUE e CONTRA_ATAQUE.
- Recepção positiva = (PONTO + CONTINUA) / recepções. PONTO = perfeita, CONTINUA = permitiu o ataque, NEUTRO = regular/ruim, ERRO = ace adversário.
- Eficiência de saque = (aces - erros) / saques, ace = SAQUE+PONTO, erro = SAQUE+ERRO.
- Bloqueios = BLOQUEIO+PONTO.
- Razão sem denominador = `null`, nunca 0.

## Exportação

**JSON** (`scout-json-2`): objeto com `versaoEsquema` como primeira chave, `partidaId`, `geradoEm`, `derivado`, `acoes`, `estatisticas`, `lacunas`. Campo novo compatível mantém a versão; remoção ou mudança de significado exige nova versão. Cabeçalhos `Content-Disposition: attachment` e `X-Scout-Esquema`.

**CSV** (`scout-csv-2`): UTF-8 **com BOM**, separador `;` (Excel/LibreOffice pt-BR abrem direto), fim de linha CRLF, uma tabela só. Colunas fixas, nesta ordem: `versao_esquema, partida_id, tipo_registro, set, seq, equipe, jogador, fundamento, resultado, rotacao, rotacao_adversaria, posicao, zona_origem, zona_destino, placar_a_antes, placar_b_antes, origem, tipo_ponto, sacador_equipe, sacador_jogador, sequencia_atual, sai, entra, detalhe`. `versao_esquema` vai em toda linha. `tipo_registro`: `PONTO`, `TEMPO`, `SUBSTITUICAO`, `ACAO`. Texto iniciado por `= + - @` recebe apóstrofo (injeção de fórmula). Só ids, sem nomes (LGPD, há menores).

## Lacunas e pendências

- Tela do scout manual não existe (só API). Migration 0040 pendente do agente `banco-de-dados`.
- Convenções de recepção positiva e de zonas 1-9 não confirmadas.
- Resumo ainda não passa pelo contexto de elenco para validar jogadores (usa só o log).
- Eventos de sets anulados são ignorados no scout.
- Sem teste contra banco real: a leitura foi testada com cliente falso.

## O que falta confirmar para um `.dvw` (DataVolley)

Nada foi inventado. A decisão de produto é que o layout **não está confirmado em fonte**. Antes de implementar é preciso, de fonte oficial ou arquivos reais de exemplo:

1. Especificação das seções do arquivo (cabeçalho, equipes, jogadores, sets, `[3SCOUT]` etc.) e a codificação de caracteres.
2. Código de cada fundamento, tipo de ataque, qualidade (avaliação) e combinação de ataque, e como mapeiam para o nosso `resultado`.
3. Numeração de zonas e posições (origem/destino) e orientação da quadra.
4. Identificação de jogador (número de camisa) e de equipe exigida pelo formato.
5. Se o leitor alvo aceita arquivo só com pontos (sem ações), ou exige scout completo.
6. Licença/termos de uso do formato.

Sem scout manual um `.dvw` útil não pode ser gerado: o log não traz as ações.
