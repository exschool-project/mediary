'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import { apiFetch } from '@/lib/api-client';
import type { UserDoc } from '@/types';

interface AuthState {
  firebaseUser: User | null;
  profile: UserDoc | null;
  loading: boolean;
  profileError: string | null;
  refreshProfile: () => Promise<UserDoc | null>;
}

const AuthContext = createContext<AuthState>({
  firebaseUser: null,
  profile: null,
  loading: true,
  profileError: null,
  refreshProfile: async () => null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  async function refreshProfile(): Promise<UserDoc | null> {
    if (!auth.currentUser) {
      setProfile(null);
      return null;
    }
    try {
      const { user } = await apiFetch<{ user: UserDoc | null }>('/api/users');
      setProfile(user);
      setProfileError(null);
      return user;
    } catch (err) {
      setProfile(null);
      setProfileError(err instanceof Error ? err.message : 'Could not load profile.');
      return null;
    }
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setFirebaseUser(u);
      if (u) {
        await refreshProfile();
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  return (
    <AuthContext.Provider value={{ firebaseUser, profile, loading, profileError, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
