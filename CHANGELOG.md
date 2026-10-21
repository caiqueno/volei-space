# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/), versionamento [SemVer](https://semver.org/lang/pt-BR/). Linguagem simples, separada em Novidades, Correções e Mudanças importantes.

## [Não publicado]

### Novidades
- Súmula: depois do "+1", aparece uma faixa de 5 segundos "Quem fez?" (Saque, Ataque, Bloqueio) com "Desfazer" visível. O modal de troca mostra "Troca X de N" e o motivo do bloqueio.
- Inscrição: contador fixo de elenco, botão "Concluir" que explica o motivo quando está desabilitado e "Colar lista" (nome e número) com prévia.
- Cadastro: `/cadastro` sem parâmetro pergunta "O que você quer fazer hoje?".
- Placar ao vivo mantém o último placar quando a conexão falha.
- Nova página de placar para telão e transmissão (`/placar/[id]`, com `?fundo=transparente`).
- Alvos de toque de 44 px na súmula, tokens de design e temas claro e de alto contraste.
- Motor de regras do vôlei (módulo puro, ainda não ligado às telas): set, rotação, substituições, líbero, sanções, WO e log de eventos, com testes por ID de regra.

#### Rodadas 9 a 19 (tudo desligado por flag; nada foi publicado nem aberto num navegador)

- **Aplicativo do banco e papeleta (rodada 9):** o banco da equipe abre pelo celular (`/banco/[token]`), monta a papeleta do set com 6 titulares, líbero (até dois) e capitão, envia e a papeleta trava; pede tempo e substituição, e o apontador aceita ou recusa. Flag `BANCO_APP_ATIVO`.
- **Súmula impressa (rodada 9):** página A4 com rodízio ponto a ponto, folha de líbero, protesto e assinaturas (`/sumula/[token]/imprimir`). Ela é pensada para imprimir ou "salvar como PDF" pelo navegador; **ainda não existe um arquivo PDF gerado pelo sistema** nem assinatura digital.
- **Meu Time, fase 2 (rodada 10):** convite ao atleta por link, importação de lista em planilha com prévia antes de gravar, clube com várias equipes, sino de notificações. Flag `MEU_TIME_FASE2_ATIVO` (além de `MEU_TIME_ATIVO`).
- **Convites e importação (rodadas 10 e 13):** o atleta aceita o convite com aviso de LGPD; menores de idade exigem autorização do responsável. A prévia da importação some em 72 horas.
- **Scout e árbitro (rodadas 10 a 13):** existem, mas ficam desligados e fora do escopo por decisão do dono (`SCOUT_ATIVO`).
- **Desafio de vídeo (rodada 11):** o banco pede, o apontador registra e decide (mantida, revertida, cancelada ou inconclusiva). Flag `DESAFIO_ATIVO`.
- **Placar ao vivo (rodada 11):** `/ao-vivo/[partidaId]` em tela cheia, sem dados pessoais, com atualização a cada poucos segundos. Competição privada não aparece. Flag `AO_VIVO_ATIVO`.
- **Súmula que funciona sem internet (rodada 11):** os pontos ficam numa fila no aparelho e sobem quando a conexão volta; aparece "Salvo", "N pendentes", "Sem conexão" ou "Conflito", e o fechamento da súmula espera as pendências. Flags `SUMULA_EVENTOS_ATIVO` e `NEXT_PUBLIC_SUMULA_EVENTOS_ATIVO`.
- **Protótipo e revisões (rodada 12):** protótipo clicável em `/prototipo` (22 telas, 7 perfis) e relatórios de QA, segurança e regras de vôlei, com as correções de código.
- **Segundo líbero, ciência de LGPD e limite de tentativas (rodada 13):** papeleta com dois líberos, convite que exige a ciência do aviso, limite de requisições guardado no banco e rotina de limpeza das prévias (ainda não agendada).
- **Solicitação de inscrição e aprovação (rodada 14):** cada categoria escolhe entre inscrição automática (padrão) ou com aprovação. O líder pede vaga pela aba Campeonatos; o organizador aprova ou recusa na fila de solicitações e o líder recebe o aviso. Flag `INSCRICAO_SOLICITACAO_ATIVO`.
- **Banco pela conta (rodada 14):** líder e banco são o mesmo acesso. A aba Jogos mostra os jogos da equipe e abre o banco sem link. Flag `BANCO_SESSAO_ATIVO`.
- **Inscrição dentro do Meu Time (rodada 15):** os links do organizador viram "porta de entrada" para o Meu Time; quem não tem time cria o time ali e volta para a inscrição. Flag `INSCRICAO_VIA_MEU_TIME_ATIVO`.
- **Login sem senha (rodada 16):** entrar com código por e-mail ou WhatsApp, ou com Google, e trocar de perfil (líder, organizador, banco) na mesma conta. Telas de Início e Perfil no Meu Time. Flags `LOGIN_SEM_SENHA_ATIVO` e `GOOGLE_LOGIN_ATIVO`.
- **Elenco completo (rodada 17):** escudo, foto e documento do atleta enviados com segurança, CPF e telefone guardados cifrados e mostrados mascarados, regras de elenco por categoria com modelos prontos (FIVB, CBV, amador livre) e troca de atleta depois do prazo por pedido aprovado pelo organizador. O CNPJ do time foi retirado do escopo. Flag `ELENCO_COMPLETO_ATIVO`.
- **Painel de inscrições do organizador (rodada 18):** lista com filtros, aprovar, recusar, pôr em análise ou em lista de espera, pedir correção com conversa, aprovar em lote, exportar planilha e equipe do organizador com papéis. Flag `PAINEL_INSCRICOES_ATIVO`.
- **Explorar competições (rodada 18):** vitrine com datas, vagas, prazo, valor e o selo "pode participar / faltam atletas / naipe diferente", calculado no servidor. Flag `EXPLORAR_COMPETICOES_ATIVO`.
- **Notificações por vários canais (rodada 18):** além do sino, e-mail, WhatsApp e push por preferência da pessoa (avisos críticos não desligam), com lembretes de prazo e de jogo por rotina agendada (ainda não agendada). Flag `NOTIFICACOES_MULTICANAL_ATIVO`.
- **Ambiente e documentação (rodada 19):** `supabase/seed.sql` agora roda num banco vazio (1 liga pública, 2 categorias, 6 equipes, 48 jogadores e 6 jogos, tudo inventado); início rápido do `README.md` refeito; inventário de todas as rotas da API em `docs/analise/32-inventario-api.md`, com teste que avisa quando uma rota nova não foi listada; pacote renomeado para `volei-space`.
- **Pagamento por Pix com comprovante (rodada 19):** o organizador define valor e chave Pix por categoria, o líder envia o comprovante, e o organizador confirma, recusa ou isenta; aprovar a inscrição fica bloqueado sem pagamento confirmado. Não há gateway: sem cartão nem Pix automático. Atrás de `PAGAMENTO_COMPROVANTE_ATIVO`.
- **PDF da súmula (rodada 19):** arquivo PDF gerado no servidor (`/api/sumula/[token]/pdf`, botão "Baixar PDF"), atrás de `SUMULA_PDF_ATIVO`. O layout não foi conferido visualmente.

### Correções
- Login: o limite de tentativas é reservado antes de conferir a senha (rajadas em paralelo não passam) e o bloqueio é por e-mail + IP, para que ninguém trave o login de outra pessoa de outro endereço.
- Cadastro de árbitros pelo organizador não sobrescreve mais a conta de um árbitro que já tem cadastro próprio.
- Escritas do organizador exigem cadastro liberado; o link de ativação de conta é de uso único.
- O webhook legado da InfinitePay passa a responder 410. A ativação simulada de pagamento é marcada como "simulado".
- Removida a credencial de administrador de exemplo do `README.md`, do `COMO-TESTAR.txt` e do teste e2e.

### Mudanças importantes
- As sessões e os links de recuperação em circulação deixam de valer ao publicar (chaves por finalidade).
- Migrations da Fase 0 escritas, mas **não aplicadas**: estão em `supabase/pendentes/`.
- Segurança: a senha antiga do administrador de exemplo continua no histórico do git; a conta precisa ser trocada nos ambientes.
- Todas as novidades das rodadas 9 a 19 nascem **desligadas**. Cada módulo tem uma variável de ambiente de servidor e, quando há tela, uma `NEXT_PUBLIC_*`; a lista está em `.env.example` e em `docs/COMO-TESTAR.md`.
- As migrations 0001 a 0053 continuam em `supabase/pendentes/` e **nenhuma rodou num Postgres**. A 0038 não deve ser aplicada. Ensaiar em banco de desenvolvimento ou preview, na ordem do `docs/analise/16-plano-aplicacao-migrations.md`.
- O nome do pacote passou de `luva-platform` para `volei-space`. A versão continua `0.1.0`: ela só sobe quando houver publicação.
