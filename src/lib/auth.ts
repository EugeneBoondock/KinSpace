'use client'

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
  sendEmailVerification,
  signInWithPopup,
  GoogleAuthProvider,
  type User,
} from 'firebase/auth'
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from './firebase'

export interface AuthUser {
  userId: string
  username: string
  email: string | null
  displayName: string | null
  photoURL: string | null
  emailVerified: boolean
}

function mapFirebaseUser(user: User): AuthUser {
  return {
    userId: user.uid,
    username: user.displayName || user.email?.split('@')[0] || 'user',
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    emailVerified: user.emailVerified,
  }
}

export class AuthService {
  static async signUp(
    email: string,
    password: string,
    userData: { username: string; full_name: string }
  ) {
    const credential = await createUserWithEmailAndPassword(auth, email, password)
    const user = credential.user

    await updateProfile(user, {
      displayName: userData.full_name || userData.username,
    })

    // Create profile document in Firestore
    await setDoc(doc(db, 'profiles', user.uid), {
      email,
      username: userData.username,
      full_name: userData.full_name || userData.username,
      avatar_url: null,
      bio: null,
      location: null,
      conditions: [],
      comorbidities: [],
      medications: [],
      status: null,
      is_anonymous: false,
      age: null,
      interests: [],
      pronouns: null,
      followers: 0,
      following: 0,
      postsCount: 0,
      emergency_contact: null,
      emergency_phone: null,
      mental_health_goals: [],
      preferred_communication: 'chat',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    })

    await sendEmailVerification(user)
    return credential
  }

  static async signIn(email: string, password: string) {
    const credential = await signInWithEmailAndPassword(auth, email, password)
    return credential
  }

  static async signInWithGoogle() {
    const provider = new GoogleAuthProvider()
    const credential = await signInWithPopup(auth, provider)
    const user = credential.user

    // Create profile if it doesn't exist yet (first-time Google sign-in)
    const profileRef = doc(db, 'profiles', user.uid)
    const profileSnap = await getDoc(profileRef)
    const isNewUser = !profileSnap.exists()

    if (isNewUser) {
      await setDoc(profileRef, {
        email: user.email,
        username: user.displayName?.toLowerCase().replace(/\s+/g, '') || user.email?.split('@')[0] || 'user',
        full_name: user.displayName || '',
        avatar_url: user.photoURL || null,
        bio: null,
        location: null,
        conditions: [],
        comorbidities: [],
        medications: [],
        status: null,
        is_anonymous: false,
        age: null,
        interests: [],
        pronouns: null,
        followers: 0,
        following: 0,
        postsCount: 0,
        emergency_contact: null,
        emergency_phone: null,
        mental_health_goals: [],
        preferred_communication: 'chat',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        onboarding_complete: false,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      })
    }

    return { credential, isNewUser }
  }

  static async signOut() {
    await firebaseSignOut(auth)
  }

  static async getCurrentUser(): Promise<AuthUser | null> {
    return new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        unsubscribe()
        resolve(user ? mapFirebaseUser(user) : null)
      })
    })
  }

  static onAuthStateChange(callback: (user: AuthUser | null) => void) {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      callback(user ? mapFirebaseUser(user) : null)
    })
    return unsubscribe
  }
}
