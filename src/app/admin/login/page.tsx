import { redirect } from 'next/navigation'

export default function AdminLoginRedirect({
  searchParams,
}: {
  searchParams: { next?: string }
}) {
  const next = typeof searchParams?.next === 'string' ? searchParams.next : ''
  if (next.startsWith('/admin') && !next.startsWith('/admin/login')) {
    redirect(`/login?next=${encodeURIComponent(next)}`)
  }
  redirect('/login')
}
