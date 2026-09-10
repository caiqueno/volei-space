import { redirect } from 'next/navigation'

export default function FichaPage() {
  redirect('/cadastro?modo=cadastro')
}
