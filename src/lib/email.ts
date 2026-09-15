import nodemailer from 'nodemailer'

interface EmailOptions {
  to: string
  subject: string
  html: string
}

function getTransporter() {
  const port = Number(process.env.SMTP_PORT || 587)

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port,
    secure: port === 465,
    auth: process.env.SMTP_USER && process.env.SMTP_PASS
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        }
      : undefined,
  })
}

export async function sendEmail({ to, subject, html }: EmailOptions) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn(`SMTP não configurado. E-mail não enviado para ${to}: ${subject}`)
    return
  }

  const transporter = getTransporter()
  await transporter.sendMail({
    from: process.env.EMAIL_FROM || `"volei.space" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
  })
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function button(label: string, href: string, variant: 'primary' | 'dark' = 'primary') {
  const background = variant === 'primary' ? '#ffb331' : '#0b1628'
  const color = '#ffffff'

  return `
    <a href="${href}" style="display:inline-block;background:${background};color:${color};padding:14px 22px;border-radius:14px;text-decoration:none;font-weight:900;margin:18px 0">
      ${label}
    </a>
  `
}

function layout(title: string, preheader: string, body: string) {
  return `
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>${title}</title>
      </head>
      <body style="margin:0;background:#eef3f8;padding:28px;font-family:Arial,Helvetica,sans-serif;color:#102033">
        <span style="display:none;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden">${preheader}</span>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;margin:0 auto">
          <tr>
            <td style="padding:0">
              <div style="background:#071426;border-radius:28px 28px 0 0;padding:28px 28px 24px;border:1px solid rgba(255,255,255,0.10)">
                <p style="margin:0 0 12px;color:#ffb331;font-size:12px;font-weight:900;letter-spacing:3px;text-transform:uppercase">volei.space</p>
                <h1 style="margin:0;color:#ffffff;font-size:32px;line-height:1.08;font-weight:900">${title}</h1>
              </div>
              <div style="background:#ffffff;border-radius:0 0 28px 28px;padding:30px 28px;border:1px solid #dbe4ef;border-top:0;box-shadow:0 22px 70px rgba(8,17,31,0.10)">
                ${body}
                <hr style="border:0;border-top:1px solid #e5edf5;margin:28px 0" />
                <p style="margin:0;color:#6b7a90;font-size:13px;line-height:1.6">
                  Este e-mail foi enviado automaticamente pela plataforma oficial da volei.space.
                </p>
              </div>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `
}

export function emailCadastroRecebido(nome: string, tipo: string): string {
  const nomeSeguro = escapeHtml(nome)
  const tipoSeguro = escapeHtml(tipo)
  return layout(
    'Cadastro recebido',
    'Recebemos seu cadastro na volei.space.',
    `
      <p style="margin:0 0 16px;font-size:17px;line-height:1.7">Olá, <strong>${nomeSeguro}</strong>.</p>
      <p style="margin:0 0 16px;font-size:16px;line-height:1.7;color:#344256">
        Recebemos seu cadastro de <strong>${tipoSeguro}</strong>. A organização vai analisar os dados enviados e retornar por e-mail com os próximos passos.
      </p>
      <div style="background:#f8fafc;border:1px solid #dbe4ef;border-radius:18px;padding:18px;margin:22px 0">
        <p style="margin:0;color:#102033;font-weight:900">Status atual: em análise</p>
        <p style="margin:8px 0 0;color:#5b6b82;line-height:1.6">Você não precisa reenviar o formulário. Caso seja aprovado, receberá o aviso e as instruções no mesmo e-mail usado no cadastro.</p>
      </div>
    `,
  )
}

export function emailOrganizadorAtivado(nome: string): string {
  const nomeSeguro = escapeHtml(nome)
  return layout(
    'Acesso criado',
    'Seu acesso de criador de campeonatos foi criado na volei.space.',
    `
      <p style="margin:0 0 16px;font-size:17px;line-height:1.7">Olá, <strong>${nomeSeguro}</strong>.</p>
      <p style="margin:0 0 16px;font-size:16px;line-height:1.7;color:#344256">
        Seu acesso como <strong>criador de campeonatos</strong> foi criado com permissão padrão para cadastrar competições, abrir inscrições e acompanhar a operação no painel.
      </p>
      <div style="background:#f8fafc;border:1px solid #dbe4ef;border-radius:18px;padding:18px;margin:22px 0">
        <p style="margin:0;color:#102033;font-weight:900">Status atual: ativo</p>
        <p style="margin:8px 0 0;color:#5b6b82;line-height:1.6">Use o mesmo e-mail e senha cadastrados para acessar sua área na plataforma.</p>
      </div>
    `,
  )
}

export function emailAprovacaoCandidatura(nome: string, linkPagamento: string): string {
  const nomeSeguro = escapeHtml(nome)
  return layout(
    'Candidatura aprovada',
    'Sua candidatura foi aprovada. Confirme sua participação.',
    `
      <p style="margin:0 0 16px;font-size:17px;line-height:1.7">Olá, <strong>${nomeSeguro}</strong>.</p>
      <p style="margin:0 0 16px;font-size:16px;line-height:1.7;color:#344256">
        Sua candidatura foi aprovada pela organização da volei.space. Para confirmar a participação, finalize o pagamento pelo link abaixo.
      </p>
      ${button('Realizar pagamento', linkPagamento)}
      <p style="margin:4px 0 0;color:#5b6b82;font-size:14px;line-height:1.6">Após a confirmação do pagamento, você receberá o link para cadastrar os atletas da equipe.</p>
    `,
  )
}

export function emailAprovacaoSemPagamento(nome: string, tipo: string): string {
  const nomeSeguro = escapeHtml(nome)
  const tipoSeguro = escapeHtml(tipo)
  return layout(
    'Cadastro aprovado',
    'Sua candidatura foi aprovada.',
    `
      <p style="margin:0 0 16px;font-size:17px;line-height:1.7">Olá, <strong>${nomeSeguro}</strong>.</p>
      <p style="margin:0;font-size:16px;line-height:1.7;color:#344256">
        Seu cadastro de <strong>${tipoSeguro}</strong> foi aprovado pela organização da volei.space. Em breve a equipe entrará em contato com as orientações operacionais.
      </p>
    `,
  )
}

export function emailRejeicaoCandidatura(nome: string): string {
  const nomeSeguro = escapeHtml(nome)
  return layout(
    'Retorno sobre sua candidatura',
    'A organização analisou sua candidatura.',
    `
      <p style="margin:0 0 16px;font-size:17px;line-height:1.7">Olá, <strong>${nomeSeguro}</strong>.</p>
      <p style="margin:0;font-size:16px;line-height:1.7;color:#344256">
        Agradecemos o interesse em participar da volei.space. Neste momento, sua candidatura não foi aprovada para esta etapa da competição.
      </p>
      <p style="margin:16px 0 0;color:#5b6b82;font-size:14px;line-height:1.6">Em caso de dúvidas, responda este e-mail ou entre em contato com a organização.</p>
    `,
  )
}

export function emailEquipeAtivada(nome: string, linkInscricao: string): string {
  const nomeSeguro = escapeHtml(nome)
  return layout(
    'Equipe ativada',
    'Pagamento confirmado. Cadastre os atletas.',
    `
      <p style="margin:0 0 16px;font-size:17px;line-height:1.7">Olá, <strong>${nomeSeguro}</strong>.</p>
      <p style="margin:0 0 16px;font-size:16px;line-height:1.7;color:#344256">
        O pagamento foi confirmado e sua equipe está ativa na volei.space. Use o link abaixo para cadastrar os atletas.
      </p>
      ${button('Cadastrar atletas', linkInscricao)}
      <p style="margin:4px 0 0;color:#5b6b82;font-size:14px;line-height:1.6">Compartilhe este link apenas com os atletas da sua equipe.</p>
    `,
  )
}

export function emailQRCodeJogador(nome: string, qrCodeDataUrl: string, equipeNome: string): string {
  const nomeSeguro = escapeHtml(nome)
  const equipeSegura = escapeHtml(equipeNome)
  return layout(
    'Credencial do atleta',
    'Seu QR Code de identificação está pronto.',
    `
      <p style="margin:0 0 16px;font-size:17px;line-height:1.7">Olá, <strong>${nomeSeguro}</strong>.</p>
      <p style="margin:0 0 16px;font-size:16px;line-height:1.7;color:#344256">
        Seu cadastro na equipe <strong>${equipeSegura}</strong> foi realizado. Apresente o QR Code abaixo antes das partidas.
      </p>
      <div style="text-align:center;background:#f8fafc;border:1px solid #dbe4ef;border-radius:22px;padding:24px;margin:22px 0">
        <img src="${qrCodeDataUrl}" alt="QR Code do atleta" style="width:210px;height:210px;display:inline-block" />
      </div>
    `,
  )
}

export function emailAtivarConta(nome: string, link: string): string {
  const nomeSeguro = escapeHtml(nome)
  return layout(
    'Confirme seu e-mail',
    'Ative sua conta de criador de campeonatos na volei.space.',
    `
      <p style="margin:0 0 16px;font-size:17px;line-height:1.7">Olá, <strong>${nomeSeguro}</strong>.</p>
      <p style="margin:0 0 16px;font-size:16px;line-height:1.7;color:#344256">
        Falta um passo para ativar seu acesso como <strong>criador de campeonatos</strong> na volei.space. Confirme seu e-mail clicando no botão abaixo.
      </p>
      ${button('Ativar minha conta', link)}
      <p style="margin:4px 0 0;color:#5b6b82;font-size:14px;line-height:1.6">Este link expira em 24 horas. Se você não fez esse cadastro, ignore este e-mail.</p>
    `,
  )
}

export function emailRecuperacaoSenha(nome: string, link: string): string {
  const nomeSeguro = escapeHtml(nome)
  return layout(
    'Recuperação de senha',
    'Use o link para criar uma nova senha.',
    `
      <p style="margin:0 0 16px;font-size:17px;line-height:1.7">Olá, <strong>${nomeSeguro}</strong>.</p>
      <p style="margin:0 0 16px;font-size:16px;line-height:1.7;color:#344256">
        Recebemos uma solicitação para redefinir sua senha de acesso da volei.space.
      </p>
      ${button('Criar nova senha', link, 'dark')}
      <p style="margin:4px 0 0;color:#5b6b82;font-size:14px;line-height:1.6">Este link expira em 30 minutos. Se você não solicitou essa recuperação, ignore este e-mail.</p>
    `,
  )
}

export function emailConviteEquipeCampeonato(params: {
  campeonato: string
  organizador: string
  link: string
  mensagem?: string | null
}): string {
  const campeonato = escapeHtml(params.campeonato)
  const organizador = escapeHtml(params.organizador)
  const mensagem = params.mensagem ? escapeHtml(params.mensagem) : ''

  return layout(
    'Convite para campeonato',
    `Sua equipe foi convidada para participar de ${campeonato}.`,
    `
      <p style="margin:0 0 16px;font-size:17px;line-height:1.7">Olá.</p>
      <p style="margin:0 0 16px;font-size:16px;line-height:1.7;color:#344256">
        <strong>${organizador}</strong> convidou sua equipe para participar do campeonato <strong>${campeonato}</strong> na plataforma volei.space.
      </p>
      ${mensagem ? `<div style="background:#f8fafc;border:1px solid #dbe4ef;border-radius:18px;padding:18px;margin:22px 0;color:#344256;line-height:1.6">${mensagem}</div>` : ''}
      ${button('Abrir convite', params.link)}
      <p style="margin:4px 0 0;color:#5b6b82;font-size:14px;line-height:1.6">
        Se sua equipe ainda não tiver cadastro, o link abrirá o formulário já direcionado para este campeonato.
      </p>
    `,
  )
}
