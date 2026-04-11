import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'
import { getStorage, type FirebaseStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
}

function getFirebaseApp(): FirebaseApp {
  return getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()
}

// Only initialize on client side to avoid SSR/prerender issues
export const auth: Auth = typeof window !== 'undefined'
  ? getAuth(getFirebaseApp())
  : (null as unknown as Auth)

export const db: Firestore = typeof window !== 'undefined'
  ? getFirestore(getFirebaseApp())
  : (null as unknown as Firestore)

export const storage: FirebaseStorage = typeof window !== 'undefined'
  ? getStorage(getFirebaseApp())
  : (null as unknown as FirebaseStorage)

export default getFirebaseApp
