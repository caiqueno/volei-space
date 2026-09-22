# Classificação

**Implementado:** consulta em `src/app/api/classificacao`; recálculo em `src/lib/championship-operations.ts` e migrations de `recalcular_classificacao_liga`. Critérios e pontuação são configuráveis na seção `setup/classificacao`. Verifique a versão efetiva da função SQL no banco.

**Aprovado, pendente:** organizador define pontos do vencedor e do perdedor para **margem de 1 set** e **margem de 2 ou mais sets**. 2×0 e 3×0 compartilham a mesma faixa, e 2×1 usa a outra. O cálculo por placar exato existente não pode retornar fallback silencioso para um resultado que pertença à faixa configurada.

Resultado manual, aprovação histórica, súmula e correção precisam produzir tabela coerente. Classificação de fase de grupos e eliminatórias requer escopo correto; não misturar jogos de campeonatos ou fases. Ver [[modulos/SUMULA-DIGITAL]] e [[06-BANCO-DE-DADOS]].

**Categorias — aprovado, pendente:** cada `CategoriaCampeonato` terá tabela e classificados próprios. Recálculo e consulta pública devem usar `categoriaCampeonatoId` na arquitetura-alvo e jamais somar partidas de outra categoria; o modelo atual por strings pode misturá-las. Ver [[docs/requisitos/CATEGORIAS-COMO-COMPETICOES]].
