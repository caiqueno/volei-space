# Handoff para o Cursor: branch `cursor-teste`

Estado em 2026-10-16. Tudo está **local**: nada foi enviado ao GitHub e a `main` não foi alterada (ela publica direto em produção na Vercel). Esta branch parte da `main` (c365d8a) e contém o trabalho de segurança, Meu Time, motor de regras, súmula e infraestrutura feito pelos agentes. Veja também `docs/analise/` (relatórios 01 a 24) e `docs/COMO-TESTAR.md`.

## Como rodar
```bash
git checkout cursor-teste
npm run setup        # Node 22, dependências, .env.local, Prisma
# preencha o .env.local com o Supabase de DESENVOLVIMENTO (nunca produção)
npm run dev          # http://localhost:3000
npm run typecheck && npm run test:unit && npm run build
```
Estado verificado por comando: typecheck e build passam. A suíte tem 4 falhas **anteriores a este trabalho** (`category-selection` e `category-setup-state` precisam de `DATABASE_URL`; `rls-publico.test.mjs` e `sumula-transacional.test.ts` falham na `main` pura). `npm run test:unit` para no primeiro erro; para rodar tudo, execute cada arquivo de `scripts/` (`node scripts/with-ts-node.mjs scripts/X.test.ts`).

## O que existe (e o que está desligado)
| Área | Estado | Onde |
|---|---|---|
| Segurança de login/sessão | Ligado: token de admin com `scope`, reset sem hash de senha, limite de tentativas (e-mail+IP), `ADMIN_EMAIL` obrigatório, webhook InfinitePay 410, pagamento marcado `simulado` | `src/lib/auth.ts`, `rate-limit.ts`, `api/auth/**` |
| Leituras públicas sem PII, fim do client anon no servidor, uploads assinados | Ligado no código; **o banco ainda não fecha a anon key** (migrations pendentes) | `src/lib/uploads/**`, `src/app/api/uploads/**`, `anon-client-guard.test.ts` |
| Inscrição automática | Ligado: sem aprovar/rejeitar; PATCH responde 410 | `src/lib/inscricao-status.ts`, `api/inscricoes-campeonato` |
| Meu Time (API + telas) | **Desligado por `MEU_TIME_ATIVO=1`**; precisa das migrations 0024 a 0029 aplicadas | `src/app/api/meu-time/**`, `src/app/meu-time/**` |
| Motor de regras do vôlei | Módulo puro; a tela da súmula já usa para validar/explicar substituição, líbero, sanções e tempos | `src/lib/regras-volei/**`, `src/lib/sumula-ui/**` |
| Eventos da súmula no servidor | **Desligado por `SUMULA_EVENTOS_ATIVO=1`**; precisa de `SumulaEvento` (migrations 0023 e 0029) | `src/app/api/sumula/[token]/eventos` |
| Fila offline da súmula | Biblioteca pronta e testada, **ainda não ligada à tela** | `src/lib/sumula-offline/**` |
| Súmula impressa (A4, salvar como PDF) | Ligado: `/sumula/[token]/imprimir` | `src/components/sumula-impressa/**` |
| Placar de telão/overlay | Ligado: `/placar/[id]?fundo=transparente` | `src/components/placar/**` |
| Migrations | **Nenhuma aplicada.** 29 arquivos em `supabase/pendentes/` com reversão, nunca parseados por um Postgres | `supabase/pendentes/LEIA-ME.md`, `docs/analise/16` e `22` |

## O que o Cursor (ou você) precisa fazer — não dá para fazer sem navegador, conta ou produção
1. **Abrir no navegador, desktop e celular, e conferir:** súmula (+1, faixa "Quem fez?", Desfazer, substituição com contador e motivos, troca de líbero, sanções, tempos), inscrição rápida (contador, "Colar lista", botão desabilitado com motivo), Meu Time (só com a flag e as tabelas), placar de telão, súmula impressa (imprimir em A4), login/recuperação de senha, alvos de toque de 44 px.
2. **Banco (Supabase de desenvolvimento):** rodar as consultas de leitura Q1 a Q13 (`docs/analise/16`), conferir os nomes reais dos CHECKs (`Atleta_origem_check`, `SumulaEvento_tipo_check`), ensaiar as migrations pendentes em preview, gerar a baseline (`docs/analise/22`). **Ordem de publicação:** primeiro o código desta branch, depois as migrations M1 e M2 (fechar leitura pública e bucket privado), fora de rodada e com backup.
3. **Conta/segredos:** trocar a senha do administrador legado (a antiga continua no histórico do git), definir `ADMIN_EMAIL`, conferir `DATABASE_URL`/`DIRECT_URL` na Vercel (a nova validação recusa configuração de outro projeto), rodar o gitleaks no histórico.
4. **GitHub/Vercel:** proteção de branches, secret scanning, Dependabot; a `main` publica direto, então qualquer merge nela exige aprovação.
5. **Decisões de produto abertas:** vôlei de praia entra? foto e documento do atleta bloqueiam a inscrição ou viram pendência? rascunho de inscrição por token (upload sem rota assinada)? itens de regra sem confirmação (WO em melhor de 3, WO duplo, sanções mistas, saque em 0x0 após penalidade entre sets, placar do CJ-03) precisam de um árbitro da COBRAV (`docs/analise/23`).

## Pendências técnicas conhecidas
- Ligar a fila offline e a rota de eventos à tela da súmula; falta endpoint de lote real em produção e a decisão de quando ligar `SUMULA_EVENTOS_ATIVO`.
- A tela da súmula não tem interface para redesignação de líbero (só a função pura).
- Súmula impressa: faltam quadro de pontos com rodízio por ponto, coluna A/P/E/D das sanções, folha de controle de líbero e súmula anexa (dependem de dados que o sistema ainda não registra de forma estruturada).
- `FormularioInscricaoRapida` ainda sobe arquivos direto com a chave anon.
- Servidor ainda tem regra própria de substituição/sanção em `src/lib/sancoes.ts` e `sumula-regras.ts` (limite 8, vermelho = expulsão); precisa revalidar com o motor.
- `npm run lint` roda sem erros (só avisos antigos de `<img>` e hooks).
- Arquivos de teste que conferem texto do código-fonte (`tempos-sumula`, `lesao-sumula`, `libero-sumula`) foram atualizados para a tela nova.

## Regras do projeto
Fluxo: `fix/…`, `feat/…`, `docs/…` → `teste-integrado`/`cursor-teste` → `main`. Inscrição por link de categoria, sem aprovação. Validação sempre no servidor. Isolamento entre organizadores. `CLAUDE.md` e `docs/analise/DECISOES-FASE-0.md` são a referência.
