import { NextResponse } from 'next/server'
import { normalizarDatasHora } from '@/lib/data-hora'

export function success<T>(data: T, status = 200) {
  return NextResponse.json({ data: normalizarDatasHora(data) }, { status })
}

export function error(message: string, status: number, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status })
}
