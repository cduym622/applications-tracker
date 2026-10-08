import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react'
import StatusBadge from './StatusBadge'
import { label, STATUSES, type Status } from '../types'

interface Props {
  status: Status
  onChange: (status: Status) => void
}

/** Status badge that opens a menu of the seven statuses. Clicks don't reach the table row. */
export default function StatusMenu({ status, onChange }: Props) {
  // Fixed position from the trigger's rect, so the table's overflow doesn't clip the menu.
  const [position, setPosition] = useState<CSSProperties | null>(null)
  const open = position !== null
  const ref = useRef<HTMLDivElement>(null)

  const setOpen = (value: boolean) => {
    const rect = ref.current?.getBoundingClientRect()
    setPosition(value && rect ? { top: rect.bottom + 4, left: rect.left } : null)
  }

  useEffect(() => {
    if (!open) return
    const close = () => setPosition(null)
    const onMouseDown = (e: globalThis.MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) close()
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  const choose = (e: MouseEvent, next: Status) => {
    e.stopPropagation()
    setOpen(false)
    if (next !== status) onChange(next)
  }

  return (
    <div className="status-menu" ref={ref} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="status-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <StatusBadge status={status} /> <span className="caret">▾</span>
      </button>
      {open && (
        <ul className="status-menu-list" role="menu" style={position}>
          {STATUSES.map((s) => (
            <li key={s}>
              <button
                type="button"
                role="menuitemradio"
                aria-checked={s === status}
                className={s === status ? 'current' : ''}
                onClick={(e) => choose(e, s)}
              >
                {label(s)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
