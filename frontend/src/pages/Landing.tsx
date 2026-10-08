import { Link } from 'react-router-dom'

export default function Landing() {
  return (
    <>
      <header className="topbar">
        <span className="brand">Applications Tracker</span>
        <div className="actions">
          <Link to="/login" className="btn btn-ghost">
            Login
          </Link>
          <Link to="/register" className="btn btn-primary">
            Register
          </Link>
        </div>
      </header>
      <main className="page landing">
        <h1>Every application, one place.</h1>
        <p className="muted">
          Track the jobs you apply to, the interviews you schedule, and the notes you take along the way.
        </p>
      </main>
    </>
  )
}
