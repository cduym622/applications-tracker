import { useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import BackLink from '../components/BackLink'
import StatusMenu from '../components/StatusMenu'
import {
  applications,
  companyName,
  formatDate,
  formatDateTime,
  nextInterview,
} from '../mockData'
import { label, STATUSES, type Status } from '../types'

const PAGE_SIZE = 5

type ListParam = 'q' | 'from' | 'to' | 'status' | 'page'

export default function ApplicationList() {
  const navigate = useNavigate()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  // Re-render after a status change. The mock record is mutated in place.
  const [, bump] = useState(0)

  // Search, dates, status, and page live in the address so Back from detail restores them.
  const search = params.get('q') ?? ''
  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''
  const statusParam = params.get('status')
  const status = STATUSES.includes(statusParam as Status) ? (statusParam as Status) : ''
  const page = Math.max(1, Number(params.get('page')) || 1)

  /** Set or clear params. Changing any filter returns to page 1. */
  const update = (patch: Partial<Record<ListParam, string>>, replace = false) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (!('page' in patch)) next.delete('page')
        for (const [key, value] of Object.entries(patch)) {
          if (value) next.set(key, value)
          else next.delete(key)
        }
        return next
      },
      { replace },
    )
  }

  // Client-side stand-in for the server's search, filter, and pagination.
  const q = search.trim().toLowerCase()
  const rangeSet = from !== '' || to !== ''
  const filtered = applications.filter((a) => {
    if (q && !a.jobTitle.toLowerCase().includes(q) && !companyName(a.companyId).toLowerCase().includes(q)) {
      return false
    }
    if (rangeSet) {
      if (!a.dateApplied) return false
      if (from && a.dateApplied < from) return false
      if (to && a.dateApplied > to) return false
    }
    if (status && a.status !== status) return false
    return true
  })

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = Math.min(page, pageCount)
  const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)

  const changeStatus = (id: number, next: Status) => {
    // Mock: stands in for PATCH /api/applications/{id}/ with { status }.
    const app = applications.find((a) => a.id === id)
    if (app) app.status = next
    bump((n) => n + 1)
  }

  return (
    <main className="page">
      <BackLink />
      <header className="page-header">
        <h1>{status ? label(status) : 'All applications'}</h1>
        <Link to="/applications/new" className="btn btn-primary">
          + New application
        </Link>
      </header>

      <div className="card filters">
        <label className="field grow">
          <span>Search</span>
          <input
            type="search"
            placeholder="Job title or company"
            value={search}
            onChange={(e) => update({ q: e.target.value }, true)}
          />
        </label>
        <label className="field">
          <span>Status</span>
          <select value={status} onChange={(e) => update({ status: e.target.value })}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {label(s)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Applied from</span>
          <input type="date" value={from} onChange={(e) => update({ from: e.target.value })} />
        </label>
        <label className="field">
          <span>Applied to</span>
          <input type="date" value={to} onChange={(e) => update({ to: e.target.value })} />
        </label>
        {rangeSet && (
          <button className="btn btn-ghost" onClick={() => update({ from: '', to: '' })}>
            Clear dates
          </button>
        )}
      </div>

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Job title</th>
              <th>Company</th>
              <th>Status</th>
              <th>Date applied</th>
              <th>Next interview</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted center">
                  No applications match.
                </td>
              </tr>
            ) : (
              rows.map((a) => {
                const next = nextInterview(a.id)
                return (
                  <tr
                    key={a.id}
                    className="clickable"
                    onClick={() =>
                      navigate(`/applications/${a.id}`, {
                        state: { from: location.pathname + location.search },
                      })
                    }
                  >
                    <td>
                      <strong>{a.jobTitle}</strong>
                    </td>
                    <td>{companyName(a.companyId)}</td>
                    <td>
                      <StatusMenu status={a.status} onChange={(s) => changeStatus(a.id, s)} />
                    </td>
                    <td>{a.dateApplied ? formatDate(a.dateApplied) : ''}</td>
                    <td>{next ? formatDateTime(next.scheduledAt) : ''}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <div className="pager">
          <button
            className="btn"
            disabled={current === 1}
            onClick={() => update({ page: current - 1 > 1 ? String(current - 1) : '' })}
          >
            ← Previous
          </button>
          <span className="muted">
            Page {current} of {pageCount}
          </span>
          <button
            className="btn"
            disabled={current === pageCount}
            onClick={() => update({ page: String(current + 1) })}
          >
            Next →
          </button>
        </div>
      )}
    </main>
  )
}
