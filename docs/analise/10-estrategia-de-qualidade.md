# 10 - Estratégia de qualidade (volei.space)

Agente: qa. Data: 2026-10-16. Análise somente por leitura; nada foi executado.

## 0. Base e limites

Li `PROMPT-volei-space.md` (agente 10), `docs/analise/03-regras-validaveis.md`, `package.json` (scripts `test:*`) e os 13 arquivos `scripts/*.test.ts`. Código lido por amostragem (`src/lib/simulacao.ts`, listagem de `src/lib`).

**Não verificado:** se os testes passam hoje; cobertura medida por ferramenta (não há `c8`/`nyc`, os números são estimativas); fluxos de interface, celular, tablet ou API; existência de testes E2E; conteúdo de `COMO-TESTAR.txt` e `ROTEIRO-REVISAO-LOCAL.md`.

## 1. Estado atual dos testes

- 13 arquivos em `scripts/` (~1.000 linhas, ~300 asserções), `node:assert/strict` + `ts-node`, sem framework, sem cobertura, sem teste de componente, banco ou navegador.
- Scripts do `package.json` usam `set VAR=...&&` (cmd do Windows): não rodam em Linux/CI. Primeiro bloqueio para integração contínua.
- 13 arquivos, mas só 8 scripts `test:*`. Sem script: `category-selection`, `category-setup-state`, `supabase-env` (confirmar se rodam em outro lugar).
- Cobrem funções puras de `src/lib`: preço, categorias, cadastro de equipe, setup de campeonato, ponto da súmula, simulação.
- Única lógica de regra de jogo testada: `setEncerrado` e `setsParaVencer` (`src/lib/simulacao.ts`). Não há motor de regras para substituição, líbero, rotação, sanção, tempo, WO ou interrupção.

## 2. Cobertura atual vs. meta

Meta: 100% das regras do `03` com teste automatizado. Regras [M] ficam "pendentes de especialista" e fora do denominador.

| Grupo | Regras | Cobertura estimada | Observação |
|---|---|---|---|
| RG-SET | 8 | ~3 parciais (001, 002, 004) | Falta decisivo 15 pts (003), troca aos 8 (006), intervalos, fechamento |
| RG-PTO | 3 | 0 a 1 | |
| RG-SAQ / POS / ROT | 14 | 0 | Sem motor de rotação |
| RG-SUB | 15 | 0 | Maior divergência do produto (D1, D3) |
| RG-LIB | 14 | 0 | |
| RG-TMP | 9 | 0 | |
| RG-SAN | 12 | 0 | |
| RG-WO / INT / PRO | 17 | 0 | |
| RG-ELE / FOR / FEC | 23 | 0 | |
| RG-PRA | 11 | 0 | |
| **Total** | ~130 | **menos de 3%** | Estimativa por leitura |

Como chegar a 100%:
1. Matriz de rastreabilidade: ID da regra no nome do teste (ex.: `RG-SUB-003`); script lista IDs sem teste e falha a CI se faltar regra de prioridade alta.
2. Adotar Vitest (TS direto, cobertura v8) e migrar os `scripts/*.test.ts` aos poucos.
3. Ordem: prioridade alta, média, baixa (seção 6 do `03`).
4. Parametrizar o limite de substituições (6 e 8) e rodar os testes nos dois modos (D1).

## 3. Pirâmide de testes

| Camada | Proporção | O que testa | Ferramenta | Situação |
|---|---|---|---|---|
| Unitário (motor de regras) | ~60% | Placar, set, rotação, substituição, líbero, sanção, WO, classificação, preço | Vitest, fast-check | Só preço, categoria, cadastro, simulação |
| Integração / API | ~20% | Rotas, permissões, RLS, migrations, isolamento entre organizadores | Vitest + Supabase local | Não existe |
| Componente | ~10% | Formulários, erros, duplo clique, apontador | Testing Library | Não existe |
| Ponta a ponta | ~8% | Fluxo completo em celular e tablet | Playwright | Não existe |
| Exploratório / campo | ~2% | Ginásio real, usabilidade | Roteiro manual | Não existe |

Regra: bug vira teste na camada mais baixa onde aparece.

## 4. Cenários de ginásio

**Pré-requisito crítico:** não há `offline`, `serviceWorker` nem `indexedDB` em `src`. Sem modo offline, estes cenários falham por construção. É preciso decidir o contrato: fila local de eventos, id único por evento (sem duplicar ponto), reconciliação determinística.

| # | Cenário | Esperado | Camada |
|---|---|---|---|
| G1 | Internet cai no meio do set | Placar continua; indicador de "sem conexão"; nada se perde | E2E rede simulada |
| G2 | Internet volta e reenvia | Eventos chegam em ordem, sem duplicar | Integração + E2E |
| G3 | Ponto duplicado (duplo toque/reenvio) | Um ponto só (idempotência) | Unitário + API |
| G4 | Tablet com bateria fraca / app morto | Estado recuperado exatamente | E2E |
| G5 | Tablet trocado no meio do jogo | Estado vem do servidor ou da fila; aviso de eventos pendentes | E2E |
| G6 | Dois apontadores no mesmo jogo | Regra explícita: um mestre por vez ou fusão por ordem de evento; nunca divergência silenciosa | Integração |
| G7 | Conflito real entre apontadores | Conflito mostrado e registrado em log | Integração |
| G8 | Sincronização após horas offline | Súmula consistente; ordem sequencial, não só hora do aparelho | Integração + E2E |
| G9 | Sessão expira durante o jogo | Não perde dados; retoma após novo login | E2E |
| G10 | Rede lenta | Sem botão preso nem toque duplo aceito | E2E |
| G11 | Tela pequena e luz forte | Alvo de toque ≥ 44 px, legível à distância | Manual + Playwright |
| G12 | Desfazer / correção | Reversão auditável; placar e sacador recalculados | Unitário + API |
| G13 | Interrupção de jogo (CJ-06) | Registro; política continuar ou anular set | Unitário |

Aceite: nenhum cenário perde ou duplica ponto; placar final do servidor igual ao do apontador; toda divergência gera aviso visível.

## 5. Teste de usabilidade do cadastro

- 5 a 8 pessoas por perfil (líder de equipe, organizador pequeno), sem treinamento, incluindo quem usa só celular. Dados fictícios, nunca de menores reais (LGPD).
- Tarefas: (1) abrir o link do WhatsApp e cadastrar a equipe; (2) cadastrar 12 jogadores com erro proposital (número repetido, data fora da categoria); (3) fechar o navegador e voltar (rascunho `team-registration-draft`); (4) corrigir um jogador depois; (5) organizador cria campeonato, categoria e envia o link.
- Métricas: conclusão sem ajuda ≥ 80%, tempo por tarefa, erros, hesitações, SEQ 1 a 5.
- Observar: erros em português claro, campos obrigatórios, teclado numérico para camisa, máscaras de CPF/telefone, bloqueio de duplo clique, voltar sem perder dados, aviso de sessão expirada.
- Borda (QA antes): campos vazios; nomes de 1 e 200 caracteres; acentos e emojis; camisa 0, 99, -1, 1.5; data futura; foto enorme ou tipo errado; link usado ou expirado; equipe inscrita duas vezes.

## 6. Fluxo ponta a ponta de referência

Organizador cria campeonato e categoria; líder se inscreve pelo link; partida criada; súmula lançada e aprovada; classificação atualizada. Chrome Android e Safari iPad. Verificar janela de correção de 30 minutos (D6) e que depois só o organizador autenticado corrige.

**Isolamento (toda rodada):** organizador B não lê nem altera campeonato, categoria, equipe, partida ou súmula de A, nem por URL nem por API direta. Cobrir link de convite de uma categoria usado em outra.

## 7. Testes a criar

### 7.1 Motor de regras (alta prioridade)
- `set-regras.test.ts`: RG-SET-001/002/003/004/006 (25x23 acaba, 25x24 não, 26x24 acaba, 30x28 acaba; decisivo 15x14 continua, 16x14 e 17x15 acabam; melhor de 1/3/5; troca aos 8; valores extremos).
- `rotacao-saque.test.ts`: RG-SAQ-001/002, RG-ROT-001..004, RG-POS-003 (rotação horária; falta de rotação com cancelamento de pontos, CJ-03).
- `substituicao.test.ts`: RG-SUB-001/003/004/009/011/012/014, D1, D3, D4, D5 (limites 6 e 8; 7ª ilegal; repetição do par; excepcional CJ-01 fora do contador; reinício por set).
- `libero.test.ts`: RG-LIB-003/005/009/010/011/012, D7 (só fundo; redesignação CJ-02; troca ilegal CJ-08).
- `sancoes-tempos.test.ts`: RG-SAN-002..008/012, RG-TMP-001/007/008, CJ-04.
- `wo-interrupcao.test.ts`: RG-WO-001/002/005, RG-INT-003..005, D9, CJ-06, CJ-10.
- `fechamento-sumula.test.ts`: RG-FEC-002/004, RG-SET-008 (D12).
- `praia.test.ts`: RG-PRA-001..009.

Itens [M] (RG-SAN-010, RG-PRO-004, tolerância de WO, placar de WO em melhor de 3) ficam fora até confirmação por especialista.

### 7.2 Classificação e partidas
`classificacao.test.ts` (D9, desempate, WO duplo, equipe incompleta, MVP D11). Conferir testes para `mata-mata.ts` e `eliminatorias.ts` (sem arquivo de teste visto).

### 7.3 API e banco
`isolamento-organizadores`, `rls-policies`, `link-convite`, `sumula-janela-correcao`, `idempotencia-eventos`, `concorrencia-apontadores`.

### 7.4 Interface e E2E (Playwright)
`e2e-fluxo-completo`, `e2e-cadastro-bordas`, `e2e-ginasio-offline`. Viewports 360x640, 768x1024, 1024x768.

### 7.5 Infra de teste (primeiro)
1. Trocar `set VAR=...&&` por `cross-env` ou Vitest.
2. Um único `npm test` para tudo.
3. Relatório de cobertura e verificador de IDs sem teste.
4. Dados de teste isolados (`massa-qa.ts`) e `reset-db` documentado.

## 8. Riscos já visíveis

| Gravidade | Item |
|---|---|
| Alta | Sem motor de regras de substituição, líbero, rotação, sanção, tempo, WO e interrupção em `src/lib` |
| Alta | Sem indício de suporte offline; G1 a G8 dependem disso |
| Alta | Produto diverge da FIVB (D1: 8 substituições; D3: repetição do par); súmula inválida em competição CBV/FIVB |
| Média | Scripts `test:*` não rodam fora do Windows (impede CI) |
| Média | 3 arquivos de teste sem script no `package.json` |
| Média | Lacunas D4, D5, D9, D12, D13 sem definição |
| Baixa | Itens [M] do `03` dependem de confirmação humana |

## 9. Ordem de execução

1. Infra de teste e Vitest com cobertura.
2. `set-regras` e `rotacao-saque`.
3. Isolamento entre organizadores e RLS.
4. Substituição, líbero, sanções, WO, interrupção conforme o backend implementar.
5. Playwright: fluxo completo e cadastro.
6. Cenários de ginásio, após decisão sobre offline.
7. Usabilidade com pessoas, com o cadastro estável.
