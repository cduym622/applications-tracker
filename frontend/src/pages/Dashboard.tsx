import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
import StatusBadge from '../components/StatusBadge'
import { applications, companyName, formatDateTime, interviews, isUpcoming } from '../mockData'
import { label, STATUSES } from '../types'

export default function Dashboard() {
  const { signOut } = useAuth()

  const counts = STATUSES.map((status) => ({
    status,
    count: applications.filter((a) => a.status === status).length,
  }))

  const upcoming = interviews
    .filter(isUpcoming)
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
    .map((i) => ({ interview: i, app: applications.find((a) => a.id === i.applicationId)! }))

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
          <button className="btn btn-ghost" onClick={signOut}>
            Log out
          </button>
        </div>
      </header>

      <section>
        <h2>Applications by status</h2>
        <div className="count-grid">
          {counts.map(({ status, count }) => (
            <div key={status} className="count-card">
              <div className="count-value">{count}</div>
              <StatusBadge status={status} />
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2>Upcoming interviews</h2>
        {upcoming.length === 0 ? (
          <p className="card muted">No upcoming interviews.</p>
        ) : (
          <ul className="card list">
            {upcoming.map(({ interview, app }) => (
              <li key={interview.id}>
                <Link to={`/applications/${app.id}`} className="list-row">
                  <div>
                    <strong>{app.jobTitle}</strong>
                    <div className="muted">{companyName(app.companyId)}</div>
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
    </main>
  )
}
