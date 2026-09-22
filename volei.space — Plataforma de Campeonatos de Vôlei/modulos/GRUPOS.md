# Grupos

**Implementado:** configuração de quantidade e regras em `setup/estrutura`; distribuição real de equipes e confrontos em `src/app/api/organizador/ligas/[id]/estrutura/route.ts`; migrations de grupos em `supabase/migrations`.

A definição de grupos do campeonato não se confunde com o convite de equipe por categoria. Convites não devem entrar na distribuição competitiva até o cadastro da equipe estar concluído. Quantidade de classificados deve ser compatível com a fase eliminatória configurada.

Para apresentação pública e classificação, preserve o campeonato, categoria e fase corretos. Ver [[modulos/PARAMETRIZACAO]], [[modulos/INSCRICOES]], [[modulos/MATA-MATA]].

**Aprovado, pendente:** cada grupo e seus classificados pertencem a uma única `CategoriaCampeonato`, por `categoriaCampeonatoId` na arquitetura-alvo. A geração não pode incluir equipes de outra categoria. O escopo atual baseado em strings pode misturar categorias e exige migração. Ver [[docs/requisitos/CATEGORIAS-COMO-COMPETICOES]].
