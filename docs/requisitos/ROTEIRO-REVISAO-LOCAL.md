# Revisão local — 23/09/2026

## Acesso

Servidor: http://127.0.0.1:3005. Docker, PostgREST e adaptador de login usam exclusivamente dados sintéticos.

- [Entrar como organizador fictício e revisar parametrização](http://127.0.0.1:55441/__test_login?next=http://127.0.0.1:3005/painel/parametrizacao?ligaId=93001).
- [Central de inscrições preparada](http://127.0.0.1:3005/painel/parametrizacao?ligaId=15&categoriaCampeonatoId=290e862a-324f-406d-bc45-3b00da28e127) — abrir depois do login acima.
- [Inscrição já concluída no teste de navegador](http://127.0.0.1:3005/inscricao-rapida/0c5ebe25-4877-45c7-a042-fdb646f68a7c).

O login local dura oito horas; abrir novamente o primeiro link renova a sessão enquanto o adaptador estiver ativo. Estes links só funcionam neste computador, com os processos locais ativos.

## Revisar um fluxo por vez

1. **Categorias e autosave:** na liga 93001, selecione Feminino e abra Estrutura. Altere a quantidade de equipes, troque para Misto e volte. O valor deve persistir apenas na origem. Após a verificação desta execução, ambas começaram com seis equipes porque houve cópia explícita.
2. **Replicação:** clique em Replicar configuração, selecione Misto e escolha substituir as seções selecionadas. Compare os valores antes de confirmar. O destino deve indicar que a cópia precisa de revisão.
3. **Preço:** observe o investimento por categoria, o subtotal e a ativação única. A estimativa deve acompanhar a estrutura selecionada.
4. **Novo formulário:** na central de inscrições da liga 15, use Gerar formulário e Copiar link. Abra o link em outra aba. O formulário deve começar sem nome de equipe e sem jogadores.
5. **Cadastro:** informe equipe e responsável fictícios. Adicione um jogador fictício, salve, recarregue e confira a persistência. Conclua e espere a mensagem Cadastro concluído. Reabrir o link deve mostrar a conclusão.
6. **Isolamento:** volte à central da liga 15 e selecione Misto. Os formulários do Feminino não devem aparecer nessa categoria.

Na liga 15, foto, nascimento e documento foram configurados como opcionais para facilitar a revisão manual. As categorias foram preconfiguradas pelo script de fixture, inclusive o status concluído; isso não representa validação do wizard completo. Os defaults obrigatórios com configuração vazia foram exercitados separadamente no teste SQL.

## Evidências desta execução

- Build aprovado: compilação, lint, tipos e 68 páginas.
- Cinco testes de domínio aprovados: parametrização, rascunho de inscrição, preço por categoria, replicação e regras de partida.
- RPCs aprovados: versão, cópia, replay, conflitos, integridade dos vínculos e finalização sequencial.
- Novo teste de finalização aprovado: foto/nascimento/documento ausentes e documento em branco rejeitados, sem registros parciais; duas sessões PostgreSQL com espera de lock comprovada retornam a mesma equipe/inscrição e persistem exatamente um jogador.
- Limpeza do novo teste corrigida para excluir dependências explicitamente. As ligas 7, 8 e 9 deixadas pelas tentativas desta execução foram removidas; residual zero.
- HTTP aprovado: classificação, rankings, partidas e equipes isolados por categoria; escopos inválidos e acessos não autorizados rejeitados; campos privados ausentes nas projeções testadas.
- Gate de backfill aprovado com as fixtures HTTP presentes, sem colisão de IDs. Esse teste usa o gate extraído, não o backfill histórico integral.
- Navegador: alteração Feminino de quatro para seis equipes, Misto permanecendo com quatro, retorno com seis persistido; comparação e cópia para Misto confirmadas; equipe e atleta salvos e inscrição concluída pela interface.

Somente a função de finalização foi reaplicada no container sintético para testar o ajuste SQL. Nenhum commit, push, merge ou alteração em produção nesta execução. O ensaio integral das migrations e do backfill com dados históricos sanitizados continua pendente antes da liberação.
