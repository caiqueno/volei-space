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
