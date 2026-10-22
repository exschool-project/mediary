import Link from 'next/link';
import { Logo } from '@/components/logo';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border">
        <div className="max-w-5xl mx-auto px-5 py-4 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-3 text-sm">
            <Link href="/login" className="text-muted hover:text-text">Sign in</Link>
            <Link href="/register" className="rounded-lg bg-accent text-accent-fg px-4 py-2 font-medium">Get started</Link>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center">
        <div className="max-w-3xl mx-auto px-5 py-20 text-center space-y-6">
          <p className="text-accent font-mono text-sm tracking-wide uppercase">Store. Share. Control.</p>
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight">
            File hosting that stays out of your way.
          </h1>
          <p className="text-muted text-lg max-w-xl mx-auto">
            Upload anything, decide who sees it, and hand out links that expire exactly when you want them to.
            1&nbsp;GB free, every account.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Link href="/register" className="rounded-xl bg-accent text-accent-fg px-6 py-3 font-medium">
              Create free account
            </Link>
            <Link href="/login" className="rounded-xl border border-border px-6 py-3 font-medium hover:bg-surface2">
              Sign in
            </Link>
          </div>
        </div>
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted">
        Mediary — Store. Share. Control.
      </footer>
    </div>
  );
}
