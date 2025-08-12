
'use client'

import { supabase } from './supabase'
import { User } from '@supabase/supabase-js'

export interface AuthUser extends User {
  profile?: {
    username: string
    full_name: string
    avatar_url: string | null
    bio: string | null
  }
}

export class AuthService {
  static async signUp(email: string, password: string, userData: {
    username: string
    full_name: string
  }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) throw error

    if (data.user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: data.user.id,
          email,
          username: userData.username,
          full_name: userData.full_name,
          preferred_communication: 'app',
        })

      if (profileError) throw profileError
    }

    return data
  }

  static async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) throw error
    return data
  }

  static async signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  static async getCurrentUser(): Promise<AuthUser | null> {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return null

    const { data: profile } = await supabase
      .from('profiles')
      .select('username, full_name, avatar_url, bio')
      .eq('id', user.id)
      .single()

    return {
      ...user,
      profile
    }
  }

  static onAuthStateChange(callback: (user: AuthUser | null) => void) {
    return supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('username, full_name, avatar_url, bio')
          .eq('id', session.user.id)
          .single()

        callback({
          ...session.user,
          profile
        })
      } else {
        callback(null)
      }
    })
  }
}
