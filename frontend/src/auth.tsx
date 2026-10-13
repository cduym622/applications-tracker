// JWT session. The access token lives in localStorage under `access`.
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { setUnauthorizedHandler, TOKEN_KEY } from './api'

interface AuthState {
  signedIn: boolean
  signIn: (access: string) => void
  signOut: () => void
}

const AuthContext = createContext<AuthState | null>(null)

/**
 * True when the stored token's payload has an `exp` in the future. Does not
 * check the signature; the API does that. Removes a token that fails the check.
 */
function hasLiveToken(): boolean {
  const token = localStorage.getItem(TOKEN_KEY)
  if (!token) return false
  try {
    let payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    while (payload.length % 4 !== 0) payload += '='
    const { exp } = JSON.parse(atob(payload)) as { exp?: unknown }
    if (typeof exp === 'number' && exp * 1000 > Date.now()) return true
  } catch {
    // Malformed token. Fall through and treat as signed out.
  }
  localStorage.removeItem(TOKEN_KEY)
  return false
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const [signedIn, setSignedIn] = useState(hasLiveToken)

  // An authenticated 401 has already removed the token in api.ts.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setSignedIn(false)
      navigate('/login', { replace: true })
    })
  }, [navigate])

  const signIn = (access: string) => {
    localStorage.setItem(TOKEN_KEY, access)
    setSignedIn(true)
  }
  const signOut = () => {
    localStorage.removeItem(TOKEN_KEY)
    setSignedIn(false)
  }

  return <AuthContext.Provider value={{ signedIn, signIn, signOut }}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
