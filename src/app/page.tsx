import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Camera,
  ClipboardCheck,
  Flame,
  QrCode,
  ShieldCheck,
  Trophy,
  Users,
} from 'lucide-react'
import { LandingFlowCard } from '@/components/landing/LandingFlowCard'
import { LandingExperience } from '@/components/landing/LandingExperience'
import { InstagramIcon } from '@/components/landing/InstagramIcon'
import { LandingMotion } from '@/components/landing/LandingMotion'
import { createPageMetadata } from '@/lib/seo'

export const metadata = createPageMetadata({
  title: 'Gestão de campeonatos de vôlei',
  description: 'Crie, organize e divulgue campeonatos de vôlei com inscrições, calendário de jogos, classificação, rankings, galeria e súmula digital.',
  path: '/',
})

const instagramUrl = 'https://www.instagram.com/volei.space/'

const stats = [
  { value: 'Equipes', label: 'Cadastram jogadores e acompanham a campanha.', tone: 'captains' },
  { value: 'Árbitros', label: 'Operam a súmula digital.', tone: 'referees' },
  { value: 'Torcida', label: 'Acompanha jogos e tabela em tempo real.', tone: 'courts' },
  { value: 'Organizadores', label: 'Criam e operam os próprios campeonatos.', tone: 'organizers' },
]

const features = [
  { icon: <CalendarDays size={22} />, title: 'Calendário', text: 'Rodadas, horários, locais e confrontos em uma agenda pública.' },
  { icon: <BarChart3 size={22} />, title: 'Classificação', text: 'Tabela ao vivo com pontos, vitórias, sets e saldo.' },
  { icon: <Trophy size={22} />, title: 'Destaques', text: 'MVPs, rankings e campanhas registrados durante a temporada.' },
  { icon: <ClipboardCheck size={22} />, title: 'Súmula digital', text: 'Registro oficial de pontos, sets, eventos e resultado da partida.' },
  { icon: <Users size={22} />, title: 'Equipes', text: 'Elencos, inscrições e identidade dos times.' },
  { icon: <Camera size={22} />, title: 'Galeria', text: 'Fotos e bastidores para divulgar o campeonato.' },
  { icon: <QrCode size={22} />, title: 'QR Code', text: 'Credenciamento rápido para atletas antes das partidas.' },
  { icon: <ShieldCheck size={22} />, title: 'Gestão', text: 'Painel administrativo para operar campeonato, jogos e inscrições.' },
]

const stages = [
  { step: '01', title: 'Inscrições', text: 'Equipes entram e atletas são validados.' },
  { step: '02', title: 'Tabela', text: 'Confrontos, locais e horários ficam públicos.' },
  { step: '03', title: 'Rodadas', text: 'Resultados e súmulas atualizam a competição.' },
  { step: '04', title: 'Finais', text: 'Ranking, premiação e campeões ficam registrados.' },
]

type RoleStat = (typeof stats)[number]

function RoleCard({ stat }: { stat: RoleStat }) {
  return (
    <div className={`landing-role-card is-${stat.tone}`}>
      <span className="role-card-photo" aria-hidden="true" />
      <span className="role-card-signal" aria-hidden="true" />
      <div className="role-card-copy">
        <strong>{stat.value}</strong>
        <span>{stat.label}</span>
      </div>
    </div>
  )
}

export default function LandingPage() {
  return (
    <main className="landing-tech-shell">
      <LandingMotion />
      <section className="landing-hero">
        <div className="landing-hero-media">
          <Image src="/brand/volley-hero.png" alt="Jogadores de vôlei em quadra" fill priority sizes="100vw" className="object-cover" />
        </div>
        <div className="landing-mesh" />
        <div className="landing-grid" />
        <div className="landing-particles" aria-hidden="true" />

        <div className="landing-hero-inner">
          <div className="landing-copy motion-in">
            <h1 className="sr-only">volei.space — Gestão de campeonatos de vôlei</h1>
            <img
                src="/brand/volei-space_wordmark_transparente.png"
                alt="volei.space"
                className="landing-logo"
                /><p className="landing-subtitle">
              Gerenciamento de campeonatos com calendário de jogos, tabela ao vivo, rankings, galeria e súmula digital em uma experiência única para atletas e torcida.
            </p>

           {/*} <div className="landing-actions">
              <Link href="/campeonatos" className="landing-secondary">
                Ver campeonatos
                <Trophy size={18} />
              </Link>
              <a href={instagramUrl} target="_blank" rel="noreferrer" className="landing-secondary">
                <InstagramIcon size={18} />
                Instagram vila.space
              </a>
            </div>*/}

            <div className="landing-role-carousel" aria-label="Perfis da plataforma">
              <div className="landing-role-track">
                {[...stats, ...stats].map((stat, index) => (
                  <RoleCard key={`${stat.value}-${index}`} stat={stat} />
                ))}
              </div>
            </div>
          </div>

          <div className="landing-live-card landing-live-card-clean motion-in-delay">
            <LandingFlowCard />
          </div>
        </div>
      </section>

      <section id="temporada" className="landing-section landing-animate">
        <div className="landing-section-head landing-animate">
          <h2>Um campeonato para acompanhar do início ao fim.</h2>
        </div>
        <div className="landing-image-band">
          <div className="image-band-media landing-animate">
            <Image src="/brand/landing-season-volleyball.jpg" alt="Partida de vôlei em quadra" fill sizes="(min-width: 1024px) 620px, 100vw" className="object-cover" />
          </div>
          <div className="image-band-copy landing-animate">
            <h3>A página pública do campeonato.</h3>
            <p>
              Página pública para divulgar campeonatos, abrir inscrições, acompanhar confrontos e transformar cada rodada em memória para atletas e torcida.
            </p>
          </div>
        </div>
      </section>

      <section id="funcionalidades" className="landing-section landing-animate">
        <div className="landing-section-head compact landing-animate">
          <h2>Um só lugar para quem joga, apita, recebe e organiza.</h2>
        </div>
        <div className="landing-feature-grid">
          {features.map((feature, index) => (
            <article key={feature.title} className="landing-tech-card landing-animate" style={{ animationDelay: `${index * 70}ms` }}>
              <span>{feature.icon}</span>
              <h3>{feature.title}</h3>
              <p>{feature.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="portal-preview" className="landing-console-section landing-animate">
        <div className="console-copy landing-animate">
          <h2>Uma jogada atualiza o placar, a súmula e a tabela.</h2>
          <p>
            Acompanhe o fluxo de uma rodada com ponto registrado, evento anotado e classificação reagindo no mesmo ambiente.
          </p>
        </div>
        <LandingExperience />
      </section>

      <section id="etapas" className="landing-section landing-flow landing-animate">
        <div className="landing-section-head compact landing-animate">
          <h2>Da inscrição à final, tudo fica visível.</h2>
        </div>
        <div className="timeline-grid">
          {stages.map((stage) => (
            <article key={stage.step} className="timeline-item landing-animate">
              <strong>{stage.step}</strong>
              <span>{stage.title}</span>
              <p>{stage.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="cadastro-previo" className="landing-section landing-animate">
        <div className="landing-section-head compact landing-animate">
          <h2>Quero organizar um campeonato</h2>
        </div>
        <p className="landing-form-intro landing-animate">
          Informe nome, e-mail e telefone. O administrador libera o acesso e entrega uma senha temporária.
        </p>
        <Link href="/seja-membro" className="landing-primary inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-black">
          Seja membro <ArrowRight size={16} />
        </Link>
      </section>
    </main>
  )
}
