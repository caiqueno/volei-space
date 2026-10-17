# 26 - Scout (base), Rodada 10

Estado: **implementado como base, atrás de flag, só leitura**. Não há lançamento manual de scout, não há tabela de ações e não há exportação `.dvw`.

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

`AcaoScout`: set, placar antes, equipe, `jogadorId` (nunca nome), fundamento (SAQUE, RECEPCAO, LEVANTAMENTO, ATAQUE, BLOQUEIO, DEFESA, CONTRA_ATAQUE), resultado (PONTO, ERRO, CONTINUA, NEUTRO), rotação 1-6, posição 1-6, zonas 1-9, origem MANUAL/DERIVADA. `validarAcao` confere os domínios. Hoje a lista de ações é sempre vazia.

Agregação por jogador, equipe e set (`agregarAcoes`). **Convenções propostas, a validar com o produto:**

- Eficiência de ataque = (pontos - erros) / tentativas, somando ATAQUE e CONTRA_ATAQUE.
- Recepção positiva = (PONTO + CONTINUA) / recepções. PONTO = perfeita, CONTINUA = permitiu o ataque, NEUTRO = regular/ruim, ERRO = ace adversário.
- Eficiência de saque = (aces - erros) / saques, ace = SAQUE+PONTO, erro = SAQUE+ERRO.
- Bloqueios = BLOQUEIO+PONTO.
- Razão sem denominador = `null`, nunca 0.

## Exportação

**JSON** (`scout-json-1`): objeto com `versaoEsquema` como primeira chave, `partidaId`, `geradoEm`, `derivado`, `acoes`, `estatisticas`, `lacunas`. Campo novo compatível mantém a versão; remoção ou mudança de significado exige nova versão. Cabeçalhos `Content-Disposition: attachment` e `X-Scout-Esquema`.

**CSV** (`scout-csv-1`): UTF-8 **com BOM**, separador `;` (Excel/LibreOffice pt-BR abrem direto), fim de linha CRLF, uma tabela só. Colunas fixas, nesta ordem: `versao_esquema, partida_id, tipo_registro, set, seq, equipe, jogador, fundamento, resultado, rotacao, rotacao_adversaria, posicao, zona_origem, zona_destino, placar_a_antes, placar_b_antes, origem, tipo_ponto, sacador_equipe, sacador_jogador, sequencia_atual, sai, entra, detalhe`. `versao_esquema` vai em toda linha. `tipo_registro`: `PONTO`, `TEMPO`, `SUBSTITUICAO`, `ACAO`. Texto iniciado por `= + - @` recebe apóstrofo (injeção de fórmula). Só ids, sem nomes (LGPD, há menores).

## Lacunas e pendências

- Sem persistência nem lançamento de ações (tabela, rota POST, tela do scout): depende de decisão de produto e do agente `banco-de-dados`.
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
