'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';

const GOOGLE_ENABLED = process.env.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH === 'true';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push('/dashboard');
    } catch {
      setError('Incorrect email or password.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      router.push('/dashboard');
    } catch {
      setError('Google sign-in failed.');
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-semibold">Sign in</h1>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="text-sm text-muted mb-1 block">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg bg-surface2 border border-border px-3 py-2 text-sm focus-ring"
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm text-muted">Password</label>
            <Link href="/forgot-password" className="text-xs text-accent hover:underline">
              Forgot password?
            </Link>
          </div>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg bg-surface2 border border-border px-3 py-2 text-sm focus-ring"
          />
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-accent text-accent-fg font-medium py-2.5 text-sm disabled:opacity-60 focus-ring"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      {GOOGLE_ENABLED && (
        <>
          <div className="flex items-center gap-3 text-xs text-muted">
            <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
          </div>
          <button
            onClick={handleGoogle}
            className="w-full rounded-lg border border-border py-2.5 text-sm font-medium hover:bg-surface2 focus-ring"
          >
            Continue with Google
          </button>
        </>
      )}

      <p className="text-center text-sm text-muted">
        No account?{' '}
        <Link href="/register" className="text-accent hover:underline">
          Create one
        </Link>
      </p>
    </div>
  );
}
