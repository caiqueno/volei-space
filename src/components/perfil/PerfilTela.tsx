'use client'

import { useEffect, useState } from 'react'
import { listarPerfis } from '@/components/login-sem-senha/cliente'
import { Aviso, botaoSecundario, cartao, Pagina } from '@/components/meu-time/ui'
import { descricaoDoPerfil, loginSemSenhaAtivo, rotuloDoPerfil, type Perfil } from '@/lib/login-sem-senha-ui/regras'
import { encerrarSessaoPublica, lerSessaoPublica } from '@/lib/sessao-publica'

export function PerfilTela() {
  const [perfis, setPerfis] = useState<Perfil[]>([])
  const [ativo, setAtivo] = useState<Perfil | null>(null)
  const [carregou, setCarregou] = useState(false)
  const [saindo, setSaindo] = useState(false)
  const [conta, setConta] = useState<{ nome?: string; email?: string } | null>(null)

  useEffect(() => {
    const s = lerSessaoPublica()
    setConta(s ? { nome: s.nome, email: s.email } : null)
    if (!loginSemSenhaAtivo()) {
      setCarregou(true)
      return
    }
    let vivo = true
    void listarPerfis().then((r) => {
      if (!vivo) return
      if (r.ok) {
        setPerfis(r.dados.perfis)
        setAtivo(r.dados.perfilAtivo)
      }
      setCarregou(true)
    })
    return () => { vivo = false }
  }, [])

  async function sair() {
    if (saindo) return
    setSaindo(true)
    await encerrarSessaoPublica()
  }

  return (
    <Pagina titulo="Perfil">
      <section aria-labelledby="conta" className={`${cartao} flex flex-col gap-1`}>
        <h2 id="conta" className="text-xl font-black">Dados da conta</h2>
        {conta?.nome && <p className="text-base font-bold">{conta.nome}</p>}
        {conta?.email && <p className="text-base">{conta.email}</p>}
        {!conta?.nome && !conta?.email && <p className="text-[var(--vs-muted)]">Você entrou com código. O e-mail da conta fica guardado com segurança no servidor.</p>}
      </section>

      <section aria-labelledby="perfis" className={`${cartao} flex flex-col gap-2`}>
        <h2 id="perfis" className="text-xl font-black">Perfis vinculados</h2>
        {!carregou && <p className="text-[var(--vs-muted)]" role="status">Carregando…</p>}
        {carregou && perfis.length === 0 && <Aviso>Nenhum perfil para mostrar agora.</Aviso>}
        {perfis.length > 0 && (
          <ul className="flex flex-col gap-2">
            {perfis.map((p) => {
              const atual = ativo && p.perfil === ativo.perfil && p.referenciaId === ativo.referenciaId
              return (
                <li key={`${p.perfil}:${p.referenciaId}`} className="rounded-xl bg-[var(--vs-elevated)] p-3">
                  <p className="font-black">{rotuloDoPerfil(p)}{atual ? ' (ativo)' : ''}</p>
                  <p className="text-sm text-[var(--vs-muted)]">{descricaoDoPerfil(p.perfil)}</p>
                </li>
              )
            })}
          </ul>
        )}
        {perfis.length > 1 && <p className="text-sm text-[var(--vs-muted)]">Para trocar de perfil, use o seletor no topo da página.</p>}
      </section>

      <button type="button" onClick={() => void sair()} disabled={saindo} className={botaoSecundario}>
        {saindo ? 'Saindo…' : 'Sair'}
      </button>
    </Pagina>
  )
}
