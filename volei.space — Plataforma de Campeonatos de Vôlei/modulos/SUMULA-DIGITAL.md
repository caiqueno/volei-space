# Súmula digital

**Implementado parcialmente:** página `src/app/sumula/[token]/page.tsx`, API `src/app/api/sumula/[token]/route.ts`, autorização por token em `src/lib/sumula-access.ts`, presenças, sets, ocorrências, scouts e destaques no banco. Não presumir que a validação da tela também está na API.

## Regras aprovadas, pendentes de conformidade

- Sets regulares com alvo `Np` livre; último set com alvo `Nt` separado; todo set requer alvo e dois pontos de diferença, sem teto.
- Melhor de 3 termina em 2×0 somente quando terceiro set não for obrigatório. Quando for, registrar o terceiro com pontuação configurada.
- Oito substituições por equipe e set; retorno vinculado ao par, repetível dentro do limite; restaurar após reload. Líbero somente informativo.
- MVP obrigatório da vencedora antes de oficializar. Sugerir por `attack`, `block`, `ace` **da partida**; desempate por aces, bloqueios, ataques. Escolha manual de atleta da vencedora é permitida.
- Resumo público destaca nome, número, posição e scouts da partida do MVP.
- Link corrige até 30 minutos do primeiro encerramento; depois só organizador autenticado e autorizado. Corrigir atualiza dados derivados e preserva autoria/histórico.
- A gravação final não pode deixar resultado, scouts e classificação parcialmente atualizados.

[Requisito completo](https://github.com/athrios/volei-space/blob/main/docs/requisitos/SUMULA-DIGITAL-E-CLASSIFICACAO.md). Ver [[modulos/PARTIDAS]], [[modulos/CLASSIFICACAO]] e [[12-BUGS-E-DEBITOS-TECNICOS]].
