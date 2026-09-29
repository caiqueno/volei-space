# Validação da fundação de categorias

## Ambiente e execução

O harness `scripts/category-test-database.ts` usa exclusivamente o container
`codex-category-test`, identificado pela label `purpose=category-integration-test`,
porta publicada `127.0.0.1:55439` e banco `category_test`. Confere essas condições
antes de cada operação SQL. Não lê `.env` nem aceita URL externa. Não altera os
outros containers e não apaga ou reinicializa automaticamente o banco.

O baseline é gerado do schema Prisma da `main`, em diretório temporário fora do
repositório, e complementado pelas migrations SQL legadas explicitadas no harness.
É uma base sintética: não constitui reprodução ou certificação do banco remoto.

Em PowerShell, com Node, dependências locais e Docker disponíveis:

```powershell
docker run --name codex-category-test --label purpose=category-integration-test -e POSTGRES_DB=category_test -e POSTGRES_USER=category_test -e POSTGRES_PASSWORD=category_test_local_only -p 127.0.0.1:55439:5432 -d postgres:17
$env:TS_NODE_COMPILER_OPTIONS='{"module":"CommonJS","esModuleInterop":true}'
node node_modules/ts-node/dist/bin.js scripts/category-test-database.ts
node node_modules/ts-node/dist/bin.js scripts/category-database.test.ts --apply
```

A senha acima é exclusivamente uma credencial descartável do ambiente sintético.
O primeiro comando de preparação exige banco vazio. Para repetir somente testes,
omitir `--apply`. Se 001 já estiver aplicada e 002 tiver sido revertida por erro,
usar `--apply-after-foundation` após corrigir a causa. Não repetir migrations já
confirmadas por tentativa cega.

## Matriz implementada no teste de banco

| Cenário | Camada | Preparação | Resultado esperado | Risco | Tipo |
| --- | --- | --- | --- | --- | --- |
| Configuração única | PostgreSQL | Segunda configuração da mesma categoria | Violação de unicidade | Configuração duplicada | Integração SQL |
| Campeonato divergente | PostgreSQL | Configuração aponta outra Liga | FK rejeita | Mistura de campeonatos | Integração SQL |
| Margem fixa | PostgreSQL | Diferença mínima 1 | CHECK rejeita | Regra esportiva incorreta | Integração SQL |
| Série legada | PostgreSQL | INSERT OURO e UPDATE PRATA | Trigger rejeita | Escrita silenciosa legada | Integração SQL |
| Categoria imutável | PostgreSQL | Alterar categoria de equipe | Trigger rejeita | Mudança operacional indevida | Integração SQL |
| Grupo e equipe | PostgreSQL | Equipe ou grupo de outra categoria | FK composta rejeita | Grupo misturado | Integração SQL |
| Partida e adversários | PostgreSQL | Adversário de outra categoria | FK composta rejeita | Confronto misturado | Integração SQL |
| Autoconfronto/vencedor | PostgreSQL | Mesmo adversário ou terceiro vencedor | CHECK rejeita | Resultado inválido | Integração SQL |
| Grupo da partida | PostgreSQL | Grupo de outra categoria | FK composta rejeita | Estrutura misturada | Integração SQL |
| Classificação e eliminatória | PostgreSQL | Equipe externa à categoria | FK composta rejeita | Classificação contaminada | Integração SQL |
| Exclusão operacional | PostgreSQL | Excluir categoria com dependentes | FK rejeita | Perda de histórico | Integração SQL |
| Posse da seleção | RPC | Organizador diferente | Exceção e nenhuma mudança | Acesso entre organizadores | Integração SQL |
| Configuração privada | Grants | Verificar anon SELECT/INSERT | Sem permissão | Exposição indevida | Integração SQL |
| Atomicidade | PostgreSQL | Escritas recusadas e rollback da fixture | Estado original; nenhuma Liga da fixture | Persistência parcial | Integração SQL |

## Gates de liberação (evidências e pendências abaixo)

- Ensaiar backfill com dados legados inequívocos e ambíguos, confrontos misturados,
  grupos vazios, sobreposição de séries e pontuação por margem conflitante.
- Conferir versões/conteúdo das migrations com o ledger do ambiente de destino;
  não executar este harness contra ele.
- Exercitar APIs com organizadores diferentes, tokens de formulários, grupos,
  classificação, súmula e consultas públicas. Grants não substituem teste HTTP.
- Exercitar concorrência real de autosave, replicação e criação operacional:
  versões e locks devem ser compartilhados por todos os escritores.
- Verificar finalização atômica/idempotente do formulário e limites de edição.
- Verificar preço agregado, ativação única e arredondamento, sem alterar cupons.
- Typecheck/build e testes de domínio; navegador para erro do wizard, troca rápida
  de categoria, persistência do rascunho e ausência de série nas interfaces.
- Só remover campos legados depois que todos os leitores e escritores tiverem
  migrado. Deploy intermediário não implica ativação automática do novo fluxo.

Os resultados efetivamente executados devem ser reportados separadamente desta
matriz. A existência do teste não indica aprovação de todas as camadas.

## Evidências obtidas em 22/09/2026

- PostgreSQL 17 isolado: fundação 001/002/003 aplicada; testes reais de FKs,
  bloqueio de série, categoria imutável, seleção autorizada, recálculo de duas
  categorias, incremento de versões, grants privados e rollback aprovados.
- O ensaio revelou colisão de alias PL/pgSQL e acesso direto a coluna histórica
  ausente no baseline; ambos corrigidos na migration 002 antes da aprovação.
- SQL das funcionalidades 230001 a 230005 aplicado no ambiente sintético.
  Aplicar DDL não comprova todos os caminhos internos dos RPCs.
- `category-match-rules.test.ts` aprovado: alvos configurados, vantagem de dois,
  deuce, melhor de três/cinco, terceiro obrigatório, empate, pontos negativos,
  sets adicionais e incompletos.
- `category-rpc.test.ts` exercita escrita versionada, conflito desatualizado,
  cópia/idempotência, rollback e finalização de formulário. O primeiro ensaio
  encontrou defaults SQL ausentes em tabelas antigas criadas pelo Prisma; o
  reparo está na migration nova de cadastro, sem editar a migration histórica.
- Após o reparo, `category-rpc.test.ts` aprovado: conflitos de versão não
  sobrescrevem dados, replay não duplica auditoria, gerar formulário não cria
  equipe, e duas finalizações produzem uma equipe/inscrição sem série.

O adaptador de navegador é exclusivamente local: PostgREST em 55440, proxy em
55441 e fixture de campeonato 93001. `category-test-browser-proxy.ts` exporta
variáveis sintéticas para o processo Next, sem modificar arquivos `.env`.

## Validação final complementar

- Calendário SQL230006 aprovado: IDs de outra categoria e revisão desatualizada
  rejeitados; lote cuja segunda alteração tem árbitro não aprovado reverte a
  primeira alteração e a revisão; troca de mandante e árbitro aprovado persistem.
- Triggers diferidos de cadastro exercitados com `SET CONSTRAINTS ALL IMMEDIATE`:
  finalização válida aceita; troca para equipe incompatível com a inscrição e
  vínculo de jogador de outra equipe rejeitados.
- Gate de pontuação da migration002 exercitado em transações revertidas: fórmula
  desconhecida e fallback alterado rejeitados; fallback verificado ou mapeamento
  explícito aceitos. Esse teste verifica o gate extraído, não um novo backfill
  integral de todos os dados históricos.
- Estado das seções aprovado: concluir cinco, alterar capacidade, invalidar quatro
  dependentes, reconfirmar sem aumentar versão e voltar a categoria concluída.
- Evidência de navegador fornecida pelo orquestrador, fixture93001: informações
  concluídas; autosave de Feminino com quatro equipes/dois grupos; Misto preservado
  vazio; retorno a Feminino conserva valores; origem não salva é recusada na cópia;
  preview exibe três diferenças; confirmação solicita revisão do destino. Nenhuma
  série exibida nesses fluxos.
- Concorrência real aprovada em duas sessões PostgreSQL: dois autosaves com a mesma
  versão resultam em um sucesso e um conflito; operação que adquire o lock antes
  da replicação faz a cópia recusar o snapshot antigo sem alterar configuração ou
  gravar auditoria parcial. A fixture própria de concorrência fica no banco local
  para inspeção e não modifica o campeonato do navegador.
- Proteção de atleta aprovada: tentativa de mudar `Jogador.equipeId` para equipe
  de outra categoria recebe erro e preserva o vínculo original.

## Verificação consolidada do orquestrador

- Build Next.js final aprovado: compilação, lint, tipos e 68 páginas geradas. Processo usou exclusivamente variáveis sintéticas; nenhum `.env` foi alterado.
- Testes de domínio aprovados novamente após os ajustes finais: parametrização, formulário, preço agregado, replicação e regras das partidas.
- HTTP local aprovado com registros de duas categorias: classificação, rankings, jogos e equipes recusam escopo ausente, inválido, cruzado e série legada; resultados não se misturam e não expõem tokens/CPF/telefone nessas projeções.
- Setup e replicação recusam usuário anônimo ou organizador diferente; consultas administrativas de partidas/jogadores exigem autenticação. Os grants da fixture não representam auditoria de RLS em produção.
- Nenhuma implantação ou migration em produção foi realizada. Antes de liberar, permanece necessário conferir o ledger do destino e ensaiar o backfill completo com uma cópia sanitizada dos dados históricos, incluindo ambiguidades.
- Os três conjuntos são dependentes e destinados à revisão; não implantar um snapshot intermediário separadamente.
