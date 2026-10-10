import { NomeEquipe } from '@/components/equipes/NomeEquipe'

type TeamIdentityProps = {
  nome: string
  cor?: string | null
  logoUrl?: string | null
  align?: 'left' | 'right' | 'center'
  compact?: boolean
  showName?: boolean
}

export function TeamIdentity({ nome, cor, logoUrl, align = 'left', compact = false, showName = true }: TeamIdentityProps) {
  const color = cor ?? '#2B7CFF'
  const resolvedLogoUrl = resolveTeamLogoUrl(logoUrl)
  const initials = nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

  const sizeClasses = compact ? 'h-10 w-10 text-[11px]' : 'h-12 w-12 text-xs'

  return (
    <div className={`flex min-w-0 max-w-full items-center gap-3 ${align === 'right' ? 'flex-row-reverse text-right' : ''} ${align === 'center' ? 'flex-col text-center' : ''}`}>
      {resolvedLogoUrl ? (
        <span className={`inline-flex shrink-0 items-center justify-center overflow-hidden ${sizeClasses}`}>
          <img src={resolvedLogoUrl} alt={nome} className="h-full w-full object-contain" referrerPolicy="no-referrer" />
        </span>
      ) : (
        <span className={`team-mark ${sizeClasses}`} style={{ ['--team-color' as string]: color }}>
          {initials}
        </span>
      )}
      {showName && (
        <span className="min-w-0 flex-1">
          <NomeEquipe nome={nome} className="block truncate font-black leading-tight text-slate-950" />
        </span>
      )}
    </div>
  )
}

function resolveTeamLogoUrl(value?: string | null) {
  const url = String(value ?? '').trim()
  if (!url) return ''

  if (/ssl\.gstatic\.com\/docs\/doclist\/images\/mediatype/i.test(url)) return ''
  if (/\/images?\/branding\/product\//i.test(url) && /drive/i.test(url)) return ''

  const driveId = extractGoogleDriveFileId(url)
  if (driveId) return `https://drive.google.com/uc?export=view&id=${encodeURIComponent(driveId)}`

  return url
}

function extractGoogleDriveFileId(url: string) {
  if (!/drive\.google\.com|drive\.usercontent\.google\.com/i.test(url)) return ''

  const filePathMatch = url.match(/\/file\/d\/([^/?#]+)/i)
  if (filePathMatch?.[1]) return filePathMatch[1]

  const openPathMatch = url.match(/\/open\?id=([^&#]+)/i)
  if (openPathMatch?.[1]) return decodeURIComponent(openPathMatch[1])

  const queryMatch = url.match(/[?&]id=([^&#]+)/i)
  if (queryMatch?.[1]) return decodeURIComponent(queryMatch[1])

  const downloadMatch = url.match(/\/download\/([^/?#]+)/i)
  if (downloadMatch?.[1]) return downloadMatch[1]

  return ''
}
