import { emailsConferem, padraoIlikeLiteral } from '@/lib/email-lookup'
import { consumirLimiteAsync } from '@/lib/rate-limit'
import type { CanalCodigo, EnviarCodigo } from '@/lib/mensageria'
import {
  CODIGO_MAX_TENTATIVAS,
  CODIGO_VALIDADE_MS,
  JANELA_LIMITE_MS,
  RecursoNaoHabilitadoError,
  conferenciaFalsa,
  conferirCodigo,
  emailValido,
  esperarAteMinimo,
  gerarCodigo,
  hashDoCodigo,
  normalizarEmail,
  normalizarTelefone,
  resumo,
  telefoneValido,
  verificarErroDeBanco,
} from './config'
import { emailDeAdministrador, listarPerfis, type ClienteDb, type PerfilVinculado } from './perfis'

export type DepsCodigo = {
  db: ClienteDb
  enviar: EnviarCodigo
  canalDisponivel: (canal: CanalCodigo) => boolean
  agora?: () => number
  /** Atraso mínimo das respostas (ms) para igualar o tempo com e sem conta. */
  atrasoMinimoMs?: number
  jitterMs?: number
}

export const LIMITES_SOLICITAR = { emailIp: 5, ip: 20, destino: 5 } as const
export const LIMITES_CONFIRMAR = { emailIp: 10, ip: 40, email: 30 } as const

export type ResultadoSolicitar =
  | { tipo: 'aceito' }
  | { tipo: 'invalido'; mensagem: string }
  | { tipo: 'limitado'; retryAfterSeconds: number }

export type ResultadoConfirmar =
  | { tipo: 'ok'; email: string; perfis: PerfilVinculado[] }
  | { tipo: 'malformado'; mensagem: string }
  | { tipo: 'invalido' }
  | { tipo: 'admin' }
  | { tipo: 'limitado'; retryAfterSeconds: number }

async function reservar(chaves: Array<[string, number]>) {
  const resultados = await Promise.all(
    chaves.map(([chave, limite]) => consumirLimiteAsync(chave, limite, JANELA_LIMITE_MS, 'FECHADO')),
  )
  const negado = resultados.filter((r) => !r.ok)
  if (negado.length === 0) return null
  return Math.max(1, ...negado.map((r) => r.retryAfterSeconds))
}

async function telefoneCadastrado(db: ClienteDb, email: string, telefone: string) {
  const alvo = normalizarTelefone(telefone)
  for (const tabela of ['CandidaturaEquipe', 'CandidaturaOrganizador']) {
    const { data, error } = await db.from(tabela).select('email,telefone').ilike('email', padraoIlikeLiteral(email)).limit(20)
    if (error) continue
    if (Array.isArray(data) && data.some((l: any) => emailsConferem(email, l.email) && normalizarTelefone(l.telefone) === alvo)) return true
  }
  return false
}

export async function solicitarCodigo(
  deps: DepsCodigo,
  entrada: { email: unknown; canal?: unknown; telefone?: unknown; ip: string },
): Promise<ResultadoSolicitar> {
  const email = normalizarEmail(String(entrada.email ?? ''))
  if (!emailValido(email)) return { tipo: 'invalido', mensagem: 'E-mail inválido.' }
  const canal: CanalCodigo = entrada.canal === 'WHATSAPP' ? 'WHATSAPP' : 'EMAIL'
  if (entrada.canal !== undefined && entrada.canal !== 'EMAIL' && entrada.canal !== 'WHATSAPP') {
    return { tipo: 'invalido', mensagem: 'Canal inválido.' }
  }
  if (canal === 'WHATSAPP' && !telefoneValido(String(entrada.telefone ?? ''))) {
    return { tipo: 'invalido', mensagem: 'Telefone inválido.' }
  }
  if (!deps.canalDisponivel(canal)) throw new RecursoNaoHabilitadoError()

  const destino = canal === 'EMAIL' ? email : normalizarTelefone(entrada.telefone)
  const agora = deps.agora ?? Date.now
  const inicio = Date.now()

  // Reserva ANTES de qualquer consulta ou envio; a contagem é a mesma haja conta ou não.
  const espera = await reservar([
    [`codigo:sol:emailip:${resumo(email)}|${resumo(entrada.ip)}`, LIMITES_SOLICITAR.emailIp],
    [`codigo:sol:ip:${resumo(entrada.ip)}`, LIMITES_SOLICITAR.ip],
    [`codigo:sol:dest:${resumo(`${canal}|${destino}`)}`, LIMITES_SOLICITAR.destino],
  ])
  if (espera !== null) return { tipo: 'limitado', retryAfterSeconds: espera }

  // Por e-mail qualquer endereço recebe código (conta nova entra por onboarding), então não há o que enumerar.
  // Por WhatsApp o código só vai ao telefone já cadastrado para aquele e-mail: sem isso, quem
  // soubesse o e-mail de outra pessoa receberia o código dela no próprio celular.
  const elegivel = canal === 'EMAIL' || (await telefoneCadastrado(deps.db, email, destino))

  const codigo = gerarCodigo()
  const codigoHash = hashDoCodigo(codigo, email)

  if (elegivel) {
    const agoraMs = agora()
    const iso = new Date(agoraMs).toISOString()
    // Um código ativo por e-mail: o novo invalida o anterior.
    const anterior = await deps.db.from('CodigoAcesso').update({ usadoEm: iso }).eq('emailNormalizado', email).is('usadoEm', null)
    verificarErroDeBanco(anterior.error)
    const criado = await deps.db.from('CodigoAcesso').insert({
      emailNormalizado: email,
      canal,
      destino,
      codigoHash,
      criadoEm: iso,
      expiraEm: new Date(agoraMs + CODIGO_VALIDADE_MS).toISOString(),
      tentativas: 0,
      ipHash: resumo(entrada.ip),
    })
    verificarErroDeBanco(criado.error)
    try {
      await deps.enviar({ canal, destino: canal === 'EMAIL' ? email : destino, codigo })
    } catch (err) {
      // Sem destino nem código no log; a resposta continua uniforme.
      console.error('[login-sem-senha] falha ao enviar código', canal, err instanceof Error ? err.name : 'erro')
    }
  }

  await esperarAteMinimo(inicio, deps.atrasoMinimoMs ?? 700, deps.jitterMs ?? 150)
  return { tipo: 'aceito' }
}

export async function confirmarCodigo(
  deps: DepsCodigo,
  entrada: { email: unknown; codigo: unknown; ip: string },
): Promise<ResultadoConfirmar> {
  const email = normalizarEmail(String(entrada.email ?? ''))
  const codigo = String(entrada.codigo ?? '').trim()
  if (!emailValido(email) || !/^\d{6}$/.test(codigo)) {
    return { tipo: 'malformado', mensagem: 'Informe o e-mail e o código de 6 dígitos.' }
  }
  const agora = deps.agora ?? Date.now
  const inicio = Date.now()

  // Reserva ANTES de conferir: rajada paralela não passa do limite.
  const espera = await reservar([
    [`codigo:conf:emailip:${resumo(email)}|${resumo(entrada.ip)}`, LIMITES_CONFIRMAR.emailIp],
    [`codigo:conf:ip:${resumo(entrada.ip)}`, LIMITES_CONFIRMAR.ip],
    [`codigo:conf:email:${resumo(email)}`, LIMITES_CONFIRMAR.email],
  ])
  if (espera !== null) return { tipo: 'limitado', retryAfterSeconds: espera }

  const invalido = async (): Promise<ResultadoConfirmar> => {
    await esperarAteMinimo(inicio, deps.atrasoMinimoMs ?? 400, deps.jitterMs ?? 100)
    return { tipo: 'invalido' }
  }

  const busca = await deps.db
    .from('CodigoAcesso')
    .select('id,codigoHash,expiraEm,tentativas')
    .eq('emailNormalizado', email)
    .is('usadoEm', null)
    .order('criadoEm', { ascending: false })
    .limit(1)
  verificarErroDeBanco(busca.error)
  const linha = Array.isArray(busca.data) && busca.data.length > 0 ? busca.data[0] : null
  const tentativas = Number(linha?.tentativas ?? 0)
  const vigente = Boolean(linha) && new Date(String(linha.expiraEm)).getTime() > agora() && tentativas < CODIGO_MAX_TENTATIVAS
  if (!linha || !vigente) {
    conferenciaFalsa(codigo, email)
    return invalido()
  }

  // Conta a tentativa antes de comparar (compara e troca: duas conferências paralelas não somam menos).
  const contada = await deps.db
    .from('CodigoAcesso')
    .update({ tentativas: tentativas + 1 })
    .eq('id', linha.id)
    .eq('tentativas', tentativas)
    .is('usadoEm', null)
    .select('id')
  verificarErroDeBanco(contada.error)
  if (!Array.isArray(contada.data) || contada.data.length === 0) {
    conferenciaFalsa(codigo, email)
    return invalido()
  }

  if (!conferirCodigo(codigo, email, String(linha.codigoHash))) {
    if (tentativas + 1 >= CODIGO_MAX_TENTATIVAS) {
      const fim = await deps.db.from('CodigoAcesso').update({ usadoEm: new Date(agora()).toISOString() }).eq('id', linha.id).is('usadoEm', null)
      verificarErroDeBanco(fim.error)
    }
    return invalido()
  }

  // Uso único: só quem consegue marcar como usado entra.
  const usado = await deps.db
    .from('CodigoAcesso')
    .update({ usadoEm: new Date(agora()).toISOString() })
    .eq('id', linha.id)
    .is('usadoEm', null)
    .select('id')
  verificarErroDeBanco(usado.error)
  if (!Array.isArray(usado.data) || usado.data.length === 0) return invalido()

  if (await emailDeAdministrador(deps.db, email)) return { tipo: 'admin' }

  return { tipo: 'ok', email, perfis: await listarPerfis(deps.db, email) }
}
