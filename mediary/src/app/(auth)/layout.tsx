import { Logo } from '@/components/logo';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="mb-8">
        <Logo size={26} />
        <p className="text-center text-sm text-muted mt-1">Store. Share. Control.</p>
      </div>
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6">{children}</div>
    </div>
  );
}
