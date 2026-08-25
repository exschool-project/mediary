'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, FolderOpen, Trash2, ShieldCheck, LogOut, Moon, Sun, Plus } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import { useAuth } from '@/components/auth-provider';
import { useTheme } from '@/components/theme-provider';
import { Logo } from '@/components/logo';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/files', label: 'My Files', icon: FolderOpen },
  { href: '/trash', label: 'Trash', icon: Trash2 },
];

export function AppShell({ children, onUpload }: { children: React.ReactNode; onUpload?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile } = useAuth();
  const { theme, toggle } = useTheme();

  async function handleLogout() {
    await signOut(auth);
    router.push('/login');
  }

  const nav = profile?.isOwner ? [...NAV, { href: '/owner', label: 'Owner', icon: ShieldCheck }] : NAV;

  return (
    <div className="min-h-screen flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border bg-surface p-4">
        <div className="px-2 py-3">
          <Logo />
        </div>

        {onUpload && (
          <button
            onClick={onUpload}
            className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-accent text-accent-fg font-medium py-2.5 focus-ring"
          >
            <Plus size={18} /> Upload
          </button>
        )}

        <nav className="mt-6 flex-1 space-y-1">
          {nav.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors focus-ring ${
                  active ? 'bg-surface2 text-text' : 'text-muted hover:bg-surface2 hover:text-text'
                }`}
              >
                <item.icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {profile && (
          <div className="mt-4 border-t border-border pt-4 space-y-3">
            <Link href={`/u/${profile.username}`} className="flex items-center gap-2 px-1 text-sm hover:underline">
              <div className="h-8 w-8 rounded-full bg-surface2 flex items-center justify-center text-xs font-semibold">
                {profile.username.slice(0, 2).toUpperCase()}
              </div>
              <div className="truncate">
                <p className="font-medium truncate">{profile.displayName}</p>
                <p className="text-xs text-muted truncate">@{profile.username}</p>
              </div>
            </Link>
            <div className="flex items-center gap-2">
              <button
                onClick={toggle}
                className="flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-sm text-muted hover:bg-surface2 focus-ring"
              >
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-sm text-muted hover:bg-surface2 focus-ring"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        )}
      </aside>

      <div className="flex-1 flex flex-col">
        <main className="flex-1 pb-24 md:pb-0">{children}</main>

        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-surface border-t border-border flex items-center justify-around py-2">
          {nav.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 text-[11px] font-medium ${
                  active ? 'text-accent' : 'text-muted'
                }`}
              >
                <item.icon size={20} />
                {item.label}
              </Link>
            );
          })}
          {onUpload && (
            <button onClick={onUpload} className="flex flex-col items-center gap-0.5 px-3 py-1.5 text-[11px] font-medium text-accent">
              <div className="h-9 w-9 -mt-6 rounded-full bg-accent text-accent-fg flex items-center justify-center shadow-lg">
                <Plus size={20} />
              </div>
              Upload
            </button>
          )}
        </nav>
      </div>
    </div>
  );
}
