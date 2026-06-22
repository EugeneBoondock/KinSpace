'use client'

import {
  signUpAction,
  signInAction,
  signOutAction,
  requestPasswordResetAction,
} from '@/app/actions/auth'

export interface AuthUser {
  userId: string
  username: string
  email: string | null
  displayName: string | null
  photoURL: string | null
  emailVerified: boolean
}

/**
 * Client-side auth API backed by the Cloudflare session system. Preserves the
 * surface the app already uses (getCurrentUser, onAuthStateChange, signOut,
 * signIn/signUp/signInWithGoogle, sendPasswordReset).
 */
export class AuthService {
  static async getCurrentUser(): Promise<AuthUser | null> {
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' })
      if (!res.ok) return null
      const data = (await res.json()) as { user: AuthUser | null }
      return data.user
    } catch {
      return null
    }
  }

  static onAuthStateChange(callback: (user: AuthUser | null) => void): () => void {
    let active = true
    this.getCurrentUser()
      .then((user) => active && callback(user))
      .catch(() => active && callback(null))
    return () => {
      active = false
    }
  }

  static async signUp(
    email: string,
    password: string,
    userData: { username: string; full_name: string },
    turnstileToken?: string,
  ) {
    const result = await signUpAction(
      { email, password, username: userData.username, fullName: userData.full_name },
      turnstileToken,
    )
    if (!result.ok) throw new Error(result.error)
    return result
  }

  static async signIn(email: string, password: string, turnstileToken?: string) {
    const result = await signInAction({ email, password }, turnstileToken)
    if (!result.ok) throw new Error(result.error)
    return result
  }

  static signInWithGoogle() {
    window.location.href = '/api/auth/google'
  }

  static async signOut() {
    await signOutAction()
  }

  static async sendPasswordReset(email: string) {
    await requestPasswordResetAction({ email })
  }
}
