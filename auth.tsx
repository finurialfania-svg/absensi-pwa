import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from './firebase'

type Profile = { name: string; nim: string; email: string; role: 'admin' | 'student' }
type AuthState = { user: User | null; profile: Profile | null; loading: boolean; refreshProfile: () => Promise<void> }
const Context = createContext<AuthState>({ user: null, profile: null, loading: true, refreshProfile: async () => {} })
export const useAuth = () => useContext(Context)

export async function ensureProfile(user: User, name = '', nim = '') {
  const ref = doc(db, 'users', user.uid)
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    await setDoc(ref, { name: name || user.displayName || 'Mahasiswa', nim, email: user.email || '', role: 'student', createdAt: serverTimestamp() })
  }
}
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const refreshProfile = async () => {
    if (!auth.currentUser) { setProfile(null); return }
    await ensureProfile(auth.currentUser)
    const snap = await getDoc(doc(db, 'users', auth.currentUser.uid))
    setProfile(snap.exists() ? snap.data() as Profile : null)
  }
  useEffect(() => onAuthStateChanged(auth, async current => {
    setUser(current)
    if (current) {
      try { await ensureProfile(current); const s = await getDoc(doc(db, 'users', current.uid)); setProfile(s.exists() ? s.data() as Profile : null) }
      catch (e) { console.error(e); setProfile(null) }
    } else setProfile(null)
    setLoading(false)
  }), [])
  return <Context.Provider value={{ user, profile, loading, refreshProfile }}>{children}</Context.Provider>
}