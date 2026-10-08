import { Link, useLocation } from 'react-router-dom'
import { label as statusLabel, STATUSES, type Status } from '../types'

export default function BackLink({ to = '/dashboard', label = 'Dashboard' }: { to?: string; label?: string }) {
  return (
    <Link to={to} className="back-link">
      ← {label}
    </Link>
  )
}

/**
 * Where the detail screen's Back goes, based on the address it was opened from
 * (router state `from`). Opened on its own, it goes to the unfiltered list.
 */
export function useBackTarget(): { to: string; label: string } {
  const from = (useLocation().state as { from?: string } | null)?.from
  if (!from) return { to: '/applications', label: 'All applications' }
  if (from.startsWith('/dashboard')) return { to: '/dashboard', label: 'Dashboard' }
  const status = new URLSearchParams(from.split('?')[1] ?? '').get('status')
  return {
    to: from,
    label: STATUSES.includes(status as Status) ? statusLabel(status!) : 'All applications',
  }
}
