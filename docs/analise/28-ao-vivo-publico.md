# 28 - Ao vivo público (placar sem PII), Rodada 11

Estado: **implementado como API, atrás da flag `AO_VIVO_ATIVO=1`** (desligada = 404). Não exige migration. Não há tela. A rota antiga `GET /api/partidas/[id]/ao-vivo` (com jogadores, fotos e presenças) **não foi alterada** e segue como estava; esta é a leitura mínima e pública, pensada para telão, widget e polling.

Código: `src/lib/ao-vivo/` (`montar.ts` puro, `servico.ts` leitura), `src/app/api/ao-vivo/[partidaId]/route.ts`. Teste: `npm run test:ao-vivo`.

## Contrato

`GET /api/ao-vivo/[partidaId]` (id numérico de `Partida`, 1 a 9 dígitos; qualquer outra coisa = 404). Sem login.

```json
{ "data": {
  "partida": { "id": 100, "equipeA": "Alfa", "equipeB": "Beta", "status": "EM_ANDAMENTO",
               "setsA": 1, "setsB": 0, "setAtual": 2, "pontosA": 10, "pontosB": 12, "sacador": "B" },
  "sets": [ { "numero": 1, "a": 25, "b": 20 }, { "numero": 2, "a": 10, "b": 12 } ],
  "atualizadoEm": "2026-10-17T12:00:00.000Z"
} }
```

- `sacador` é `"A"`, `"B"` ou `null` (null quando o set acabou, a partida terminou ou a fonte são os sets).
- `setAtual` é `null` com a partida agendada ou encerrada; nesse caso `pontosA/B` são 0.
- Equipe ainda a definir (vaga) aparece como `"A definir"`.

## Fonte do placar

1. **Log do motor** (`SumulaEvento`), quando `SUMULA_EVENTOS_ATIVO=1` e há eventos: `derivarPlacar` com as regras efetivas da partida. Dá sacador e set atual em tempo real.
2. **Sem log** (flag desligada, tabela ausente, vazio ou falha de leitura): `SetPartida` + `Partida.setsPorA/B`. O set atual é o último com placar gravado enquanto a partida não terminou; o sacador não é conhecido. As ocorrências (`OcorrenciaPartida`) não entram: não carregam placar.

## Privacidade

A resposta tem apenas nome das duas equipes, status, placares, sets e quem saca. **Não** traz jogadores, números de camisa, formação, árbitros, fotos, documentos, telefones nem token da súmula. O teste varre a resposta atrás desses termos.

Visibilidade: usa `campeonatoPublicadoDaLiga` (`visibilidade-competicao.ts`): simulação, rascunho e competição **privada** respondem o mesmo `404 Partida não encontrada.` de uma partida inexistente (sem diferença de corpo). Se a leitura da liga falhar, também 404 (falha fechada).

## Operação

- Limite por IP: 120 requisições por minuto, no store persistente (tabela `"RateLimit"`, compartilhado entre instâncias) com fallback em memória quando a tabela ou o Supabase estiverem indisponíveis (R13). Se o próprio limitador falhar, a leitura pública segue (falha-aberto). Excesso = 429 com `Retry-After`.
- `Cache-Control: public, max-age=0, s-maxage=2` só nas respostas 200; 404, 429 e 500 vão com `no-store`.
- Erros de leitura = 500 genérico, sem detalhe interno.

## Pendências

- Tela pública que consuma esta rota; a rota antiga continua em uso pela tela atual.
- Sem a tabela `"RateLimit"` o limite volta a ser por instância (memória).
- Considerar `ETag` se o polling ficar pesado.
