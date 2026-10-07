import { label, type Status } from '../types'

export default function StatusBadge({ status }: { status: Status }) {
  return <span className={`badge badge-${status.toLowerCase()}`}>{label(status)}</span>
}
