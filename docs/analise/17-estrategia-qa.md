# 17 - Estratégia de QA do volei.space

Agente: `qa`. Data: 2026-10-16. Somente leitura do repositório; nada foi executado (sem `npm install`, sem build, sem testes, sem banco, sem produção).
Fontes lidas: `COMO-TESTAR.txt`, `scripts/*.test.ts` (13 arquivos), `package.json`, `tsconfig.scripts.json`, `docs/analise/01-diagnostico-volei-space.md` (seções 1.6, 1.7, 4 e 5) e `docs/analise/03-regras-validaveis.md` (IDs `RG-*`).
Limites desta análise: não confirmei, rodando, que os testes atuais passam; as contagens vêm de leitura. Itens marcados "a verificar" dependem do banco real ou de execução.

---

## 1. Inventário dos testes atuais

### 1.1 Situação geral
- Existem **13** arquivos `scripts/*.test.ts` (o diagnóstico 01 diz 12; o 13º é `supabase-env.test.ts`, que não tem script no `package.json`). Nenhum framework: cada arquivo é um script `ts-node` com `assert` no nível do módulo. Um `assert` que falha derruba o arquivo inteiro e os demais casos do arquivo não rodam.
- **Não há `npm test` agregado**, não há CI (`.github` ausente), não há teste de componente, de rota HTTP nem E2E.
- **Três arquivos não estão ligados a nenhum script `test:*`**: `category-selection.test.ts`, `category-setup-state.test.ts` e `supabase-env.test.ts`. O `COMO-TESTAR.txt` não os cita.
- **Defeito encontrado na leitura:** `category-selection.test.ts` e `category-setup-state.test.ts` importam `./category-test-database`, e esse arquivo **não existe em `scripts/`**. Eles não rodam hoje, mesmo com o Docker local `codex-category-test` (porta 55439) citado no diagnóstico. Reportar ao `backend`/`banco-de-dados`: restaurar o helper ou reescrever os testes contra o harness novo (seção 3.4).
- **`COMO-TESTAR.txt` está obsoleto**: descreve o fluxo LUVA (candidatura de equipe, aprovação, pagamento InfinitePay, QR Code), com login `admin@luv.com.br` e senha em texto. Não descreve o fluxo atual (organizador, link de categoria, líder, súmula, classificação). A senha precisa ser removida do arquivo e rotacionada se existir em algum ambiente (risco S3 do diagnóstico).

### 1.2 O que cada teste cobre e o que deixa de fora

| # | Arquivo (script `npm`) | Cobre | Não cobre |
|---|---|---|---|
| 1 | `category-match-rules.test.ts` (`test:categorias`) | `validateCategoryResult` e `validateCategoryProgress`: set de 21 com 2 de diferença, 3º set obrigatório, melhor de 5, quantidade fixa, placar negativo, margem acima do alvo | Regra de decisivo a 15 por padrão do requisito, empate fora do set, vitória por WO (25x0), uso real da função pela API `sumula`, defaults divergentes de `regrasDaPartida` e `getMatchRules` |
| 2 | `category-pricing.test.ts` (`test:categorias`) | Preço por várias categorias, desconto por volume sobre o total do campeonato, cupom, rateio estável, entradas inválidas, duplicadas, NaN | Arredondamento em valores muito grandes, concorrência de cupom, cobrança real (o pagamento é simulado) |
| 3 | `category-replication.test.ts` (`test:categorias`) | Cópia de configuração entre categorias: snapshot, bloqueios por operação, conflito de versão, mesma liga e mesmo organizador, preview não confiável | Rota HTTP de replicação, autorização do chamador, atomicidade no banco |
| 4 | `pricing.test.ts` (`test:pricing`) | Constantes de preço, faixas de desconto (limites 20/21, 40/41, 80/81, 150/151), contagem de partidas por formato | Mesma lacuna de cobrança real |
| 5 | `championship-setup.test.ts` (`test:championship-setup`) | Estado das seções do wizard (bloqueada, não iniciada, concluída), capacidade das eliminatórias, validação de datas e elenco, QR exige foto, agregado ida e volta, navegação mata-mata | Rotas `api/organizador/ligas/[id]/setup/*`, permissão do dono, persistência |
| 6 | `organizer-flow.test.ts` (`test:organizer-flow`) | `resolveLeagueLifecycleStatus` e funções auxiliares **declaradas dentro do próprio teste** (sorteio, contagem de jogos) | Atenção: parte dele testa código copiado no teste, não código do produto. Valor baixo como proteção contra regressão |
| 7 | `team-registration-sync.test.ts` (`test:team-sync`) | `findRepairableStaleRegistrations` | Sincronização real com o banco |
| 8 | `team-registration-draft.test.ts` (`test:registration-draft`) | Janela de inscrição, edição após envio, prazo de elenco; contrato da migration lido como **texto** (regex em `.sql` e em arquivos de rota) | Comportamento real da RPC `finalizar_inscricao_equipe_rascunho`, CPF duplicado, corrida de duas equipes na mesma vaga. Testes por regex em código-fonte quebram com refatoração inofensiva e não pegam bug de lógica |
| 9 | `ponto-sumula.test.ts` (`test:ponto-sumula`) | Formatação e leitura do texto de ponto (saque, bloqueio, ataque), histórico, contagem de origens | Rotação, saque, fechamento de set, qualquer regra de jogo |
| 10 | `simulacao.test.ts` (`test:simulacao`) | Helpers do modo simulação: set encerrado, andamento do placar, pausa, permissão de árbitro (`arbitroPodeOperar`), proteção contra apagar campeonato real | `arbitroPodeOperar` é só a função pura; o guard HTTP real (`requireArbitroPartidaAccess`) não é testado |
| 11 | `supabase-env.test.ts` (sem script) | Leitura de configuração Supabase: produção versus desenvolvimento, bloqueio de URL cruzada | Item bom e importante (impede apontar dev para prod); falta só ligá-lo ao runner |
| 12 | `category-selection.test.ts` (sem script, **quebrado**) | RPC `selecionar_categorias_campeonato` em Postgres local: categoria personalizada, soft-remove, unicidade normalizada, limites | Não roda (helper ausente) |
| 13 | `category-setup-state.test.ts` (sem script, **quebrado**) | RPC `salvar_configuracao_categoria`: invalidação de dependências, versão, reconfirmação | Não roda (helper ausente) |

### 1.3 O que nenhum teste cobre (lista de lacunas, da mais grave para a menos)
1. **Segurança de leitura anônima** (S1, S2, S7 do diagnóstico): `GET /api/jogadores`, `GET /api/equipes[/id]`, consulta de súmula por id numérico.
2. **Isolamento entre organizadores** em escrita e leitura (`organizador-isolamento.ts`, `championship-setup-access.ts`): zero testes.
3. **Autenticação e sessão**: `auth.ts` (JWT, expiração, escopo), `middleware.ts`, rate limit de login (S5, inexistente), troca obrigatória de senha, token de ativação e reset.
4. **Regras da súmula** (hoje só no cliente, `lancar/page.tsx` de 3.594 linhas): rotação, ordem de saque, substituições (limite por set, par entrada e saída, reset por set), líbero, tempos, set decisivo, fim de set e de jogo, WO. Ver IDs `RG-ROT`, `RG-SAQ`, `RG-SUB`, `RG-LIB`, `RG-SET`, `RG-WO` em `03-regras-validaveis.md`.
5. **API da súmula** `api/sumula/[token]`: validação de presença e MVP, atomicidade (hoje delete + insert em 5 tabelas, sem transação), concorrência (dois apontadores), correção pelo organizador (S8).
6. **Classificação**: `recalcular_classificacao_liga` (critérios de desempate, WO, mata-mata) sem nenhum caso.
7. **Webhook de pagamento** (S10): assinatura, idempotência.
8. **Link de inscrição por categoria e convite**: token inválido, vaga cheia, CPF duplicado, janela fechada, líder editando o elenco de outra equipe.
9. **Interface**: nenhum teste de tela, nenhum E2E, nenhuma verificação em celular.

---

## 2. Pirâmide de testes proposta

Princípio: as regras de vôlei e de permissão têm de ser testáveis **sem navegador e sem banco** sempre que possível. Isso depende de extrair o motor de regras da página da súmula (recomendação já feita no diagnóstico 01, seção 7) para um módulo puro compartilhado entre cliente e servidor.

```
            E2E Playwright (poucos, lentos, a jornada inteira)       ~8 cenários
          Integração: banco + RPCs (Postgres local)                  ~40 casos
        API: rotas Next com cliente HTTP, sessão fabricada           ~120 casos
      Unitário: motor de regras, permissões, preço, validação        ~400 casos
```

### 2.1 Camada 1 - Motor de regras (unitário, `src/lib/volei/*`, a criar)
Módulo puro, sem I/O, entrada `(estado, evento) -> estado | erro`. É a camada de maior retorno e a que mais protege a súmula.
- Rotação e saque (`RG-ROT-*`, `RG-SAQ-*`, `RG-POS-*`): sequência de rallies com resultado conhecido, rotação horária só quando a equipe que recebia ganha o ponto.
- Fim de set e de jogo (`RG-SET-*`): 25 com 2 de diferença, decisivo a 15, sem teto; configuração do organizador (21, 3 sets) sobrepõe o padrão.
- Substituições (`RG-SUB-*`): máximo por set, par entrada e saída, reentrada só na posição original, reset a cada set, substituição excepcional.
- Líbero (`RG-LIB-*`): troca fora do rally, posição de bloqueio. **Atenção:** o diagnóstico (seção 6, item 1) aponta divergência entre requisito e código sobre líbero inicial; o teste só vira regra automatizada depois de decisão do arquiteto.
- WO e equipe incompleta (`RG-WO-*`): resultado 3x0 com 25x0 por set.
- Teste baseado em propriedades (fast-check) para: placar nunca negativo, rotação cíclica de 6 posições, soma de pontos igual ao número de rallies.
- Regra do 03: **nenhum teste automatizado de regra marcada [M]** (de memória) sem confirmação.

### 2.2 Camada 2 - Permissões e domínio (unitário)
`organizador-isolamento`, `championship-setup-access`, `arbitro-access`, `sumula-access`, `team-registration-draft`, preço, replicação, ciclo de vida. Já existe base; falta cobrir o que é de **segurança**.

### 2.3 Camada 3 - API (integração de rotas)
Chamar os `route.ts` diretamente (importar `GET`/`POST` e passar um `Request`) com o cliente de dados substituído por um banco de teste. Para cada rota sensível, a matriz fixa é:

| Chamador | Esperado |
| --- | --- |
| Sem sessão | 401 (ou 200 só em rota pública por desenho, com campos públicos apenas) |
| Organizador B em recurso do organizador A | 403 ou 404, **sem vazar** a existência do recurso |
| Organizador dono | 200 |
| Equipe, árbitro e admin | conforme a tabela de papéis (a ser mantida em `docs/`) |
| Token expirado, adulterado, de outro escopo | 401 |
| Corpo inválido (vazio, extremo, tipo errado) | 400 com mensagem, nunca 500 |

### 2.4 Camada 4 - Integração com banco (RPCs e RLS)
Postgres local descartável. Cobre `finalizar_inscricao_equipe_rascunho`, `recalcular_classificacao_liga`, `selecionar_categorias_campeonato`, `salvar_configuracao_categoria`, políticas RLS (anon não lê `Jogador`, `InscricaoEquipeRascunho`). Pré-requisito: baseline de DDL reproduzível, que **não existe hoje** (diagnóstico 01, seção 5). Enquanto não existir, esta camada fica bloqueada e os testes `category-selection`/`category-setup-state` continuam inertes.

### 2.5 Camada 5 - E2E com Playwright
Poucos cenários, sobre ambiente local ou preview com dados de teste (nunca produção, nunca dados reais).

Jornada principal (`e2e/jornada-completa.spec.ts`), um único fluxo encadeado:
1. **Organizador** entra (conta semeada), cria campeonato e uma categoria, confirma as seções do wizard.
2. Gera o **link de inscrição** da categoria e o copia.
3. **Líder** (contexto de navegador separado, sem sessão) abre o link, cadastra a equipe e o elenco com CPFs de teste.
4. Segunda equipe pelo mesmo caminho, para ter duas equipes; o organizador cria a partida.
5. **Árbitro/apontador** abre a súmula pelo link com código, lança pontos até fechar sets e o jogo, escolhe MVP e envia.
6. Organizador **aprova** a súmula.
7. Página pública de **classificação** mostra vitória, pontos e saldo corretos.

Cenários complementares: (a) organizador B não acessa o campeonato do A pela URL direta; (b) link de inscrição com vaga já usada; (c) sessão expirada durante a súmula; (d) duplo clique no envio da súmula não duplica; (e) recarregar a página no meio da súmula; (f) botão voltar do navegador; (g) viewport de celular 390x844 e tablet 820x1180 na jornada de súmula; (h) modo offline simulado (`context.setOffline`) durante o lançamento (hoje não há offline-first, o teste documenta o comportamento atual).

Ferramentas: `@playwright/test`, projetos `chromium` e `mobile-chrome` (Pixel 7) e `mobile-safari` (iPhone 14). Dados criados por um `seed` determinístico e limpos por `globalTeardown`. Seletores por `getByRole`/`data-testid`, nunca por classe CSS.

---

## 3. Padronização dos scripts e runner único

### 3.1 Problema
Os scripts `test:*` e `seed:simulacao` usam `set VAR=valor&& comando`, sintaxe do `cmd.exe`. Em Linux, macOS, Git Bash e CI isso falha ou define variável errada. Cinco comandos repetem a mesma configuração (`TS_NODE_PROJECT`, `TS_NODE_COMPILER_OPTIONS`, `-r tsconfig-paths/register`). `category-selection`, `category-setup-state` e `supabase-env` não têm script. Também falta `engines`/`.nvmrc`.

### 3.2 Decisão recomendada
**Vitest** como runner único (suporta TypeScript, alias de caminho via `vite-tsconfig-paths`, `--watch`, cobertura, mock de módulos, filtro por nome, relatório JUnit para CI). `ts-node` e `tsconfig-paths` saem dos testes. Playwright fica separado (`test:e2e`).

Passagem em duas etapas, para não parar o time:

**Etapa A - ponte sem reescrever (1 dia).** Trocar o executor, manter os arquivos como estão:
- Adicionar `tsx` (executor TypeScript que lê `tsconfig.json` e `paths` sem flags) e usar o runner nativo do Node: `node --import tsx --test "scripts/**/*.test.ts"`. Cada arquivo vira um "teste" que passa se terminar com código 0. Nenhuma sintaxe de shell, funciona em qualquer sistema.
- Scripts resultantes:
  ```json
  "test": "node --import tsx --test \"scripts/**/*.test.ts\"",
  "test:unit": "node --import tsx --test --test-name-pattern=. \"scripts/*.test.ts\"",
  "seed:simulacao": "tsx scripts/recriar-simulacao.ts"
  ```
- Os testes que exigem Postgres local (`category-selection`, `category-setup-state`) ficam fora do `test` padrão e entram em `test:db` até existir o harness.
- Declarar `"engines": { "node": ">=20" }` e criar `.nvmrc`.

**Etapa B - migração gradual para Vitest.** Cada arquivo passa a usar `describe/it` em vez de `assert` solto (um caso falho não esconde os outros). Os nomes de arquivo passam de `scripts/*.test.ts` para `tests/unit/**`, `tests/api/**`, `tests/db/**`, `e2e/**`. Mover um arquivo por vez, sempre com o teste verde antes e depois.

Scripts finais:
```json
"test":        "vitest run --project unit --project api",
"test:unit":   "vitest run --project unit",
"test:api":    "vitest run --project api",
"test:db":     "vitest run --project db",
"test:e2e":    "playwright test",
"test:all":    "npm run test && npm run test:db && npm run test:e2e",
"test:watch":  "vitest"
```

### 3.3 Regras de higiene dos testes
- Nenhum teste lê arquivo-fonte por regex para provar comportamento (`team-registration-draft` faz isso). Trocar por teste da função ou da RPC. Teste de "contrato de migration" só permitido para verificar RLS e `revoke`, e apontando para a lista de tabelas esperadas.
- Nenhum teste reimplementa a regra dentro do arquivo (caso de `organizer-flow`): importa a função de `src/`.
- Variáveis de ambiente de teste vêm de `.env.test` versionado, com **valores locais falsos** (`*.invalid`, chaves de exemplo). Um teste de guarda (`supabase-env`) falha se `NEXT_PUBLIC_SUPABASE_ALVO` for `producao` durante `npm test`.
- Todo teste que fala com banco recusa rodar se a URL não for `localhost`/`127.0.0.1`.
- Todo bug corrigido ganha um teste de regressão com o ID do bug no nome.

### 3.4 Harness de banco (Camada 4)
`docker compose up -d db` com Postgres e o baseline de DDL (a ser criado pelo `banco-de-dados`), `npm run db:reset` aplica baseline + migrations + seed. O helper ausente `scripts/category-test-database.ts` é substituído por `tests/db/helpers.ts` (transação por teste com `rollback` ao final, como já fazem os dois testes quebrados).

### 3.5 CI mínimo (`.github/workflows/qa.yml`)
Em cada pull request: `npm ci`, `lint`, `tsc --noEmit`, `npm test`, `npm run build`. Job separado com Postgres de serviço para `test:db`. E2E em preview, com agendamento noturno. Relatório de falha anexado (traces do Playwright).

---

## 4. Roteiro de teste manual em celular

Aplica-se à súmula, ao link de inscrição e às páginas públicas. Ambiente: preview ou local exposto na rede interna, **com dados de teste**.

**Aparelhos mínimos:** Android com Chrome (tela pequena, ~360 px), iPhone com Safari (inclui o comportamento de barra de endereço e teclado), um tablet (~820 px). Rede: Wi-Fi, 4G e "3G lento" (simulado), e modo avião no meio do teste.

| # | Passo | Esperado |
| --- | --- | --- |
| M1 | Abrir o link de inscrição da categoria recebido por WhatsApp | Carrega em até 3 s no 4G; sem rolagem horizontal; título mostra campeonato e categoria |
| M2 | Preencher o cadastro do líder com teclado aberto | Campos não ficam escondidos pelo teclado; teclado numérico em CPF e telefone; máscara de CPF; botão principal sempre alcançável |
| M3 | Deixar campos vazios e enviar | Mensagem clara por campo, sem perder o que foi digitado |
| M4 | Foto do atleta pela câmera | Abre câmera e galeria; imagem grande é reduzida; falha de upload mostra erro e permite tentar de novo |
| M5 | Adicionar 12 jogadores seguidos | Lista rola; número de camisa repetido é recusado; remover pede confirmação |
| M6 | Duplo toque rápido em "Enviar inscrição" | Uma única inscrição criada |
| M7 | Abrir a súmula pelo link com código do jogo | Pede o código; 5 erros bloqueiam por 15 min com mensagem |
| M8 | Lançar pontos com o aparelho na vertical e na horizontal | Botões de ponto com área de toque de pelo menos 44x44 px; sem toque acidental ao rolar; placar sempre visível |
| M9 | Girar o aparelho no meio do set | Estado preservado, sem reiniciar |
| M10 | Desfazer o último ponto | Placar e saque voltam ao estado anterior, incluindo rotação |
| M11 | Substituição e líbero | Contador de substituições correto; troca inválida é recusada com motivo |
| M12 | Bloquear a tela por 2 min e voltar | Sessão e placar mantidos; se a sessão expirou, aviso claro sem perder o lançamento |
| M13 | Modo avião durante o lançamento, depois reconectar | Documentar o comportamento (hoje não há fila offline): esperado mínimo é aviso visível "sem conexão" e nenhum dado perdido em silêncio |
| M14 | Botão voltar do navegador no meio da súmula | Pede confirmação antes de sair; não descarta o lançamento |
| M15 | Fechar o set e o jogo, escolher MVP, enviar | Resumo conferido antes do envio; envio único; mensagem de sucesso |
| M16 | Abrir classificação e jogo ao vivo no celular | Tabela legível sem zoom (rolagem horizontal contida na tabela, não na página) |
| M17 | Modo escuro do sistema e fonte aumentada | Texto sem corte, contraste legível |
| M18 | Compartilhar o link de inscrição e abrir dentro do navegador do WhatsApp/Instagram | Página funciona (esses navegadores internos têm restrições de câmera e armazenamento) |

Registro de cada execução: aparelho, versão do sistema, navegador, rede, data, resultado e captura de tela das falhas. Falha em M6, M12, M13, M14 e M15 é gravidade alta (perda ou duplicação de dado de jogo).

---

## 5. Critérios de aceite por fase

As fases seguem a ordem de evolução do diagnóstico (seção 7). Se o arquiteto usar outra numeração, os critérios se mantêm por conteúdo.

### Fase 0 - Fundação de qualidade
- `npm test` roda em Windows, Linux e macOS com o mesmo resultado, sem `set`.
- Os 13 arquivos existentes estão ligados ao runner; os dois dependentes de banco estão em `test:db` e passam, ou estão registrados como defeito aberto.
- `COMO-TESTAR.txt` reescrito para o fluxo atual, sem senha, sem fluxo LUVA.
- CI roda lint, tipos, testes e build em todo pull request; falha bloqueia a mesclagem.
- Senha legada do admin removida dos arquivos e rotacionada onde existir (S3).

### Fase 1 - Segurança e isolamento
- Testes de matriz (seção 2.3) para todas as rotas que usam `exigirOrganizadorDa*`, `requireOwnedLigaForSetup` e `requirePublicRole`, **100% passando**.
- Anônimo recebe 401 (ou conjunto reduzido de campos públicos, sem CPF, documento, nascimento, telefone, `qrCodeToken`, `organizadorId`) em `/api/jogadores`, `/api/equipes`, `/api/equipes/[id]` (S1, S2).
- Consulta de súmula por id numérico sequencial deixa de funcionar sem credencial (S7).
- Login com limite de tentativas e teste que o prova (S5).
- Teste que varre todas as rotas `route.ts` e falha se uma rota nova não estiver na lista de "pública por desenho" nem chamar um guard.
- Zero achado de gravidade alta aberto em isolamento.

### Fase 2 - Motor de regras e súmula
- Motor de regras extraído, com cobertura de linhas de pelo menos 90% e todas as regras `RG-*` marcadas [V] ou [G] do 03 cobertas por pelo menos um teste nomeado com o ID.
- Gravação da súmula atômica (uma RPC ou transação), com teste de falha no meio que deixa o estado anterior intacto.
- Versão otimista: dois apontadores gravando o mesmo jogo, o segundo recebe conflito (teste de API).
- Correção pelo organizador dono dentro da janela aprovada, com trilha de autor (S8).
- Classificação recalculada com casos de desempate, WO e mata-mata.
- Jornada E2E principal verde em chromium e em `mobile-chrome`.

### Fase 3 - Inscrição, pagamento e operação
- Link de categoria: token inválido, vaga cheia, janela fechada, CPF duplicado e edição pelo líder, todos com teste de API e de banco.
- Webhook: assinatura inválida rejeitada, ausência de segredo configurado é recusada (não aceita), reentrega idempotente.
- Roteiro manual de celular (seção 4) executado em 2 aparelhos reais sem falha de gravidade alta.
- Teste de carga leve: 20 súmulas simultâneas em preview, sem erro 5xx e com tempo de gravação abaixo de 2 s no percentil 95.

### Fase 4 - Lançamento
- Todos os cenários E2E verdes em chromium, mobile-chrome e mobile-safari.
- Nenhum bug de gravidade alta ou crítica aberto; bugs médios com decisão registrada.
- Teste de recuperação: restauração do banco de teste e reexecução do seed.
- Revisão LGPD dos dados de atletas e menores (S13) concluída e refletida em teste (campos sensíveis ausentes das respostas públicas).

Gravidade usada nos relatórios: **crítica** (vazamento de dado pessoal, perda de dado de jogo, acesso entre organizadores), **alta** (regra de jogo errada, duplicação, bloqueio da jornada), **média** (erro com contorno), **baixa** (visual, texto).

---

## 6. Os 20 primeiros testes a escrever (ordem de risco)

Ordem: segurança e isolamento primeiro, depois as regras da súmula e a integridade do resultado, depois inscrição e classificação. A camada indica onde mora cada teste. Nenhum depende de produção.

| # | Teste | Camada | Prova | Origem |
| --- | --- | --- | --- | --- |
| 1 | `GET /api/jogadores` sem sessão não devolve CPF, documento, nascimento, telefone nem `qrCodeToken` (esperado: 401 ou só campos públicos) | API | Vazamento de dado de atletas, incluindo menores | S1, S13 |
| 2 | `GET /api/equipes` e `/api/equipes/[id]` sem sessão não devolvem `liga.organizadorId`, config, preços nem atletas | API | Vazamento entre campeonatos | S2 |
| 3 | Organizador B recebe 403/404 ao `PATCH/DELETE` em equipe, jogador, partida, galeria e links de categoria do organizador A | API | Isolamento de escrita | 1.7 |
| 4 | Organizador B recebe 403/404 em todas as rotas `organizador/ligas/[id]/setup/*`, `categorias`, `replicar`, `preco`, `pagamento` de liga do A, e a resposta não revela se o recurso existe | API | Isolamento do wizard | `championship-setup-access` |
| 5 | Leitura da súmula por `Partida.id` numérico sem credencial retorna 401/404; com token válido de outro jogo também | API | Enumeração de súmulas | S7 |
| 6 | Login: 6 tentativas erradas seguidas bloqueiam por tempo e a senha certa durante o bloqueio também é recusada; mensagem não diferencia usuário inexistente de senha errada | API | Força bruta | S5 |
| 7 | JWT expirado, com assinatura alterada, com `scope` trocado (`public-user` usado em rota admin) e sem `JWT_SECRET` configurado são recusados; `/admin` sem token redireciona | Unitário + API | Autenticação e escopo | S9, `middleware.ts` |
| 8 | Webhook de pagamento: sem assinatura, com assinatura errada e com segredo vazio no servidor são recusados; mesma notificação duas vezes só confirma uma vez | API | Fraude e duplicidade | S10 |
| 9 | Escrita da súmula (`POST/PUT api/sumula/[token]`) só aceita árbitro escalado ou sessão de link válida; equipe, líder, outro árbitro e anônimo recebem 401/403 | API | Quem altera resultado | `arbitro-access.ts` |
| 10 | Fim de set indoor: 25 com 2 de diferença; 24x24 continua; 26x24 encerra; decisivo a 15 com 2 de diferença; configuração do organizador (21, 3 sets) sobrepõe o padrão; mesmo resultado nos dois caminhos `regrasDaPartida` e `getMatchRules` | Unitário | Regra central, defaults divergentes | RG-SET-*, 01 4.1.4 |
| 11 | Rotação e saque: equipe que recebia e ganha o ponto roda no sentido horário e passa a sacar; quem sacava e ganha mantém o sacador; 6 rotações completas devolvem a formação inicial | Unitário | Estado de quadra | RG-ROT-*, RG-SAQ-* |
| 12 | Substituições: o máximo por set é respeitado no **servidor** (a 7ª ou a 13ª, conforme a regra do organizador, é recusada); reentrada só na posição original e com o mesmo parceiro; contador zera a cada set | Unitário + API | Limite hoje só no cliente | RG-SUB-*, 01 6 item 4 |
| 13 | Gravação da súmula é atômica: falha injetada na 3ª tabela deixa a partida com o estado anterior (sem partida sem sets) e a resposta é erro, não sucesso | Banco/API | Perda de dado de jogo | 01 4.1.5 |
| 14 | Dois apontadores gravam a mesma partida: o segundo, com versão antiga, recebe conflito e nada é sobrescrito | API | Concorrência | 01 4.1.6 |
| 15 | Validação do envio: placar final inconsistente com os sets, jogador fora da relação nominal, MVP de outra equipe, presença vazia e envio duplo (duplo clique) são recusados ou idempotentes | API | Integridade do resultado | RG-FOR-009, RG-FEC-* |
| 16 | WO simples e duplo: resultado 3x0 com parciais 25x0 por set, registro correto na classificação; WO duplo sem vencedor | Unitário + Banco | Resultado administrativo | RG-WO-* |
| 17 | Líbero: troca fora do rally, não saca nem ataca acima da rede, par de bloqueio, não conta como substituição. **Só após decisão do arquiteto** sobre a divergência de líbero inicial | Unitário | Regra com divergência pendente | RG-LIB-*, 01 6 item 1 |
| 18 | Classificação (`recalcular_classificacao_liga`): vitória 3x0 e 3x2 pontuam diferente conforme o regulamento, desempate (vitórias, saldo de sets, saldo de pontos, confronto direto), WO, e que um erro no recálculo **não** fica só em log | Banco | Tabela pública errada | 01 4.1.5 |
| 19 | Link de inscrição por categoria: token inexistente, categoria encerrada, janela fechada e vaga já usada recusam; CPF repetido na mesma categoria é recusado; duas equipes tentando a última vaga ao mesmo tempo, só uma entra | Banco/API | Inscrição e corrida | `finalizar_inscricao_equipe_rascunho` |
| 20 | E2E da jornada principal: organizador -> link -> líder -> inscrição -> súmula -> aprovação -> classificação, com verificação final do placar e dos pontos exibidos na página pública | E2E | A jornada inteira | Seção 2.5 |

Observações sobre a lista:
- Os testes 1 a 9 são os que fecham risco de vazamento ou de alteração indevida e **devem existir antes** de qualquer correção ser dada como concluída; eles começam falhando (ou ficam como `expected failure` documentada) onde o diagnóstico já aponta o defeito, o que serve de critério de aceite para o `backend`.
- Testes 10 a 12 e 16 são puros e baratos, mas dependem de o motor de regras ser extraído (Fase 2). Até lá podem ser escritos contra `category-match-rules.ts` e `ponto-sumula.ts`, que já existem.
- Testes 13, 14, 18 e 19 só rodam depois do harness de banco (3.4).
- Os dois arquivos quebrados (`category-selection`, `category-setup-state`) entram como item 0: restaurar o helper de banco antes de qualquer coisa nova.

---

## 7. O que esta análise não verificou
- Não executei nenhum teste: não sei se os 11 arquivos independentes de banco passam hoje.
- Não abri as rotas `route.ts` nem a página `lancar/page.tsx`; as afirmações sobre elas vêm de `01-diagnostico-volei-space.md`.
- Não validei RLS, RPCs nem políticas de storage (exigem banco).
- Regras de jogo marcadas [M] em `03-regras-validaveis.md` ficam fora da lista de testes automatizados até confirmação.
- Versões de `vitest`, `@playwright/test`, `tsx` e `fast-check` a fixar no momento da instalação (não instalei nada).
