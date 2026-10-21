# Brief para o conselho: volei.space

(Fatos do projeto, sem opinião. Fontes: `founder/idea.md`, `docs/analise/08-validacao-negocio.md`, `docs/analise/31-auditoria-contra-o-prompt.md`.)

## A ideia
- Plataforma SaaS de campeonatos de vôlei de quadra, com súmula eletrônica que valida as regras do jogo (rotação, saque, substituições, líbero, sanções), inscrição de times, papeleta digital, app de banco e placar ao vivo.
- Cliente que paga: o organizador de campeonato amador (liga, arena, professor, dono de quadra, escola, secretaria). O líder do time usa a plataforma, não paga.
- Preço: gratuito no começo. O modelo de cobrança está em aberto (comissão sobre inscrição, mensalidade do organizador, valor por equipe ou por atleta).
- Orçamento: nenhum, além de hospedagem (Vercel e Supabase). Só o tempo do fundador.
- Ainda nenhum campeonato real foi operado; o código foi construído mas não foi testado por pessoas em quadra.

## O que já existe no produto (verificado no código)
- Súmula eletrônica com motor de regras FIVB/CBV, log de eventos imutável e fila offline; impressão em A4 (não gera arquivo PDF).
- Meu Time: cadastro de time e atletas (colar lista, planilha, convite por link), comissão técnica, clube com várias equipes, prontidão do elenco, LGPD de menores.
- Inscrição por categoria: automática ou com aprovação do organizador; competição privada por convite.
- Papeleta digital imutável após o envio, app de banco (pedidos de tempo, troca, desafio), placar ao vivo e overlay para transmissão.
- Isolamento entre organizadores; sem dados pessoais nas páginas públicas.

## O que falta (verificado)
Login sem senha (Google/WhatsApp); foto, documento, CPF e telefone do atleta; regras de elenco com modelos prontos na tela do organizador; painel de inscrições completo (pedir correção, ver documentos, exportar); pedido de troca após o prazo; explorar competições com filtros, valor e selo de elegibilidade; notificações por e-mail, WhatsApp e push; PDF da súmula; pagamento (desligado); testes de usabilidade com pessoas.

## Mercado (do relatório 08, preços de terceiros, baixa a média confiança)
- Alternativas: SporTI (multi-esporte, "Pay" em beta), Copa Fácil (cadastro por link, tabelas, súmula impressa), Sympla e Even3 (inscrição paga, cerca de 10% de comissão segundo terceiros), VolleyStation (usada por FIVB e Superliga, sem preço público), federações estaduais (inscrição por ofício e comprovante de taxa).
- Único dado de taxa de inscrição achado: edital de futebol amador de 2026 com R$ 500 por equipe (outro esporte). Não se achou taxa de vôlei amador.
- Segmentos: organizador independente / liga amadora (paga do bolso ou da taxa dos times), campeonato escolar ou municipal (compra por edital), federação estadual (ciclo anual, processo político).

## Perguntas em aberto
Quanto o organizador pagaria; quantos campeonatos amadores de vôlei de quadra existem na região-alvo; se organizadores aceitam trocar o WhatsApp e a planilha por uma plataforma; se a súmula eletrônica é suficiente para substituir a de papel em jogos oficiais (aceitação de árbitros e federações).
