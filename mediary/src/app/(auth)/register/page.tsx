'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import { apiFetch, ApiError } from '@/lib/api-client';
import { isValidUsername } from '@/lib/utils';

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!isValidUsername(username.toLowerCase())) {
      setError('Usernames must be 3-20 characters: lowercase letters, numbers, underscore.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      try {
        await apiFetch('/api/users', { method: 'POST', body: JSON.stringify({ username }) });
      } catch (err) {
        // Roll the auth account back conceptually by signing out; the profile
        // write failed (e.g. username taken) so we surface that clearly.
        setError(err instanceof ApiError ? err.message : 'Could not create your profile.');
        setLoading(false);
        return;
      }
      await sendEmailVerification(cred.user);
      router.push('/dashboard');
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === 'auth/email-already-in-use') setError('That email is already registered.');
      else if (code === 'auth/weak-password') setError('Password is too weak.');
      else setError('Could not create your account.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-semibold">Create your account</h1>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="text-sm text-muted mb-1 block">Username</label>
          <input
            required
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            placeholder="xrezzky"
            className="w-full rounded-lg bg-surface2 border border-border px-3 py-2 text-sm focus-ring"
          />
          <p className="text-xs text-muted mt-1">mediary.app/u/{username || 'yourname'}</p>
        </div>
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
          <label className="text-sm text-muted mb-1 block">Password</label>
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
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="text-center text-sm text-muted">
        Already have an account?{' '}
        <Link href="/login" className="text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
