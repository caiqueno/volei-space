# 19. QA da integração (branch teste-integrado vs main)

Data: 2026-10-16. Agente 10 (QA). Nada foi aberto em navegador, nenhum SQL executado, nenhum serviço tocado, nenhum código-fonte alterado. Convenção: **[R]** verificado rodando; **[L]** inferido por leitura de código.

## 1. Resultado dos comandos [R]

| Comando | Resultado |
|---|---|
| `npm run typecheck` | passou, sem erros |
| `npm run build` | passou (exit 0). `/placar/[id]` e `/sumula/[token]/lancar` compilam |
| `scripts/*.test.ts` e `*.test.mjs` (94 arquivos, cada um isolado) | 90 passam, 4 falham |

Falhas (todas já conhecidas e anteriores a esta rodada, não são regressão):
- `category-selection.test.ts` e `category-setup-state.test.ts`: `DATABASE_URL ausente` (precisam de banco). Obs.: o helper `category-test-database.ts` agora existe; a falha é só a variável de ambiente.
- `sumula-transacional.test.ts`: `TypeError ... reading 'trim'` (sem env de banco).
- `rls-publico.test.mjs`: `ERR_ASSERTION` deep-equal.

Nenhuma falha nova. Não rodei `playwright test` (e2e) nem `npm run test:unit` em bloco (rodei os mesmos arquivos um a um).

## 2. Achados

### Média

**M1. Limite de login contornável por rajada paralela [L].** `src/app/api/auth/route.ts` (bloco que chama `limiteEsgotado` por volta das linhas 54-65, depois `checkRateLimit` só após `autenticar` devolver 401, ~linhas 72-78). A cota é consultada antes e só incrementada depois que o bcrypt termina. N requisições simultâneas passam todas pela consulta com contagem 0 e só depois somam. O limite de 5 falhas vira "5 falhas por rodada concorrente".
Reproduzir: disparar 50 POST `/api/auth` simultâneos (mesmo e-mail, senha errada) com a contagem em 0; esperar 401 em todos, em vez de 401 x5 e 429 nos demais. Ressalva: não executei a rajada, conclusão por leitura.
Correção sugerida (backend): reservar a tentativa antes (`checkRateLimit`) e devolver/zerar no sucesso.

**M2. Bloqueio por e-mail sem IP permite travar a conta de terceiros [L].** `auth/route.ts`: a chave passou de `login:email:${ip}:${email}` para `login:email:${email}` (5 falhas em 15 min). Qualquer pessoa pode manter um organizador legítimo em 429 enviando 5 senhas erradas a cada 15 min. A senha certa também recebe 429 durante o bloqueio (o próprio teste `rate-limit.test.ts:136` consagra isso). Risco real em dia de campeonato (apontador/organizador sem conseguir entrar). Decisão de produto: aceitar, ou combinar e-mail+IP/dispositivo, ou reduzir a janela.

**M3. Texto de inscrição diz "sem aprovação", backend ainda pode gravar SOLICITADA [L].** `src/app/capitao/page.tsx` (mensagem "Inscrição registrada no campeonato.", ~linha 169; rótulos em `getCapitaoStatus` ~linhas 873-894) e `FormularioInscricaoRapida.tsx` (tela "Equipe cadastrada ... foi cadastrada em ..."). Mas `src/app/api/inscricoes-campeonato/route.ts:178` usa `statusInicialDaInscricao(liga.inscricaoAprovacaoAutomatica)`, que devolve `SOLICITADA` quando a flag é false (default do banco), e o `PATCH` ainda aprova/rejeita. Resultado: a tela diz que está registrada/sem espera, enquanto o status real continua pendente e, no capitão, `approved` fica false ("Cadastro em andamento. Vincule a equipe a um campeonato" para quem já se vinculou). Reproduzir: campeonato com `inscricaoAprovacaoAutomatica = false`, capitão solicita inscrição, abrir `/capitao`. A divergência entre o requisito (CLAUDE.md: sem aprovação) e o código precisa ser decidida e o status inicial alinhado (backend) ou o texto corrigido (frontend).

**M4. Faixa "Quem fez?" pode reaparecer depois da confirmação de fim de set [L].** `src/app/sumula/[token]/lancar/page.tsx`: `logPoint` faz `setFaixaPonto(...)` e, quando o ponto fecha o set, `setEndPrompt` é preenchido. A faixa só renderiza com `!setEndPrompt`, mas o estado `faixaPonto` continua definido; ao fechar o modal de fim de set, o componente monta de novo, o timer de 5 s recomeça e a faixa aparece sobre o set seguinte para um ponto já "antigo". Também não há limpeza do `faixaPonto` em troca de set/partida. Efeito: toque acidental atribui o ponto do set anterior a um atleta (reescreve o evento antigo; o placar não muda). Reproduzir: lançar o ponto decisivo de um set com "+1", confirmar o fim do set, observar a faixa. Não validado em navegador.

**M5. CSS de toque da súmula (globals.css, final do arquivo, ~linhas 18000-18055) não foi validado em tela [L, não testado].** Aumenta `min-height` para 44/52 px em ações da barra e da quadra com seletores `html body ...`, e desliga o `::after` de `.official-toque-44`. Risco de quebrar a grade de 6 posições / barra em celular estreito ou tablet em paisagem (overflow, sobreposição com a nova faixa fixa de 48 px+ no rodapé). Nenhum teste automatizado cobre layout; `barra-placar-sumula.test.ts` passa mas não mede tamanho. Precisa de verificação visual em 360x640, 768x1024 e 1024x768.

### Baixa

**B1. `LIMITE_OFICIAL_TEMPOS` sem teste [R, mutação].** Trocar `LIMITE_OFICIAL_TEMPOS = 2` por `3` em `src/lib/regras-volei/config.ts:9` não derruba nenhum dos 7 arquivos `regras-volei-*`. O padrão de 2 tempos por set (RG-TMP-001) nunca é afirmado; os testes passam o limite como parâmetro.

**B2. Guarda "jogador já em quadra" do líbero sem teste [R, mutação].** Em `src/lib/regras-volei/libero.ts` (~linha 44-46) trocar `if (estado.emQuadra.includes(entra))` por `if (false)` sobrevive em `libero`, `substituicoes` e `eventos`. Mensagem RG-LIB-006 "já está em quadra" não é exercitada.

**B3. Código de atraso (RG-TMP-007/008) não é afirmado [R, mutação].** `sancoes.ts:125`: inverter `n === 0` para `n === 1` só no campo `codigo` sobrevive. A `sancao` (advertência/penalidade) é testada; o código da regra, não.

**B4. Store de rate limit em memória por instância [L].** `RateLimitStoreComFallback` cai para memória por 5 min depois de uma falha do Supabase; em serverless cada instância tem a sua contagem, então o limite efetivo é maior, e as contagens ficam divididas entre os dois stores na troca. Aceitável como fallback; registrar como risco conhecido. Também: `ipDaRequisicao` confia no primeiro valor de `x-forwarded-for`; fora de um proxy que o sobrescreva (ex.: Vercel faz), o cliente forja o IP e anula só o limite por IP (o por e-mail permanece).

**B5. Importação de lista colada grava em série, sem proteção a duplo clique antes do `loading` [L].** `FormularioInscricaoRapida.tsx` `importarLista`: um POST por atleta em laço; se o `ActionBar` demorar a refletir `importando`, duplo clique pode enviar a lista duas vezes (o filtro de repetidos usa o estado `jogadores` ainda sem os recém-salvos). Verificar no servidor se há trava de nome/camisa duplicada (`atleta-duplicado.test.ts` passa, mas cobre outro caminho).
Parser: "7. Ana" é lido como marcador de lista e a camisa 7 se perde (documentado no código, mas pode surpreender).

**B6. Foco global em `[tabindex]` (globals.css ~linha 150) [L].** `:where(... [tabindex]):focus-visible` também desenha contorno em contêineres com `tabindex="-1"` focados por código (ex.: `main`). Cosmético.

**B7. `.placar-logo { zoom: 1.6 }` (placar.css) [L].** `zoom` não é padrão e falha em navegadores sem suporte (Firefox antigo); OBS/Chromium funciona. A rota `/placar/[id]` mostra "Placar indisponível" para qualquer erro HTTP, inclusive 404 de partida inexistente (a mensagem "Partida não encontrada" só aparece para id inválido).

### Verificado e sem problema encontrado (por leitura)
- `requireOrganizador` (`organizador-isolamento.ts`): `releasedOnly` padrão true; `GET /api/organizador/perfil` segue com `requirePublicRole` sem `releasedOnly`, `PATCH` exige liberado. `inscricoes-campeonato` PATCH continua checando `liga.organizadorId === auth.userId` (403). `ligas` POST continua comparando `auth.userId` com `organizadorId`.
- `ativar-conta`: link de uso único com consumo condicional (`.is('emailVerificadoEm', null)`), leitura tolerante a coluna `trocarSenha` ausente. Único ponto que grava `emailVerificadoEm` é essa rota, então não há regressão de quem já estava verificado.
- Webhook InfinitePay: sempre 410, não lê corpo, não toca banco; `validateWebhookSignature` rejeita assinatura de tamanho/formato inválido antes do `timingSafeEqual`. Testes `api-contrato` e `pagamento-simulado` afirmam 410.
- Pagamento simulado: `gravarPagamentoSimulado` tenta com `pagamentoOrigem` e repete sem a coluna se ela não existir (migration pendente não trava a liberação).
- Rate limit: `SupabaseRateLimitStore` usa compare-and-swap com 3 tentativas e, na disputa persistente, nega (falha fechada); `RateLimitStoreComFallback` cai para memória sem quebrar o login. Teste com tabela ausente existe (`rate-limit.test.ts`, `testeFallbackSemTabela`). `forgot-password` responde igual ao sucesso quando limitado (sem enumeração).
- Segredos JWT derivados por finalidade (`token-verify.ts`): token de sessão não vale como reset/ativação. **Efeito de implantação:** os cookies de sessão emitidos antes do deploy deixam de validar (todos os usuários precisarão entrar de novo). `replicar/route.ts`, `acesso-arbitro-jogo.ts` e `password-fingerprint.ts` ainda usam `JWT_SECRET` direto (independentes, sem conflito).
- `LiveMatchView`: falha isolada mantém o último placar com aviso "Sem conexão"; só mostra erro total se nunca houve dados.

## 3. Motor `src/lib/regras-volei`

- **O motor não é importado por nenhum arquivo de `src/` fora dele [R, grep].** Hoje só os testes o executam. A súmula, a API e as telas continuam com suas regras próprias. Os testes validam o motor, não o produto; qualquer divergência entre motor e `lancar/page.tsx` não seria detectada.
- **Os testes não são tautológicos [R, mutação].** Copiei o motor e os 7 arquivos de teste para uma pasta temporária (fora do repositório) e apliquei 16 mutações. 12 foram detectadas: margem de 2 pontos (`>=` para `>`), alvo (`>=` para `>`), sentido do rodízio, limite de 6 substituições (`>=` para `>`), alerta acima do oficial, ponto e saque da penalidade, bloqueio de desqualificado (código RG-SAN-008), código RG-TMP-002, tolerância de WO (`<` para `<=`), limite de 4 h de interrupção (`>` para `>=`), líbero único em quadra, evento de tempo. Sobreviveram 4 (B1, B2, B3 acima). Os asserts usam valores independentes (placares concretos, 24x24, 26x24, 30x28), não repetem a fórmula.
- Convenção positiva: o helper rejeita caso cujo nome não comece com o ID da regra.

### Regras do 03 sem nenhum teste (nenhum arquivo em `scripts/` cita o ID)
Total de IDs no 03: 128 (além de prefixos soltos). Sem teste:

- Núcleo do jogo que o motor poderia validar: **RG-POS-001, RG-POS-002, RG-POS-005** (posições na recepção/saque, ilegal por substituição), **RG-SAQ-003** (sacador na posição 1, 8 s), **RG-PTO-001/002/003** (ponto do rally, faltas sucessivas/simultâneas, ponto 25), **RG-FOR-001** (sorteio), **RG-FOR-004/006/007/008** (papeleta e discrepâncias), **RG-FOR-010/011**, **RG-SET-005/007** (intervalo e fim do set), **RG-SUB-005/006/015**, **RG-TMP-003/004/005/006/009/010**, **RG-INT-001/002** (rally repetido), **RG-LIB-014**.
- Elenco e fechamento da súmula: **RG-ELE-001 a 007** (12/14 jogadores, camisas 1-20, capitão, formato do nome, mandante à esquerda), **RG-FEC-001 a 005**, **RG-INT-006/007**, **RG-PRO-001 a 004** (protesto), **RG-WO-003**.
- Vôlei de praia: **RG-PRA-001 a 011** (nenhum teste de perfil praia: 21 pontos, 2 sets, troca de lado a cada 7/5, sanções por set).
- Do 09 (casos de jogo): 10 casos CJ no documento, apenas 7 IDs `CJ-` citados em scripts; conferir a lista exata antes de dar a cobertura como completa (não mapeei caso a caso).

Nota: RG-ELE-001/004, RG-TMP-005 e RG-PRA-* aparecem como regras do motor/perfil no 03 mas não têm função correspondente em `regras-volei/` (grep por ID no código só encontra RG-TMP-001/002/005 em `set-partida.ts`, RG-POS-003/004, RG-FOR-005/009). Ou seja, parte da lacuna é de implementação, não só de teste.

## 4. Lacunas de teste das mudanças desta rodada

Sem cobertura automatizada (nem unitária nem e2e), confirmado por grep em `scripts/` e `e2e/`:
1. `FaixaQuemFez` e `atribuirPontoDaFaixa` na súmula: só a função pura `atribuicao-ponto` é testada. Falta e2e: lançar +1, atribuir saque/ataque/bloqueio, desfazer pela faixa, expirar em 5 s/8 s, fim de set com faixa aberta (M4), dois +1 seguidos, placar e estatística por atleta depois da atribuição.
2. `FormularioInscricaoRapida`: lista colada, contador de elenco e bloqueio de "Concluir" têm teste só da lógica pura (`elenco-inscricao.test.ts`). Falta: falha de rede no meio da importação, duplo clique, limite máximo, link "Copiar" sem permissão de área de transferência.
3. `PlacarOverlay` / `/placar/[id]`: nenhum teste (nem de renderização, nem de `?fundo=transparente`, nem de que a resposta pública não vaza dados de atletas).
4. `EscolhaInicial` e a nova ramificação de `/cadastro` (sem parâmetro mostra escolha; `perfil=organizador` redireciona a `/seja-membro`): sem teste.
5. Login: nenhum teste de rajada paralela (M1) nem de bloqueio cruzado entre IPs para o mesmo e-mail (M2). Sem teste de `reset-password` com 429.
6. `requireOrganizador` com organizador pendente e `trocarSenha=true` em `PATCH /api/organizador/perfil` e `PATCH /api/inscricoes-campeonato` (o teste `organizador-liberado` cobre o caso sem sessão e o fluxo de ativação; confirmar que cobre `releasedOnly` com status PENDENTE).
7. Texto do capitão e do formulário versus status real da inscrição (M3): nenhum teste liga mensagem à flag `inscricaoAprovacaoAutomatica`.
8. Isolamento entre organizadores: os testes existentes (`autorizacao-rotas`, `isolamento-categoria`) continuam passando; não há caso novo para `PATCH /api/inscricoes-campeonato` com inscrição de liga de outro organizador (a rota trata com 403 por leitura, sem teste dedicado).
9. Layout responsivo (celular/tablet) da súmula, do placar e do formulário: sem teste visual e sem verificação manual nesta rodada.

## 5. O que NÃO foi testado
- Nenhuma interação em navegador (nem celular, nem tablet, nem telão/OBS). Tudo de frontend acima é leitura de código e build.
- Testes e2e Playwright não rodados.
- Banco real (Supabase/Postgres): migrations pendentes, RLS, tabela `RateLimit`, coluna `pagamentoOrigem`, bucket privado. Só os fakes dos scripts.
- Fluxo ponta a ponta do roteiro (organizador cria campeonato, líder se inscreve, súmula, classificação).
- Sessão expirada, voltar do navegador, duplo clique real, concorrência real de requisições (M1 e B5 são por leitura).

## 6. Resumo por gravidade
- Alta: nenhuma encontrada.
- Média: M1 (rajada contorna limite de login), M2 (bloqueio por e-mail permite negar acesso a terceiros), M3 (copy "sem aprovação" versus status SOLICITADA), M4 (faixa reaparece após fim de set), M5 (CSS de toque da súmula sem validação visual).
- Baixa: B1 a B7.
