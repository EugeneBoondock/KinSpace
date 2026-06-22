'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { AuthService, type AuthUser } from './auth'

interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = AuthService.onAuthStateChange((authUser) => {
      setUser(authUser)
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  // Expose auth state to CSS so the page shell only reserves the fixed-sidebar
  // gutter for signed-in members. Anonymous visitors on public pages (e.g.
  // /conditions) then render with the marketing chrome, not the app sidebar.
  useEffect(() => {
    if (typeof document === 'undefined') return
    document.documentElement.dataset.authed = user ? 'true' : 'false'
  }, [user])

  const signOut = async () => {
    await AuthService.signOut()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
