import type { TripStore } from './types'

export const isFirebaseConfigured = Boolean(import.meta.env.VITE_FIREBASE_PROJECT_ID)

let storePromise: Promise<TripStore> | undefined

export function getStore(): Promise<TripStore> {
  storePromise ??= isFirebaseConfigured
    ? import('./firestore').then((m) => m.firestoreStore)
    : import('./local').then((m) => m.localStore)
  return storePromise
}

export type { TripStore }
