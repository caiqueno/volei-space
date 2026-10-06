import { redirect } from 'next/navigation'

export default function AoVivoPage() {
  redirect('/jogos?filtro=ao-vivo')
}
