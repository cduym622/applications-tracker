import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, errorText, register } from '../api'
import { useAuth } from '../auth'

export default function Register() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  // The API checks for a duplicate email, a short or common password, and a bad email.
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    setErrors({})
    try {
      const { access } = await register(email, password)
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
        <h1>Create account</h1>
        <p className="muted">Start tracking your applications.</p>

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
          {errors.password ? (
            <small className="field-error">{errors.password}</small>
          ) : (
            <small className="hint">At least 8 characters.</small>
          )}
        </label>

        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          Register
        </button>
        <p className="muted center">
          Already registered? <Link to="/login">Log in</Link>
        </p>
      </form>
    </div>
  )
}
