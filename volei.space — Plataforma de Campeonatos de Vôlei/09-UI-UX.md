# Interface e experiência

## Princípios do produto

A comunicação da plataforma usa «campeonato» e «organizador», não apresenta volei.space como uma liga própria. Termos `Liga`/`ligaId` ficam no código legado, sem vazarem como explicação do produto.

O painel oferece primeiro acesso, perfil/organização, campeonatos e central de parametrização. O público consulta campeonatos, partidas, classificação e rankings. Fluxos operacionais devem funcionar em telas pequenas, em especial inscrição pelo link e súmula no celular.

## Estados que precisam ser explícitos

Carregando, vazio, erro, rascunho salvo, seção bloqueada, link gerado, inscrição concluída, set em andamento, súmula oficializada e janela de correção. A UI não deve dizer «aprovada manualmente» no fluxo novo de equipe.

**Fonte de estilos atuais:** `src/app/globals.css` e componentes existentes. Não crie uma paleta nova a partir dos arquivos da LUVA. Decisões de fluxo: [[04-FLUXOS]], [[modulos/PARAMETRIZACAO]], [[modulos/INSCRICOES]] e [[modulos/SUMULA-DIGITAL]].
