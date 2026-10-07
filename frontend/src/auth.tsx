// Mock session. A flag in localStorage stands in for the JWT so the
// redirect rules and refresh persistence can be tried without a backend.
import { createContext, useContext, useState, type ReactNode } from 'react'

const KEY = 'mock-session'

interface AuthState {
  signedIn: boolean
  signIn: () => void
  signOut: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [signedIn, setSignedIn] = useState(() => localStorage.getItem(KEY) === '1')

  const signIn = () => {
    localStorage.setItem(KEY, '1')
    setSignedIn(true)
  }
  const signOut = () => {
    localStorage.removeItem(KEY)
    setSignedIn(false)
  }

  return <AuthContext.Provider value={{ signedIn, signIn, signOut }}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
