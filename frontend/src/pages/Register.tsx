import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth'

export default function Register() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const next: typeof errors = {}
    // Mock: this address stands in for an email that is already registered.
    if (email.toLowerCase() === 'taken@example.com') {
      next.email = 'An account with this email already exists.'
    }
    if (password.length < 8) {
      next.password = 'Password must be at least 8 characters.'
    }
    setErrors(next)
    if (Object.keys(next).length === 0) signIn()
  }

  return (
    <div className="auth-page">
      <form className="card auth-card" onSubmit={handleSubmit} noValidate>
        <h1>Create account</h1>
        <p className="muted">Start tracking your applications.</p>

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

        <button type="submit" className="btn btn-primary btn-block">
          Register
        </button>
        <p className="muted center">
          Already registered? <Link to="/login">Log in</Link>
        </p>
      </form>
    </div>
  )
}
