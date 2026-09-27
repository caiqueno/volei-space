---
title: >-
  UI UX
category: area
tags: [ui]
sources: [repo:athrios/volei-space]
summary: >-
  Interface e experiência.
status: implementado
created: 2026-09-20
updated: 2026-09-27
---
# Interface e experiência

## Princípios do produto

A comunicação da plataforma usa «campeonato» e «organizador», não apresenta volei.space como uma liga própria. Termos `Liga`/`ligaId` ficam no código legado, sem vazarem como explicação do produto.

O painel oferece primeiro acesso, perfil/organização, campeonatos e central de parametrização. O público consulta campeonatos, partidas, classificação e rankings. Fluxos operacionais devem funcionar em telas pequenas, em especial inscrição pelo link e súmula no celular.

## Estados que precisam ser explícitos

Carregando, vazio, erro, rascunho salvo, seção bloqueada, link gerado, inscrição concluída, set em andamento, súmula oficializada e janela de correção. A UI não deve dizer «aprovada manualmente» no fluxo novo de equipe.

**Fonte de estilos atuais:** `src/app/globals.css` e componentes existentes. Não crie uma paleta nova a partir dos arquivos da LUVA. Decisões de fluxo: [[04-FLUXOS]], [[modulos/PARAMETRIZACAO]], [[modulos/INSCRICOES]] e [[modulos/SUMULA-DIGITAL]].

Desde 27/09/2026 as páginas de uso compartilham uma escala: título de página até 2,25rem, título de seção 1,5rem, texto 1,0625rem e rótulo 0,875rem, sem caixa alta forçada no rótulo. O texto visível fala em campeonato e equipe; «liga» não entra na frase da interface.

Na página inicial, «Entre ou Cadastre-se» abre `/login`. «Quero me cadastrar» continua sendo só o aviso de interesse, sem criar conta.

Os campos de e-mail, senha e cadastro nessa tela usam fundo escuro opaco. O fundo translúcido antigo deixava uma faixa clara do navegador, inclusive quando o e-mail vinha preenchido sozinho.

O login único fica em `/login`. Os campos abrem vazios, com «Coloque seu usuário aqui» e «Coloque sua senha aqui». O texto some quando a pessoa clica para digitar. A tela se chama Identificação. Abaixo, o link «Ainda não tem cadastro? Clique aqui e cadastre-se» abre `/cadastro?modo=cadastro`. O cadastro público usa o mesmo painel da identificação. O título é Cadastro. O texto explica que a conta acompanha campeonatos, jogos e tabela, e que a pessoa volta para entrar com esses dados. A senha mostra a regra de 8 caracteres antes do envio, pode ser revelada, e a confirmação avisa na hora se as duas ainda não são iguais. O link «Já tem conta? Entre aqui» volta para `/login`. Ao terminar o cadastro, a pessoa volta para `/login?conta=criada` e não entra automaticamente. A identificação mostra «Conta criada. Entre com o e-mail e a senha que você acabou de definir.» Conta de administrador abre `/admin`. Conta de organizador abre `/painel`. Conta de árbitro e de quadra também abrem `/painel`. Se a senha do organizador ou do árbitro ainda é a recebida, a entrada abre `/trocar-senha` para substituir por uma senha nova. O administrador reseta a senha do organizador em `/admin/acessos`. O organizador cria e reseta a senha do árbitro em `/painel?secao=arbitros`. A conta pública abre `/portal`, e a conta de equipe abre `/capitao`. O endereço antigo `/admin/login` redireciona para `/login`. Na página inicial, o botão do topo é «Entre ou Cadastre-se». Ações que esperam resposta trocam o botão pela barra de carregamento, com o texto da ação. Vale para entrar, criar conta, salvar, enviar, concluir e envio de imagem.
