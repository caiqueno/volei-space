'use client'

import { useState } from 'react'
import { ArrowRight } from 'lucide-react'

export function LandingInteressadosForm() {
  const [nomeCompleto, setNomeCompleto] = useState('')
  const [email, setEmail] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [cidade, setCidade] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setStatus(null)
    try {
      const res = await fetch('/api/interessados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nomeCompleto, email, whatsapp, cidade }),
      })
      const json = await res.json()
      if (!res.ok) {
        setStatus({ type: 'error', message: json.error || 'Não foi possível enviar. Tente novamente.' })
        return
      }
      setStatus({ type: 'success', message: 'Recebemos seu interesse! Em breve entramos em contato.' })
      setNomeCompleto('')
      setEmail('')
      setWhatsapp('')
      setCidade('')
    } catch {
      setStatus({ type: 'error', message: 'Não foi possível enviar. Verifique sua conexão e tente novamente.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="landing-form" onSubmit={handleSubmit}>
      <div className="landing-form-field">
        <label htmlFor="interessado-nome">Nome completo</label>
        <input
          id="interessado-nome"
          className="landing-form-input"
          value={nomeCompleto}
          onChange={(event) => setNomeCompleto(event.target.value)}
          placeholder="Seu nome"
          required
        />
      </div>
      <div className="landing-form-field">
        <label htmlFor="interessado-email">E-mail</label>
        <input
          id="interessado-email"
          type="email"
          className="landing-form-input"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="voce@email.com"
          required
        />
      </div>
      <div className="landing-form-field">
        <label htmlFor="interessado-whatsapp">WhatsApp</label>
        <input
          id="interessado-whatsapp"
          className="landing-form-input"
          value={whatsapp}
          onChange={(event) => setWhatsapp(event.target.value)}
          placeholder="(00) 00000-0000"
          required
        />
      </div>
      <div className="landing-form-field">
        <label htmlFor="interessado-cidade">Cidade</label>
        <input
          id="interessado-cidade"
          className="landing-form-input"
          value={cidade}
          onChange={(event) => setCidade(event.target.value)}
          placeholder="Sua cidade"
          required
        />
      </div>

      {status && (
        <p className={`landing-form-message ${status.type === 'success' ? 'is-success' : 'is-error'}`}>{status.message}</p>
      )}

      <button type="submit" disabled={submitting} className="landing-primary landing-form-submit">
        {submitting ? 'Enviando...' : 'Quero ser avisado'}
        <ArrowRight size={18} />
      </button>
    </form>
  )
}
