import { startTransition, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { errorText, getDashboard } from '../api'
import { useAuth } from '../auth'
import StatusBadge from '../components/StatusBadge'
import { formatDateTime } from '../format'
import { label, STATUSES, type DashboardData } from '../types'

export default function Dashboard() {
  const { signOut } = useAuth()
  const navigate = useNavigate()

  // The router applies navigation in a transition. Sign out in the same
  // transition so the guard never sees a signed-out user on /dashboard.
  const logOut = () => {
    startTransition(() => {
      navigate('/', { replace: true })
      signOut()
    })
  }

  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    getDashboard().then(
      (d) => !cancelled && setData(d),
      (err) => !cancelled && setError(errorText(err)),
    )
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <main className="page">
      <header className="page-header">
        <h1>Dashboard</h1>
        <div className="actions">
          <Link to="/applications" className="btn">
            All applications
          </Link>
          <Link to="/applications/new" className="btn btn-primary">
            + New application
          </Link>
          <button className="btn btn-ghost" onClick={logOut}>
            Log out
          </button>
        </div>
      </header>

      {error && <div className="alert">{error}</div>}
      {!data ? (
        !error && <p className="muted">Loading...</p>
      ) : (
        <>
          <section>
            <h2>Applications by status</h2>
            <div className="count-grid">
              {STATUSES.map((status) => (
                <Link key={status} to={`/applications?status=${status}`} className="count-card">
                  <div className="count-value">{data.counts[status]}</div>
                  <StatusBadge status={status} />
                </Link>
              ))}
            </div>
          </section>

          <section>
            <h2>Upcoming interviews</h2>
            {data.upcomingInterviews.length === 0 ? (
              <p className="card muted">No upcoming interviews.</p>
            ) : (
              <ul className="card list">
                {data.upcomingInterviews.map((interview) => (
                  <li key={interview.id}>
                    <Link
                      to={`/applications/${interview.applicationId}`}
                      state={{ from: '/dashboard' }}
                      className="list-row"
                    >
                      <div>
                        <strong>{interview.jobTitle}</strong>
                        <div className="muted">{interview.companyName}</div>
                      </div>
                      <div className="list-row-meta">
                        <span>{formatDateTime(interview.scheduledAt)}</span>
                        <span className="tag">{label(interview.type)}</span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  )
}
