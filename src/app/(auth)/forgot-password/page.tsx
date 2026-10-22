'use client';

import { useState } from 'react';
import Link from 'next/link';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email);
      setSent(true);
    } catch {
      // Do not reveal whether the email exists — same message either way.
      setSent(true);
    }
  }

  if (sent) {
    return (
      <div className="text-center space-y-3">
        <h1 className="text-lg font-semibold">Check your email</h1>
        <p className="text-sm text-muted">
          If an account exists for {email}, we&apos;ve sent a link to reset your password.
        </p>
        <Link href="/login" className="text-sm text-accent hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-semibold">Reset your password</h1>
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
        {error && <p className="text-sm text-danger">{error}</p>}
        <button
          type="submit"
          className="w-full rounded-lg bg-accent text-accent-fg font-medium py-2.5 text-sm focus-ring"
        >
          Send reset link
        </button>
      </form>
      <p className="text-center text-sm text-muted">
        <Link href="/login" className="text-accent hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
