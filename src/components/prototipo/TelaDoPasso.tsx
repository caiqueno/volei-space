'use client'

import type { ComponentType } from 'react'
import { Moldura } from './Moldura'
import { AbrirConvite, AvisoMenor, PreencherDados } from './TelasAtleta'
import { CadastrarTime, ConvidarAtleta, ImportarPlanilha, Notificacoes } from './TelasLider'
import {
  TelaAoVivo,
  TelaConsulta,
  TelaDesafio,
  TelaFechamento,
  TelaPedidoBanco,
  TelaPlacar,
  TelaRotacao,
  TelaSubstituicao,
} from './TelasApontador'
import { TelaEnviar, TelaPapeleta, TelaPedidos } from './TelasBanco'
import { TelaCompeticao, TelaExportar, TelaSumulas, TelaTabela } from './TelasOrganizador'
import { useProto } from './ProtoContext'

const TELAS: Record<string, ComponentType> = {
  'lider/cadastrar-time': CadastrarTime,
  'lider/convidar': ConvidarAtleta,
  'lider/importar': ImportarPlanilha,
  'lider/notificacoes': Notificacoes,
  'atleta/convite': AbrirConvite,
  'atleta/dados': PreencherDados,
  'atleta/menor': AvisoMenor,
  'apontador/placar': TelaPlacar,
  'apontador/rotacao': TelaRotacao,
  'apontador/substituicao': TelaSubstituicao,
  'apontador/pedido-banco': TelaPedidoBanco,
  'apontador/desafio': TelaDesafio,
  'apontador/fechamento': TelaFechamento,
  'banco/papeleta': TelaPapeleta,
  'banco/enviar': TelaEnviar,
  'banco/pedidos': TelaPedidos,
  'arbitro/consulta': TelaConsulta,
  'organizador/competicao': TelaCompeticao,
  'organizador/tabela': TelaTabela,
  'organizador/sumulas': TelaSumulas,
  'organizador/exportar': TelaExportar,
  'espectador/ao-vivo': TelaAoVivo,
}

export function existeTela(perfil: string, passo: string): boolean {
  return `${perfil}/${passo}` in TELAS
}

export function TelaDoPasso({ perfil, passo }: { perfil: string; passo: string }) {
  const { versao } = useProto()
  const Tela = TELAS[`${perfil}/${passo}`]
  if (!Tela) return null
  return (
    <Moldura perfilId={perfil} passoId={passo}>
      {/* a chave remonta a tela (e seus formulários locais) ao reiniciar */}
      <Tela key={versao} />
    </Moldura>
  )
}
