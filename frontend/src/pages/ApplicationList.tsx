import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ApiError, errorText, listApplications, updateApplication } from '../api'
import BackLink from '../components/BackLink'
import StatusMenu from '../components/StatusMenu'
import { formatDate, formatDateTime } from '../format'
import { label, STATUSES, type ApplicationPage, type Status } from '../types'

// Matches ApplicationPagination in backend/tracker/filters.py.
const PAGE_SIZE = 10

type ListParam = 'q' | 'from' | 'to' | 'status' | 'page'

export default function ApplicationList() {
  const navigate = useNavigate()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const [data, setData] = useState<ApplicationPage | null>(null)
  const [error, setError] = useState('')
  // Bumped after a status change to refetch the same address.
  const [reload, setReload] = useState(0)

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

  // One address, one GET. The server does the search, filters, and paging.
  const key = params.toString()
  useEffect(() => {
    let cancelled = false
    listApplications({ q: search.trim(), from, to, status, page }).then(
      (result) => {
        if (cancelled) return
        setData(result)
        setError('')
      },
      (err) => {
        if (cancelled) return
        // The page is gone, for example after the last row on it changed status.
        // Step back one page; the new address loads again.
        if (err instanceof ApiError && err.status === 404 && page > 1) {
          update({ page: page - 1 > 1 ? String(page - 1) : '' }, true)
          return
        }
        setData(null)
        setError(errorText(err))
      },
    )
    return () => {
      cancelled = true
    }
    // key covers every value read from the address. update is a new function each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, reload])

  const changeStatus = async (id: number, next: Status) => {
    try {
      await updateApplication(id, { status: next })
      setReload((n) => n + 1)
    } catch (err) {
      setError(errorText(err))
    }
  }

  const rows = data?.results ?? []
  const pageCount = data ? Math.ceil(data.count / PAGE_SIZE) : 0
  const rangeSet = from !== '' || to !== ''

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

      {error && <div className="alert">{error}</div>}

      {!data ? (
        !error && <p className="muted">Loading...</p>
      ) : (
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
                  const next = a.nextInterview
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
                      <td>{a.company.name}</td>
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
      )}

      {data && data.count > 0 && (data.next || data.previous) && (
        <div className="pager">
          <button
            className="btn"
            disabled={!data.previous}
            onClick={() => update({ page: page - 1 > 1 ? String(page - 1) : '' })}
          >
            ← Previous
          </button>
          <span className="muted">
            Page {page} of {pageCount}
          </span>
          <button className="btn" disabled={!data.next} onClick={() => update({ page: String(page + 1) })}>
            Next →
          </button>
        </div>
      )}
    </main>
  )
}
