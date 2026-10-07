import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import BackLink from '../components/BackLink'
import StatusBadge from '../components/StatusBadge'
import {
  applications,
  companyName,
  formatDate,
  formatDateTime,
  nextInterview,
} from '../mockData'

const PAGE_SIZE = 5

export default function ApplicationList() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)

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
    return true
  })

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = Math.min(page, pageCount)
  const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)

  const resetPage = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v)
    setPage(1)
  }

  return (
    <main className="page">
      <BackLink />
      <header className="page-header">
        <h1>Applications</h1>
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
            onChange={(e) => resetPage(setSearch)(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Applied from</span>
          <input type="date" value={from} onChange={(e) => resetPage(setFrom)(e.target.value)} />
        </label>
        <label className="field">
          <span>Applied to</span>
          <input type="date" value={to} onChange={(e) => resetPage(setTo)(e.target.value)} />
        </label>
        {rangeSet && (
          <button
            className="btn btn-ghost"
            onClick={() => {
              setFrom('')
              setTo('')
              setPage(1)
            }}
          >
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
                  <tr key={a.id} className="clickable" onClick={() => navigate(`/applications/${a.id}`)}>
                    <td>
                      <strong>{a.jobTitle}</strong>
                    </td>
                    <td>{companyName(a.companyId)}</td>
                    <td>
                      <StatusBadge status={a.status} />
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
          <button className="btn" disabled={current === 1} onClick={() => setPage(current - 1)}>
            ← Previous
          </button>
          <span className="muted">
            Page {current} of {pageCount}
          </span>
          <button className="btn" disabled={current === pageCount} onClick={() => setPage(current + 1)}>
            Next →
          </button>
        </div>
      )}
    </main>
  )
}
