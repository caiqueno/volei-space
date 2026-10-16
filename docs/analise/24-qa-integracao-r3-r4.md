# 24. QA da integração das rodadas 3 e 4 (cursor-teste, de 7c73b44 até 77bb853)

Data: 2026-10-16. Agente QA. Só leitura de código, comandos locais de verificação e um arquivo novo (este). Nada foi aberto em navegador, nenhum SQL executado, nenhum serviço tocado, nenhum código-fonte alterado, sem commit, push ou troca de branch. Convenção: **[R]** verificado rodando (comando ou script descartável); **[L]** inferido por leitura de código.

Escopo: 117 arquivos alterados em `src/` e `scripts/` (84 em `src/`). Lidos: Meu Time (API, cliente, UI), súmula `lancar` (diff completo), `src/lib/sumula-ui`, `src/components/sumula`, motor `src/lib/regras-volei`, `src/lib/sumula-eventos`, uploads, fila offline, súmula impressa, `capitao/jogadores`.

## 1. Comandos [R]

| Comando | Resultado |
|---|---|
| `npm run typecheck` | passou, sem erros |
| `npm run build` | passou (exit 0). Rotas novas compiladas: `/api/meu-time/**`, `/api/uploads/assinar`, `/api/uploads/documento`, `/api/sumula/[token]/eventos`, `/sumula/[token]/imprimir`, `/sumula/[token]/lancar`. Só avisos de lint já existentes (`<img>`, deps de hook; em `lancar/page.tsx` linhas 1025, 1641, 2475) |
| 117 arquivos `scripts/*.test.ts` e `*.test.mjs`, cada um isolado | 113 passam, 4 falham, todos já conhecidos: `category-selection`, `category-setup-state` (DATABASE_URL), `rls-publico.test.mjs` (deepStrictEqual), `sumula-transacional.test.ts`. **Nenhuma falha nova.** |

Não rodei `playwright test` (e2e) nem `npm run test:unit` em bloco.

## 2. Achados

### ALTA

**A1. [R+L] Assistente de inscrição fica bloqueado em toda categoria sem `RegraElenco` (o caso real hoje).**
- Contrato (`docs/analise/20-contrato-meu-time.yaml`, `/categorias/{id}/regras`): "Sem RegraElenco valem os padrões (limites null, maximoLiberos 2)". O servidor cumpre: `src/lib/meu-time/categoria.ts` devolve `minimoAtletas: null`, `maximoAtletas: null`.
- O cliente descarta a resposta: `src/lib/meu-time-ui/respostas.ts:97` (`normalizarRegrasCategoria`) devolve `null` se mínimo ou máximo forem nulos; `src/components/meu-time/cliente.ts:132-136` converte isso em falha 500 ("Não deu certo agora").
- `AssistenteInscricao.tsx:41-45` só cai para as regras da URL em 404 ou 503. Com 200 + limites nulos, mostra `FalhaTela` com "Tentar de novo" para sempre.
- Nenhum código em `src/` cria linha em `RegraElenco` (grep: só `select`; a tabela vem da migration pendente 202610170026). Logo, na prática toda categoria cai nesse caminho.
- Verificado rodando: `normalizarRegrasCategoria({..., minimoAtletas: null, maximoAtletas: null, maximoLiberos: 2, ...})` devolve `null`. Os testes não pegam: `meu-time-ui.test.ts:220-227,250` só usam limites preenchidos; `meu-time-rotas.test.ts:319` confirma o `null` do lado do servidor, sem ligar os dois lados.
- Reproduzir: conta `equipe` com `MEU_TIME_ATIVO=1`, abrir `/meu-time/<equipe>/inscrever?categoria=<id de categoria sem RegraElenco>`.
- Responsável: frontend (tolerar limites nulos) e/ou backend (devolver padrões). Esperado: o assistente abre sem limites de mínimo e máximo.

**A2. [R+L] Documento de atleta de OUTRA equipe pode ser gravado e lido (isolamento entre equipes e campeonatos).**
- `src/lib/uploads/documentos.ts:25-26` (`normalizarDocumentoEntrada`): para caminho fora do formato novo (legado), aceita qualquer valor que **chegue como URL** (`veioComoUrl`), sem conferir dono. O `caminhoDoValorArmazenado` só confere o bucket.
- Verificado rodando: `normalizarDocumentoEntrada('https://proj.supabase.co/storage/v1/object/public/atleta-arquivos/123/rg-maria.jpg', {id:5, ligaId:1})` devolve `123/rg-maria.jpg` (aceito). O mesmo valor como caminho puro e um caminho novo de outra equipe devolvem `null` (corretos).
- Em seguida `POST /api/capitao/jogadores` grava esse caminho no atleta do próprio capitão, e `GET /api/uploads/documento?jogadorId=<seu>&indice=k` (`documento/route.ts`, modo `jogadorId`) autoriza pela equipe do próprio atleta e assina a leitura do objeto de outro dono [L; a segunda metade não foi executada, exige Supabase].
- Condição: o atacante precisa conhecer o caminho legado de outro objeto (nomes legados eram `<id>/documento/<timestamp>-<nome>`, previsíveis em parte). Documento é PII sensível.
- Esperado: legado só se já estiver gravado no mesmo atleta (`jaGravados`), nunca por URL nova.
- Responsável: backend.

### MÉDIA

**M1. [R] Substituição excepcional passa na tela e derruba o salvamento da súmula quando a categoria não ativou "substituição por lesão".**
- A tela libera a troca excepcional (expulsão, desqualificação, lesão) fora do limite (`avaliacao.ts:37`, `contadorDoModo`). Grava o evento como `injury_substitution`, persistido como `lesao` (`normalizeOccurrenceType`, `lancar/page.tsx:4494`).
- O servidor, com `substituicaoPorLesao !== true`, soma `lesao` ao limite (`src/lib/sumula-regras.ts:95-96`, chamado por `api/sumula/[token]/route.ts:332-341`).
- Verificado rodando: 6 trocas regulares + 1 `lesao`, limite 6, `substituicaoPorLesao:false` devolve "A equipe atingiu o limite de 6 substituições no set 1."; com `true` devolve `null`.
- Efeito: depois da 6ª (ou 8ª) troca, uma expulsão em quadra obriga a troca excepcional (RG-SUB-012), a tela deixa registrar, e o PUT passa a falhar em todo salvamento (`falhaSalvamento`), travando fechamento e aprovação. A tela só avisa "o servidor ainda soma esta troca" (`ModalSubstituicao.tsx:96`) e deixa seguir.
- Reproduzir: categoria com `substituicaoPorLesao=false`, limite 6, lançar 6 trocas, dar vermelho/ofensiva a atleta em quadra, registrar a troca excepcional, observar o toast de falha de salvamento.
- Responsável: backend (`validarSubstituicoes` precisa contar `lesao` só como excepcional quando o motor a classifica assim) ou frontend (bloquear). Teste a criar: `sumula-regras` com 7ª `lesao`.

**M2. [L] A tela fixa como regra itens NÃO CONFIRMADOS do doc 23 e tira do árbitro a escolha do cartão.**
- `sancoes.ts:127-129`: 1ª conduta menor = advertência verbal (sem cartão), a seguinte = amarelo. Doc 23 divergência 7: NÃO CONFIRMADO. Sem configuração.
- `sancoes.ts:72-77`: contagem por categoria (doc 23 divergência 8, NÃO CONFIRMADO).
- `lancar/page.tsx:1413-1500` (`saveNote`) grava o que o motor calculou (`tipoDaNota`), ignorando o botão que o árbitro tocou. Quem toca "Cartão amarelo" na 1ª vez registra "Advertência verbal"; quem toca "Cartão vermelho" na 1ª vez de um atleta registra penalidade com ponto ao adversário. `PenaltyModal` deixa só a categoria como escolha. Nenhum caminho "o árbitro decidiu de outra forma" além de nota livre.
- O cabeçalho de `sumula-ui/sancao.ts:5` diz "[M] NÃO bloqueiam: a tela só explica", o que não é verdade: a categoria padrão do botão vermelho é `GROSSEIRA` (`categoriaPadraoDoTipo`) e muda placar.
- Responsável: regras-de-volei e frontend. Tornar configurável (CONFIG_ITENS_M já documenta) e dar override ao árbitro.

**M3. [R+L] Todas as sanções "vermelhas" são persistidas como `CARTAO_VERMELHO`, o que o servidor lê como EXPULSAO.**
- `tipoDaNota` (`sumula-ui/sancao.ts:46-55`) devolve "Cartão vermelho" para PENALIDADE, EXPULSAO e DESQUALIFICACAO (verificado rodando). `normalizeOccurrenceType` mapeia o texto para `CARTAO_VERMELHO`, e `src/lib/sancoes.ts:18` mapeia isso para `EXPULSAO` (peso 1; só `DESQUALIFICACAO` pesa 2).
- Efeito: a desqualificação some do quadro de sanções do servidor; a penalidade passa a contar como expulsão (e, quando houver `jogadorId`, geraria suspensão automática "expulsão gera suspensão" em `suspensaoAutomatica`, enquanto o doc de `sancoes.ts` diz "penalidade não suspende").
- Atenuante hoje: as notas gravam `jogadorId: null` (`lancar/page.tsx:1523-1532`), então a suspensão não dispara e `mensagemSancaoInvalida` ignora a ocorrência. O risco aparece quando o `jogadorId` passar a ser enviado.
- O teste `sumula-ui-motor.test.ts` fixa `tipoDaNota('PENALIDADE') === 'Cartão vermelho'`. Esperado: tipos distintos para penalidade, expulsão e desqualificação.

**M4. [L] A premissa "eventos mais novos primeiro" é implícita e tem dois consumidores com premissas opostas.**
- A tela guarda `events` do mais novo para o mais antigo (`addMatchEvent`: `[item, ...current]`). `estadoMotor` (`lancar/page.tsx:1119`) e `previaSancao`/`saveNote` (`1408`, `1433`) usam `[...events].reverse()`.
- Funciona após recarregar apenas porque `substituirOcorrencias` (`sumula-gravacao.ts`) apaga tudo e insere em lote na ordem do array (ids crescem do mais novo para o mais antigo) e `sumula-consulta.ts:95-97` ordena por id crescente. Qualquer mudança (inserção parcial, outra rota gravando, a futura fila por eventos) inverte o replay sem erro visível.
- Por outro lado, `sumula-impressa/montar.ts:34-36` e `presenca-oficial.ts:124` tratam id crescente como cronológico. Para súmulas gravadas pela tela, tempos, substituições e sanções saem da mais nova para a mais antiga na súmula impressa; o teste `sumula-impressa.test.ts` usa fixture cronológica (ids 1..11) e por isso não detecta.
- Verificado rodando: o replay com a lista invertida muda `emQuadra` (`[7,2,3,4,5,6]` contra `[1,2,3,4,5,6]`).
- Reproduzir (impressa) [L]: lançar dois tempos e duas substituições no mesmo set, abrir `/sumula/<token>/imprimir` (não há link, ver M12), conferir a ordem das linhas.
- Esperado: ordenação explícita por um campo de ordem (seq ou timestamp) nos dois lados, e fixture invertida nos testes.

**M5. [L] "Desfazer" não alcança sanção sem ponto nem a troca feita entre dois pontos.**
- Desfazer ponto usa `scoreHistory` (`lancar/page.tsx:728-787`), que só guarda ids dos eventos do ponto. Advertência verbal, amarelo, expulsão e desqualificação não entram no histórico e não há botão para removê-las. A marca `[[SAN:...]]` fica no log e passa a escalar o próximo cartão do mesmo atleta; um cartão dado ao atleta errado não tem correção.
- Penalidade com ponto: o desfazer remove a nota-evento e o ponto (a marca `[[SAN]]` some), mas o item de `anotacoes` (estado separado, sem remoção) continua e vai ao servidor como ocorrência `CARTAO_VERMELHO` (o mesmo vale desde a rodada 2 para o vermelho antigo).
- Desfazer um ponto anterior a uma substituição restaura `lineupA/B` do snapshot, mas o evento de substituição permanece: o motor passa a ver contador e formação divergentes (`comFormacaoAtual` usa a formação da tela; `regulares` vem do replay).
- Reproduzir: lançar +1, substituir, +1, "desfazer ponto do time" do primeiro; ver a formação na quadra voltar ao titular e o contador "Troca 2 de N" continuar.

**M6. [L] Bloqueios do motor sem saída na tela.** `caixaDeBloqueio` (`sumula-ui/explicacao.ts`) interrompe troca, tempo e cartão quando o motor recusa (RG-SUB-001/003/004, RG-SAN-007). A ação sugerida é "registre em Anotações" quando "o árbitro decidiu de outra forma", mas a nota não altera o log do motor, então o replay continua bloqueando as trocas seguintes. Regras da divergência 9 (pedido com vários jogadores) viraram aviso, as outras viraram bloqueio. Sem override, um erro do motor ou regra de campeonato diferente impede o apontador de registrar um fato que aconteceu.

**M7. [L] Convite do organizador não é exigido na inscrição.** `novaInscricaoSchema` aceita `convite` opcional e `inscricao.ts:93` só confere quando ele vem. O cliente nunca envia (`cliente.ts` e `NovaInscricao` não têm o campo; `navegacao.ts` só carrega `categoria`, `min`, `max`...). Quem souber o `categoriaCampeonatoId` (visível em páginas públicas) inscreve a equipe sem o link de convite. O texto do contrato fala em convite do organizador. Decisão de produto a registrar; hoje a categoria funciona como "aberta". Responsável: backend e frontend (enviar o `tokenInscricao`).

**M8. [L] Meu Time: telas de gestão não respeitam o papel.** Só `AcessoEquipe` esconde botões por papel. `AbaDados` (editar dados do time: só RESPONSAVEL no servidor, `equipes/[id]/route.ts` PATCH), `AbaAtletas`, `AbaComissao` e o assistente de inscrição mostram tudo a ASSISTENTE e CAPITAO (e "Editar dados" ao TECNICO); o resultado é 403 com a mensagem genérica "Só quem é responsável...". O cliente em memória usado nos testes permite TECNICO editar (`cliente.ts:241`), ao contrário do servidor, então o teste não pega.

**M9. [L] Meu Time: flag desligada (404) vira "time não encontrado".** Contrato: flag off devolve 404 `{error:'Não encontrado.'}`. `classificarFalha` (`respostas.ts`) trata 404 como `nao-encontrado`; a tela mostra "O time pode não ser da sua conta" com botão "Ver meus times", que volta para a mesma tela (laço). Só o 503 vira o aviso "ainda não habilitado". Verificado rodando: `classificarFalha(404, {error:'Não encontrado.'})` devolve `tipo: 'nao-encontrado'`. Além disso o 503 de `ComissaoTime` ausente em POST/DELETE de comissão mostra "O Meu Time ainda não está habilitado", embora o resto funcione (o GET do detalhe tolera, contrato).

**M10. [L] Enumeração de contas por e-mail em `POST /meu-time/equipes/:id/membros`.** `dados.ts:395-420`: o responsável descobre se um e-mail tem conta (404 `CONTA_NAO_ENCONTRADA` ou 201) e recebe `id` da conta e `nome`. Qualquer pessoa pode criar conta `equipe`, criar um time e varrer e-mails. Sem limite de taxa. O contrato diz que não devolve e-mail ou telefone (cumpre), mas devolve nome e id. A pessoa é adicionada sem aceite.

**M11. [L] Uploads de candidatura anônimos.** `uploads/assinar/route.ts:67-82`: sem sessão, qualquer um recebe URL assinada para os buckets públicos `equipe-emblemas` e `quadra-foto` (até 5 MB), com limite de 30 por hora por IP. O limite é em memória por instância (`consumirLimite`) e o IP vem de `x-forwarded-for` (mesmo risco B4 do doc 19). Abuso de armazenamento e hospedagem de imagem de terceiros em domínio público. `FormularioInscricaoRapida.tsx:116-122` ainda faz upload direto pelo client anon (exceção documentada no teste-guarda, mas contradiz "uploads completos").

**M12. [L] Fila offline e súmula impressa não estão ligadas a nenhuma tela.** Nenhum arquivo em `src/app` ou `src/components` (fora dos próprios módulos) importa `sumula-offline`, `IndicadorConexao` ou `useFilaSumula`; a tela de lançamento continua gravando por PUT. Nenhum link leva a `/sumula/[token]/imprimir`. As duas entregas estão testadas por unidade, mas não existem para o usuário. A rota `/api/sumula/[token]/eventos` também está desligada por padrão (`SUMULA_EVENTOS_ATIVO`).

**M13. [R] Testes ainda fixam itens [M]/NÃO CONFIRMADO como regra.**
- `regras-volei-sancoes.test.ts:46-55` (RG-SAN-001): advertência verbal e depois amarelo; `sumula-ui-motor.test.ts` ("menor: 1ª é advertência verbal").
- `regras-volei-wo-interrupcao.test.ts:41-45`: WO em melhor de 3 vale 2x0 (a FIVB não define; doc 23 seção 2 pede configurável).
- `regras-volei-eventos.test.ts:124-137` e `regras-volei-set.test.ts:93`: 3º set obrigatório e "não é decisivo" (D2, formato do organizador).
- `regras-volei-eventos.test.ts:288-309` (CJ-03): o comentário diz que o placar não é afirmado, mas o teste fixa que o ponto do side-out (`momentoSeq: 4`) é cancelado (3 pontos de B) e que B fica sem pontos; é a interpretação 5 do doc 23.
- `regras-volei-eventos.test.ts:343-350`: penalidade entre sets vira 0x1 no set seguinte (quem saca em 0x0 é [M]).
- Corretos: o WO 3x0 com 25x0 agora está certo (divergência 1 do doc 23 resolvida), `faltaRotacaoPontoAdversario` segue como flag.

### BAIXA

**B1. [L] `POST /api/capitao/jogadores` aceita qualquer URL em `fotoRostoUrl`** (`route.ts:25`, `z.string().url()`), sem exigir o bucket nem o caminho gerado pelo servidor; aceita `javascript:` e hosts externos. As fotos novas passam por `/api/uploads/assinar`, mas o campo não é validado como o de documentos.

**B2. [L] Capitão sem equipe vinculada não consegue mais enviar logo nem foto** (`capitao/page.tsx`, mensagens "só pode ser enviada quando a equipe está vinculada"): regressão funcional para o cadastro inicial (antes o upload ia para uma pasta por candidatura).

**B3. [L] `obterUrlDocumento` (`uploads-cliente.ts:118`) não tem consumidor.** O capitão vê só "N doc(s)" e organizador e árbitro não têm tela para abrir documento pela URL assinada. O bucket é privado, então os links antigos de `admin/candidaturas/page.tsx:344` deixam de abrir.

**B4. [L] Documentos externos somem do formulário do capitão.** `documentoParaLeitura` filtra valores que não são do bucket privado; ao salvar o atleta, `documentosUrls` é regravado só com os que sobraram (perda silenciosa).

**B5. [L] Galeria**: se o upload da miniatura falha depois do upload grande, o arquivo grande fica órfão no bucket (`GaleriaOrganizador.tsx`).

**B6. [L] Lote de atletas** (`dados.ts` `prepararLote`): quando vêm `texto` e `atletas` juntos, os números de linha de `ignorados` se repetem; no modo `texto` a linha informada é a do candidato, não a da linha colada. Dedupe só por nome no lote e por nome + nascimento no cadastro simples; sem restrição única no banco (checar e inserir sem transação).

**B7. [L] Replay da tela conta o ponto de penalidade (`type: 'point'`) como rally concluído** (`sumula-ui/estado.ts:123,152`): libera o pedido de nova substituição e a troca de líbero sem rally real. O match de camisa em `lerTroca`/`idDe` usa a camisa do jogo antes do número do cadastro e pode confundir quando um número de cadastro coincide com a camisa trocada de outro atleta.

**B8. [L] Fila offline**: eventos rejeitados por 422 vão para `pendencias` e os seguintes continuam sendo enviados (o placar do servidor pode divergir do local sem o apontador perceber); a chave do `localStorage` (`volei.sumula.fila.v1.<token>`) leva o token da súmula. 401 e 403 param a fila até `retomar()`; correto.

**B9. [R] Lacuna de teste B2 do doc 19 continua**: a mutação `if (estado.emQuadra.includes(entra))` por `if (false)` em `libero.ts:53` sobrevive (RG-LIB-006 "já está em quadra" sem asserção).

**B10. [L] Cliente em memória (`criarClienteMemoria`) diverge do contrato**: `atletasCriados` em vez de `criados`, TECNICO pode editar o time, `meuPapel` e `membros` ausentes no detalhe; fixtures de teste não refletem o servidor.

## 3. Mutação manual no motor [R]

Cópia do repositório em pasta temporária fora do repositório (`scratchpad/mut`, apagada ao fim), 25 mutações em `src/lib/regras-volei`, `src/lib/sumula-eventos` e `src/lib/sumula-ui`, rodando 15 arquivos de teste do motor por mutação (parando no primeiro que falha). Nenhum arquivo do repositório foi tocado (conferido com `git status`).

| Mutação | Resultado |
|---|---|
| M01 set: `maior >= alvo` para `>` | pega (6 arquivos) |
| M02 set: margem `>=` para `>` | pega |
| M03 tempos: `usados >= limite` para `>` | pega (`regras-volei-set`) |
| M04 alvo do set decisivo `>=` para `>` | pega |
| M05 limite de substituições `>=` para `>` | pega |
| M06 "um pedido por interrupção" desligado | pega |
| M07 par repetido sempre permitido | pega |
| M08 1ª ofensiva vira desqualificação | pega |
| M09 atraso: `n === 0` para `n <= 1` | pega (corrige B3 do doc 19) |
| M10 expulsão afasta pela partida | pega |
| M11 falta de rotação cancela `>` (exclui o momento) | pega |
| M12 tolerância de WO `<` para `<=` | pega |
| M13 mínimo de aptos 6 para 5 | pega |
| M14 só um líbero em quadra, desligado | pega |
| M15 líbero só no fundo, desligado | pega |
| **M16 jogador já em quadra (`libero.ts:53`) desligado** | **sobrevive** (B9) |
| M17 camisa máxima +1 | pega |
| M18 idempotência por `clientEventId` desligada | pega (`sumula-eventos`) |
| M19 formação distinta (6 ids) relaxada na tela | pega (`sumula-ui-motor`) |
| M20 desqualificação de set anterior `>=` para `>` | sobrevive; provável mutante equivalente (a sanção do próprio set entra pelo laço de eventos) |
| M21 mapa de posições da tela em identidade | pega |
| M22 cartão vermelho padrão vira OFENSIVA | pega |
| M23 `LIMITE_OFICIAL_TEMPOS` 2 para 3 | pega (corrige B1 do doc 19) |
| M24 `LIMITE_OFICIAL_SUBSTITUICOES` 6 para 7 | pega |
| M25 WO aceito após partida encerrada | pega (`regras-volei-estado-derivado`) |

23 de 25 pegas; 1 lacuna real (M16) e 1 equivalente (M20). Observação: o fluxo de pontos, desfazer, faixa "Quem fez?" e líbero em `lancar/page.tsx` (5102 linhas) só é coberto por testes de texto-fonte (`sumula-ui-motor`, `desfazer-ponto-sumula` etc.), não por execução. Mutações dentro da página não foram testáveis sem navegador.

## 4. Itens do pedido sem achado (verificado)

- **Contrato Meu Time x cliente [L, com A1 e M9 acima]:** rotas, métodos e formatos conferem: `GET /meu-time` (`{data:{equipes}}`), `POST /equipes`, `GET|PATCH /equipes/:id`, `/prontidao`, `/atletas`, `/atletas/lote` (`{atletas}`; `criados` lista, tratado por `normalizarResultadoLote`), `/atletas/:id` PATCH e DELETE, `/comissao` GET e POST, `/comissao/:membroId` DELETE, `/membros` GET e POST, DELETE com `?membroId=`, `/inscricoes` (`data` + `avisos`), `/categorias/:id/regras`. Falta o campo opcional `convite` e `posicao` no lote (M7, B10). Papéis no servidor conferem com o contrato (`PAPEIS_POR_PERMISSAO`); posse por `MembroEquipe` e 404 para quem não é membro.
- **Tolerância a tabela ausente:** `lerDados` converte 42P01/PGRST205 em 503; `listarComissaoTolerante` devolve `[]` no detalhe; colunas opcionais regravam sem elas (`colunaAusente`), CHECK antigo regrava com origem `MIGRACAO`. Conferem com o contrato.
- **Resposta sem PII:** `paraAtleta` usa lista branca (só `temDocumento`); `select('*')` de `Atleta`, `RegraElenco` é seguido de projeção. Novo `select('*')` no diff: `categoria.ts:43` e `inscricao.ts:106` (`RegraElenco`, sem PII). `GET /api/capitao/jogadores` devolve `select('*')` do `Jogador` com CPF, telefone e `qrCodeToken` ao próprio capitão da equipe (escopo correto, mas amplo).
- **Client anon:** importadores restantes em `src`: `FormularioInscricaoRapida.tsx` (exceção documentada), `use-banco-ao-vivo.ts`, `supabase.ts`; `anon-client-guard.test.ts` passa. Migrados para o upload assinado: capitão, galeria, logo do organizador, candidatura.
- **Autorização de upload por tipo [L]:** `escopo equipe` exige organizador dono da liga (`Liga.organizadorId`) ou capitão da equipe (`CandidaturaEquipe.equipeId`); `liga` exige `exigirOrganizadorDaLiga`; `organizador` usa a sessão; o caminho nasce no servidor (uuid, extensão pelo MIME); leitura de documento: organizador, capitão e árbitro escalado ou do link; 404 igual para "não existe" e "não é seu". Isolamento entre organizadores no `assinar`: ok, exceto A2.
- **Isolamento entre organizadores:** nenhuma rota de organizador foi alterada no diff além dos usos de `exigirOrganizadorDaLiga`; sem regressão encontrada.
- **Faixa "Quem fez?" (M4 do doc 19)** não foi alterada nesta rodada; o desfazer chama `setFaixaPonto(null)`.

## 5. O que NÃO foi testado

- Nenhuma interação em navegador (celular, tablet, telão). Tudo de `lancar/page.tsx`, `ModalSubstituicao`, `CaixaRegra`, Meu Time e impressão é leitura mais testes de unidade.
- Sem banco (Supabase/Postgres): migrations 202610170024 a 202610170029, RLS, buckets, tabela `ComissaoTime`, `RegraElenco`. A segunda metade de A2 e a persistência de M1 usaram só a função pura.
- Fluxo ponta a ponta do roteiro (organizador, líder, partida, súmula, aprovação, classificação), sessão expirada, voltar do navegador, duplo clique real, concorrência.
- `playwright test`, impressão em papel/PDF, limites de taxa em ambiente com vários processos.
- Tempos de resposta e carga: `estadoMotor` refaz o replay inteiro a cada render com o modal aberto (lido, não medido).

## 6. Resumo

- Alta: A1 (assistente de inscrição bloqueado sem `RegraElenco`), A2 (documento legado de outra equipe aceito).
- Média: M1 a M13.
- Baixa: B1 a B10.
- Já conhecido e fora do escopo: `category-selection`, `category-setup-state`, `rls-publico`, `sumula-transacional`.
- Testes novos pedidos aos agentes (QA não alterou `scripts/`): (1) `normalizarRegrasCategoria` com limites nulos e a resposta real do servidor; (2) `normalizarDocumentoEntrada` com URL legada de outra equipe; (3) `validarSubstituicoes` com 7ª `lesao`; (4) `tipoDaNota` distinto por sanção e `normalizeOccurrenceType`; (5) `sumula-impressa` com fixture em ordem inversa; (6) `libero.ts` "já está em quadra".
