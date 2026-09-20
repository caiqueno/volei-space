# Requisito aprovado: súmula digital e classificação

**Estado:** decisões de produto aprovadas; implementação pendente. As regras abaixo são o comportamento desejado, não uma descrição do estado atual do código.

## Parametrização dos sets

- O organizador escolhe livremente o alvo de pontos dos sets regulares (`Np`). Exemplos frequentes como 15, 21 e 25 não restringem a escolha.
- A pontuação do último set ou tie-break (`Nt`) é uma variável separada. Em melhor de 3, a parametrização pergunta se o terceiro set é obrigatório; se for, pergunta a pontuação desse set.
- Um set só termina quando uma equipe atinge **pelo menos** o alvo configurado e abre **ao menos dois pontos** de vantagem. Não há limite máximo de pontos. Com alvo 21: 21×19 encerra; 21×20 continua; 22×20 encerra.
- A quantidade de sets necessária para vencer deriva da configuração «melhor de N sets». Em melhor de 3, 2×0 encerra a partida se o terceiro set for opcional. Se for obrigatório, disputa-se o terceiro set mesmo após 2×0, permitindo placares finais 3×0 e 2×1.
- A interface e a API devem seguir a mesma regra. O envio oficial rejeita set incompleto, ausente, fora de sequência, adicional indevido ou resultado sem vencedor.

## Pontos da classificação

O organizador configura **pontos do vencedor e do perdedor** por margem de resultado:

| Margem de sets | Exemplos | Pontuação |
| --- | --- | --- |
| 1 set | 2×1, 3×2 | Par de pontos configurado para margem 1 |
| 2 ou mais sets | 2×0, 3×0, 3×1 | Par de pontos configurado para margem 2 ou mais |

Assim, 3×0 recebe a mesma pontuação de classificação de 2×0. O recálculo deve usar a configuração do campeonato e não cair silenciosamente em valores históricos por não encontrar o placar exato.

## Substituições e líbero

- Cada equipe tem direito a **8 substituições por set**. Toda entrada e todo retorno contam como uma substituição; a nona é bloqueada.
- O vínculo do par dura o set: A → B permite reversão B → A; o mesmo par pode fazer A → B novamente, respeitando o limite. Um terceiro atleta não substitui a reversão daquele par.
- No início do set seguinte, vínculos e contagem reiniciam. O reload não pode apagar o controle do set em andamento.
- A entrada de líbero é somente **registro informativo**: não consome uma das 8 substituições, não cria par e não altera o controle da escalação. Líbero inicial não é requisito para confirmar a escalação.

## MVP e exibição pública

- Antes da oficialização, a súmula exige **um MVP da equipe vencedora**. O sistema não pode enviar automaticamente a súmula antes dessa escolha.
- A sugestão considera somente scouts da partida e somente atletas da vencedora. O maior total de pontos de `attack`, `block` e `ace` é sugerido; empate é desfeito por aces, depois bloqueios, depois ataques.
- O responsável pode escolher manualmente outro atleta da vencedora. Se não houver scouts, a escolha é manual. A API valida existência, unicidade e equipe do MVP.
- No resumo público da partida, destacar o MVP escolhido com **nome, número, posição, ataques, bloqueios, aces e total de pontos da própria partida**. Posição ausente aparece como “Não informada”. Scouts acumulados do campeonato não entram nesse cartão.

## Correções após encerramento

- Quem tem o link da súmula pode corrigir por **30 minutos a partir do primeiro encerramento oficial**. A edição não renova esse prazo.
- Passados os 30 minutos, somente o organizador responsável pelo campeonato, autenticado e autorizado no servidor, pode corrigir.
- Correções em sets, resultado, scouts, ocorrências ou MVP atualizam vencedor, classificação, rankings e resumo público. Registrar autoria, horário e alterações, e tratar edições simultâneas/desatualizadas.
- A persistência de partida, sets, presenças, ocorrências e destaques deve ser atômica: falha parcial não pode deixar resultado e classificação incoerentes.

## Cenários essenciais de aceitação

1. Alvo 21: 21×19 e 22×20 encerram, 21×20 não.
2. Melhor de 3: 2×0 termina sem terceiro obrigatório; com terceiro obrigatório exige set 3 e aceita 3×0 ou 2×1.
3. Envio direto pela API com set insuficiente, quantidade incorreta ou MVP inválido é recusado.
4. Pontos de vencedor e perdedor: 2×0 e 3×0 usam a mesma faixa; 2×1 usa a faixa de 1 set.
5. Oitava substituição permitida, nona bloqueada; vínculo do par preservado após reload; novo set reinicia o controle. Líbero informativo não consome cota.
6. Sugestão de MVP usa scouts da partida; escolha manual válida; resumo público mostra os dados e os scouts do MVP.
7. Correção pelo link funciona nos primeiros 30 minutos e falha depois; organizador autorizado corrige após o prazo; resultados derivados refletem a correção.

## Fontes para implementação

Conferir `src/app/sumula/[token]/page.tsx`, `src/app/api/sumula/[token]/route.ts`, `src/lib/sumula-access.ts`, `src/lib/player-scouts.ts`, rotas de parametrização, a consulta pública da partida e as migrations SQL de classificação. O sistema está em validação: migrações de registros passados são aceitáveis, mas devem ser explícitas e verificadas.
