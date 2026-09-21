# Mata-mata

**Implementado:** funções em `src/lib/mata-mata.ts` e `src/lib/eliminatorias.ts`; rotas de estrutura e chaveamento em `src/app/api/organizador/ligas/[id]/mata-mata`. A parametrização define formato e fase eliminatória; as validações de capacidade estão em `src/lib/championship-validation.ts`.

A chave usa equipes elegíveis do campeonato, com a quantidade exigida pela fase escolhida. Resultado e classificação de grupos não devem contar indevidamente partidas eliminatórias. Corrigir uma súmula de eliminatória pode exigir recalcular avanço ou sinalizar conflitos com jogos posteriores; verificar esse impacto antes de automatizar.

Relacionados: [[modulos/GRUPOS]], [[modulos/PARTIDAS]], [[modulos/SUMULA-DIGITAL]].
