import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, errorText, login } from '../api'
import { useAuth } from '../auth'

export default function Login() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    setErrors({})
    try {
      const { access } = await login(email, password)
      // Storing the token flips the guard, which opens the dashboard.
      signIn(access)
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fieldErrors)
        setError(err.message)
      } else {
        setError(errorText(err))
      }
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <form className="card auth-card" onSubmit={handleSubmit} noValidate>
        <h1>Log in</h1>
        <p className="muted">Track your job applications.</p>

        {error && <div className="alert">{error}</div>}

        <label className="field">
          <span>Email</span>
          <input
            type="email"
            className={errors.email ? 'invalid' : ''}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {errors.email && <small className="field-error">{errors.email}</small>}
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            className={errors.password ? 'invalid' : ''}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {errors.password && <small className="field-error">{errors.password}</small>}
        </label>

        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          Log in
        </button>
        <p className="muted center">
          No account? <Link to="/register">Register</Link>
        </p>
      </form>
    </div>
  )
}
