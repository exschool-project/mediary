import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import Link from 'next/link';
import { FileIcon } from '@/components/file-icon';
import { Logo } from '@/components/logo';
import { formatBytes } from '@/lib/utils';

interface ProfileFile {
  id: string;
  name: string;
  description: string | null;
  size: number;
  extension: string;
  isFolder: boolean;
  downloadCount: number;
  createdAt: number;
}

async function getProfile(username: string) {
  const h = headers();
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const host = h.get('host');
  const res = await fetch(`${proto}://${host}/api/profile/${username}`, { cache: 'no-store' });
  if (res.status === 404) return null;
  return res.json() as Promise<{
    user: { username: string; displayName: string; avatarUrl: string | null; bio: string | null };
    files: ProfileFile[];
  }>;
}

export default async function PublicProfilePage({ params }: { params: { username: string } }) {
  const data = await getProfile(params.username);
  if (!data) notFound();
  const { user, files } = data;

  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-center justify-between">
          <Link href="/"><Logo size={18} /></Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-10 space-y-8">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-surface2 flex items-center justify-center text-xl font-semibold shrink-0">
            {user.username.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl font-semibold">{user.displayName}</h1>
            <p className="text-muted text-sm">@{user.username}</p>
            {user.bio && <p className="text-sm mt-1">{user.bio}</p>}
          </div>
        </div>

        <div>
          <h2 className="font-semibold mb-3">Public Files</h2>
          {files.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center">
              <p className="font-medium">No public files.</p>
              <p className="text-sm text-muted mt-1">This user hasn&apos;t published any files yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {files.map((f) => (
                <div key={f.id} className="rounded-2xl border border-border bg-surface p-4 flex items-center gap-4">
                  <FileIcon extension={f.extension} isFolder={f.isFolder} size={26} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{f.name}</p>
                    {f.description && <p className="text-sm text-muted truncate">{f.description}</p>}
                    <p className="text-xs text-muted font-mono mt-0.5">{formatBytes(f.size)}</p>
                  </div>
                  {!f.isFolder && (
                    <Link
                      href={`/d/${f.id}`}
                      className="shrink-0 rounded-lg bg-accent text-accent-fg text-sm font-medium px-4 py-2 focus-ring"
                    >
                      Download
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
