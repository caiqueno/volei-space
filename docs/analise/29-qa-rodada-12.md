# QA da rodada 12: contratos cliente↔servidor, migrations 0033–0041 e flags

Escopo: módulos das rodadas 9 a 11, leitura dos dois lados de cada par. Sem banco real, sem navegador. Nenhum código-fonte foi editado. Relatórios de segurança e de regras desta rodada ficam fora deste foco.

## 1. Execução

| Verificação | Resultado |
|---|---|
| `npx tsc --noEmit` | passou (exit 0) |
| `npm run build` | passou (exit 0, 83 páginas) |
| 31 arquivos de teste (banco-validacao, banco-rotas, banco-ui, sumula-banco-ui, sumula-impressa, sumula-impressa-motor, meu-time-fase2-csv/rotas/ui, scout, scout-rota, scout-acoes, scout-ui, desafio, desafio-ui, ao-vivo, ao-vivo-ui, ao-vivo-conexao, sumula-offline-fila/politica, sumula-eventos/rota, migracoes-pendentes, lgpd-menores, meu-time-rotas/convite, sumula-link-imprimir, cache-publico-rotas, autorizacao-rotas, anon-client-guard, projecoes-publicas) | todos com exit 0 |

Os testes passam, mas nenhum cobre os achados B1, B2 e I1 a I6 abaixo: eles testam cada lado isolado, não o contrato entre os dois.

## 2. Achados

### BLOQUEANTE

**B1. Scout: resumo e exportação ignoram as ações manuais.**
`src/app/api/scout/[token]/resumo/route.ts` e `.../exportar/route.ts` chamam `carregarAcoesScout` e conferem `manuais.ok`, mas não passam `acoes: manuais.acoes` a `lerResumoScout`. Resultado: ataque, bloqueio, defesa e zonas lançados na tela nunca aparecem no resumo da tela, no JSON `scout-json-2` nem no CSV `scout-csv-2`. `scripts/scout-rota.test.ts` não menciona `acoes`.
Correção: incluir `acoes: manuais.acoes` na entrada de `lerResumoScout` nas duas rotas e acrescentar teste de rota com uma ação manual.

### IMPORTANTE

**I1. Banco, desafio: set errado durante o set em jogo.**
`src/lib/banco/dados.ts` `setAtual()` = último set com linha em `SetPartida` + 1. O PUT de andamento da súmula (`lancar/page.tsx` ~linha 1710, `buildSumulaPayload(false)`) grava também o set corrente, mesmo 0x0. Depois do primeiro snapshot ao vivo, pedidos de tempo, substituição e desafio do banco são gravados com `payload.setNumero` = set seguinte. Efeitos: o limite por set é contado no set errado; `titulares` da substituição vêm da papeleta do set seguinte; `PainelDesafios` (set = `currentSet`) não soma os desafios que o banco criou, então apontador e banco gastam cotas separadas.
Correção: definir o set em disputa pelo maior `SetPartida` ainda não encerrado (ou pelo `Partida` / log do motor) e usar o mesmo critério em `criarPedido`, `criarPedidoDesafio` e `visaoDoBanco`. Papeleta continua usando "próximo set sem linha".

**I2. Banco: limite por IP conta em dobro.**
`src/lib/banco/acesso.ts` `resolverAcessoBanco` chama `limitado(req, null)` e depois `limitado(req, hash)`, e a segunda também consome `banco:ip`. Cada requisição gasta 2 do limite de 120/min, ou seja 60 reais por IP. Com polling de 3 s (20/min por aparelho), 4 aparelhos atrás do mesmo Wi-Fi de ginásio já recebem 429; o apontador (`resolverApontador`) divide a mesma cota. No cliente, 429 vira tela "Algo deu errado".
Correção: consumir o IP uma só vez; subir o limite do IP (ou chavear por IP+token); tratar 429 no cliente como "aguardando" com recuo, sem trocar de tela.

**I3. Scout depende de flag não documentada.**
`/api/scout/[token]/resumo` responde 503 sem `SUMULA_EVENTOS_ATIVO=1` (`src/lib/scout/servidor.ts`). `ScoutApp` consulta o resumo primeiro; 503 vira `nao-habilitado` e, sem dados anteriores, a tela nunca carrega, embora `/acoes` funcione sem essa flag.
Correção: ou tornar o resumo tolerante (devolver só estatísticas manuais sem o log), ou exigir e documentar `SUMULA_EVENTOS_ATIVO` ao lado de `SCOUT_ATIVO`; no cliente, não bloquear o lançamento quando só o resumo falha.

**I4. Scout: fila descarta ação em 401/403/404.**
`src/lib/scout-ui/fila.ts` `destinoDaResposta` devolve `descartar` para qualquer 4xx fora de 408/409/425/429. Sessão ou link do apontador expirado no meio do jogo apaga as ações da fila com a frase "foi recusada pelo servidor". Além disso, o ramo `if (r.status === 404 || r.status === 503)` em `ScoutApp.tsx` ~linha 129 nunca roda para 404.
Correção: 401, 403 e 404 devem manter a fila e mostrar tela de acesso; só 400 e 422 descartam.

**I5. Importação CSV: modelo baixado não bate com o servidor e avisos somem.**
(a) `src/lib/meu-time-fase2-ui/csv.ts` `MODELO_CSV` usa posição "Ponteira" e "Líbero"; `src/lib/meu-time-fase2/csv.ts` aceita só `LV, PT, OP, CT, LB`. As duas linhas do modelo saem como AVISO e a posição é descartada. (b) O servidor manda `avisos` separado de `erros`; `cliente.ts` e `Importar.tsx` ignoram `avisos`. Linhas "Com aviso" aparecem sem motivo, inclusive as que "serão ignoradas" por repetição ou por já existirem no time. (c) `TEXTOS_ERRO` do cliente usa códigos que o servidor nunca envia (só frases).
Correção: modelo com códigos; ler e exibir `avisos`; marcar visualmente linhas que serão ignoradas.

**I6. Apontador: 404 e 503 tratados como "desligado".**
`src/lib/sumula-banco-ui/index.ts` `lerEnvelope` e `src/lib/desafio-ui/index.ts` `lerRespostaDesafio` mapeiam 404 e 503 para `desligado`. Em `PedidosBanco`, `PapeletasDoSet` e `PainelDesafios` isso para o polling para sempre na aba. 404 "Pedido não encontrado", 404 "Partida não encontrada" e 503 `DESAFIO_INDISPONIVEL` (tabela ausente) viram "O banco não está habilitado", e no aceite de desafio a mensagem "O pedido foi registrado na súmula" é falsa (nada foi registrado). O 422 `LIMITE_EXCEDIDO` do aceite de pedido vem depois de a tela já ter lançado tempo/troca na súmula e o pedido continua PENDENTE (documentado como aberto na R9).
Correção: só tratar como desligado o 404 sem `codigo`; usar `codigo` do corpo; para TEMPO/SUBSTITUICAO, pedir a decisão ao servidor antes de registrar na súmula.

### MENOR

- **M1. Flags desligadas com requisição.** `src/app/banco/[token]/page.tsx` e `BancoApp.tsx` não leem `NEXT_PUBLIC_BANCO_APP_ATIVO`: com flag desligada a tela faz um GET que dá 404. `ConviteAtleta.tsx` chama `useCarregar` antes de testar `faseDoisAtiva()` (um GET por abertura). `src/app/sumula/[token]/imprimir/page.tsx` ~linha 43 sempre chama `/eventos` (um 404 inofensivo). Contraria "tela sem requisição". Correção: checar a flag antes de buscar.
- **M2. Banco: estados de partida.** `src/lib/banco-ui/botoes.ts` `partidaEncerrada` não inclui `WO` (o servidor inclui): botões ficam ativos e o servidor responde 409. Para link inválido o servidor devolve 404 e a tela mostra "indisponível"; a tela `token-invalido` (400/401/403) nunca é usada.
- **M3. Banco: capitão.** Servidor exige capitão entre os 6 titulares (`papeleta-validacao.ts`, RG-ELE-005); `validarFormacaoLocal` só confere elenco e não-líbero. O botão "Enviar" fica ativo e a recusa vem do servidor. O servidor também recusa a papeleta inteira se houver camisa repetida no elenco (RG-ELE-004), sem pré-checagem local.
- **M4. ids uuid.** `idDeRecurso` (banco) e `idDeDesafio` aceitam qualquer `[A-Za-z0-9_-]{1,64}`, mas `PedidoBanco.id` e `DesafioVideo.id` são `uuid`. Um id malformado vira erro 22P02 do Postgres e resposta 500 em vez de 404. Correção: validar formato uuid.
- **M5. Importação.** Cliente aceita arquivo até 512 KB e qualquer número de linhas; servidor aceita 100 000 caracteres e 60 linhas.
- **M6. Offline-first.** `/eventos` com 404 por motivo diferente da flag (partida ou árbitro não encontrado) cai em `modoLocal` e não bloqueia o fechamento. Aceitável, mas não distingue as causas.
- **M7. Fase 2.** O sino (`NavMeuTime`) busca notificações ao montar mesmo sem sessão (aparece só erro dentro do painel). `ConviteAtleta.contatoCifrado` guarda contato sem uso previsto (minimização LGPD). `0038_clube_equipe` não tem uso: não aplicar.
- **M8. Ao vivo.** Sem log, `payloadDosSets` mostra o último set como "atual" até existir o seguinte. Rate limit em memória por instância (já listado como aberto).
- **M9. Papeletas aceitas somem do painel.** `papeletasEnviadas` filtra só `ENVIADA`; depois do aceite o painel `PapeletasDoSet` desaparece no próximo polling, perdendo o "Papeleta aceita".

## 3. Pares conferidos sem divergência

| Par | Conferido |
|---|---|
| Banco GET `/api/banco/[token]` | `{data:{partida,equipe,elenco,papeletas,pedidos,limites}}` bate com `VisaoBanco`; `placar` lido por `formatarPlacar` (`setsA/setsB`) |
| Papeleta PUT/POST enviar | corpo `{formacao[{posicao,jogadorId}],liberoId?,capitaoId?}` bate com `papeletaSchema`; códigos 409 `SET_INICIADO`/`PAPELETA_TRAVADA`, 422 `PAPELETA_INVALIDA` com `violacoes[{codigo,mensagem}]` lidos por `extrairViolacoes` |
| Pedidos banco/apontador | `pendentesDaPartida` devolve `{id,tipo,estado,payload,criadoEm,equipeId,equipeNome}`, como `PedidoBanco` do apontador; `decisao` ACEITO/RECUSADO bate |
| Link do banco | `{url,expiraEm}`, 201 |
| Desafio | corpo `{setNumero,equipeId,motivo?,linkVideo?}` e decisão MANTIDA/REVERTIDA/CANCELADO batem; estados do CHECK = estados do código |
| Convites | `{url,expiraEm}`; lista com `estado` em maiúsculas normalizado; público `{estado,equipe{nome,naipe}}`; aceite `{nome,dataNascimento,camisa,posicao}` com `POSICOES` iguais |
| Clube, notificações | `CLUBE_NAO_ENCONTRADO` (404) tratado; `criadaEm`/`lida` lidos como `criadoEm`/`lidaEm` |
| Scout ações | POST/GET/DELETE, `clientEventId`, `{data:{acao}}`, `{data:[...]}` batem; `ScoutAcao.id` bigint lido como número |
| Ao vivo | `{data:{partida,sets[{numero,a,b}],atualizadoEm}}` bate com `normalizarPlacar`; sem PII |
| Offline | corpo `{seqEsperado,eventos[]}`; 200 `{aceitos,rejeitados,estado}`; 409 em `details` (porque `error()` põe o extra em `details`) lido em `corpo.details` |
| Súmula impressa | lê `json.data.eventos` de `/eventos` (bate) |

## 4. Migrations 0033–0041 contra o código

| Migration | Resultado |
|---|---|
| 0033 BancoAcesso | colunas `partidaId, equipeId, tokenHash, criadoPor, expiraEm, revogadoEm` iguais ao código; `id` uuid (cliente trata como string); ids de Partida e Equipe `integer` |
| 0034 Papeleta | colunas, estados e checks (`enviadaEm`, `conteudoHash`, `aceitaPor`) atendidos pelo código; trigger permite ENVIADA→ACEITA |
| 0035 PedidoBanco | `decididoEm` obrigatório fora de PENDENTE: o código sempre preenche (incluindo CANCELADO e reversão do desafio para PENDENTE com `decididoEm: null`) |
| 0036 ConviteAtleta | `contatoCifrado bytea`: `cifrarContato` devolve literal `\x...` (correto); `atletaId`, `timeId` uuid |
| 0037 ImportacaoAtletas | `linhas`, `resumo`, `resultado`, `confirmadoEm` iguais; prévia guarda nome e nascimento até confirmar |
| 0038 ClubeEquipe | sem uso no código |
| 0039 Notificacao | colunas iguais; `usuarioId` text |
| 0040 ScoutAcao | colunas e CHECKs iguais ao esquema zod; `jogadorId` integer |
| 0041 DesafioVideo | depende da 0035 (FK); `motivo`/`linkVideo` até 500, código limita a 200 e 500 |

Ordem obrigatória: 0035 antes da 0041. Todas só aceitam `service_role`; o código usa `supabaseAdmin`.

## 5. Flags

| Flag | Liga | Desligada |
|---|---|---|
| `MEU_TIME_ATIVO` | Meu Time (API e telas) | 404 |
| `MEU_TIME_FASE2_ATIVO` (+ `MEU_TIME_ATIVO`) | convites, importação, clube, notificações, `/api/convite-atleta` | 404 |
| `NEXT_PUBLIC_MEU_TIME_FASE2_ATIVO` | nav, sino e telas da fase 2 | nav some; ver M1 para o convite |
| `BANCO_APP_ATIVO` | `/api/banco/**`, `/api/sumula/[token]/pedidos-banco`, `papeleta` | 404 |
| `NEXT_PUBLIC_BANCO_APP_ATIVO` | painéis do apontador | sem render; a página `/banco/[token]` ignora (M1) |
| `SUMULA_EVENTOS_ATIVO` | `/eventos`; também exigida pelo resumo do scout (I3) e pelo log do ao vivo | 404 / 503 |
| `NEXT_PUBLIC_SUMULA_EVENTOS_ATIVO` | fila offline na tela | comportamento antigo |
| `SCOUT_ATIVO` | `/api/scout/**` | 404 |
| `NEXT_PUBLIC_SCOUT_ATIVO` | tela `/scout/[token]` | "desligado", sem requisição |
| `DESAFIO_ATIVO` | `/api/sumula/[token]/desafios`, pedido DESAFIO do banco (desligado: 501) | 404 |
| `NEXT_PUBLIC_DESAFIO_ATIVO` | `PainelDesafios`, botão do banco | sem render |
| `AO_VIVO_ATIVO` | `/api/ao-vivo/[partidaId]` | 404 |
| `NEXT_PUBLIC_AO_VIVO_ATIVO` | `/ao-vivo/[partidaId]` | "Em breve", sem requisição |
| `DESAFIO_LIMITE_POR_SET` | limite (padrão 2, [M], sem fonte) | n/a |
| `SUMULA_SERVIDOR_SOMBRA` | avisos do motor no PUT (R8) | n/a |

## 6. Rotas públicas e acesso

- Públicas sem PII: `/api/ao-vivo/[partidaId]` (só nomes de equipe e placares; privada, simulação e rascunho = 404 idêntico) e `GET /api/convite-atleta/[token]` (só nome e naipe da equipe; todo motivo de indisponibilidade responde igual). Os links `/banco/[token]` e os dados do banco trazem só id, nome e camisa.
- Acesso por link: banco usa hash do token com expiração e revogação, limitado a uma equipe de uma partida. Apontador usa `requireSumulaTokenAccess` + `requireArbitroPartidaAccess` (escrita) e `requireSumulaLeitura` (desafios e scout, leitura). `/api/banco/links` exige árbitro/apontador da partida ou organizador dono da liga. Nenhuma rota nova ficou sem exigência de acesso.
- `arbitro-access.ts` agora usa `/^\d+$/` correto: id numérico de partida não vale como credencial.
- Header e Footer: ocultos em `/banco`, `/scout` e `/ao-vivo/`; `/sumula` e `/arbitro` mostram só o botão Sair. `/convite-atleta` mostra Header e Footer normais (página curta, aceitável). `/placar/[id]` não foi reconferido nesta rodada.

## 7. Só dá para validar no navegador ou no preview

| Fluxo | Por quê |
|---|---|
| Banco no celular: papeleta, envio com trava, pedidos, polling de 3 s, sem conexão | tela sem teste de renderização |
| I1: pedido do banco durante o set 1 ao vivo (que set aparece e que painel de desafio o mostra) | depende de snapshot real da súmula |
| I2: 4 aparelhos atrás do mesmo IP | rate limit real |
| Apontador: aceitar pedido com bloqueio do motor, aceitar papeleta e divergência | depende da tela `lancar` |
| Scout em tablet: lançar, fila sem rede, desfazer, 401 no meio do jogo | tela e `localStorage` |
| Importar planilha: modelo baixado, Excel com `;` e BOM, avisos | arquivo real |
| Convite do atleta: menor de idade, uso único, link expirado | fluxo público |
| Ao vivo em TV: tela cheia, fonte, queda de rede mantém o último placar | visual |
| Súmula impressa em A4 com log de eventos | impressão |
| Offline-first: avião, reconexão, conflito entre dois aparelhos | rede real |
| Todas as migrations 0033–0041 em preview (trigger da papeleta, FK 0041→0035, bytea) | nunca rodaram em Postgres |

## 8. Roteiro curto de teste manual por perfil

Ambiente de preview com dados de teste e flags ligadas (servidor e `NEXT_PUBLIC_`), migrations aplicadas.

1. **Organizador:** cria campeonato e categoria, gera jogos; abre a súmula da partida, gera os dois links do banco, confere que o link vale até 12 h após o jogo e que "Gerar novo link" funciona. Confere que outro organizador recebe 403/404 em `/api/banco/links` para esta partida.
2. **Líder:** cria clube, vincula equipe (e testa o 409 com equipe compartilhada); gera convite do atleta, copia e manda pelo WhatsApp; importa a planilha modelo e confere os avisos (I5); confirma e repete a confirmação (idempotente); confere o sino.
3. **Atleta:** abre o link do convite, preenche como maior e como menor (aviso de autorização); tenta reabrir o mesmo link (deve dizer que já foi usado).
4. **Banco:** abre o link no celular; monta a papeleta do set 1 (6 titulares, líbero, capitão fora dos titulares para ver a recusa); envia e confere a trava; pede tempo, substituição e desafio durante o set; cancela um pedido; desliga o Wi-Fi e confere o aviso.
5. **Apontador:** recebe papeleta e aplica na escalação; aceita e recusa pedidos; testa tempo bloqueado pelo motor; registra desafio manualmente e decide; confere que o desafio vindo do banco aparece no set certo (I1); lança scout e baixa CSV/JSON conferindo que as ações manuais estão no arquivo (B1).
6. **Árbitro:** abre o painel do jogo (atualiza a cada 3 s), confere sanções e a súmula impressa A4; fecha a súmula sem pendências da fila e tenta fechar com uma pendência (deve bloquear).
7. **Visitante público:** abre `/ao-vivo/[id]` na TV e no celular; confere que partida privada dá "não encontrada" e que nenhum nome de atleta aparece.

Pontos não testados: nada foi exercitado contra banco real nem em navegador; as telas das fases 2, scout, desafio e ao vivo seguem sem teste de renderização.
