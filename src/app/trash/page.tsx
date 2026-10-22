'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RotateCcw, Trash2 } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { FileIcon } from '@/components/file-icon';
import { useAuth } from '@/components/auth-provider';
import { apiFetch } from '@/lib/api-client';
import { formatBytes } from '@/lib/utils';
import type { FileDoc } from '@/types';

export default function TrashPage() {
  const { firebaseUser, loading } = useAuth();
  const router = useRouter();
  const [files, setFiles] = useState<FileDoc[]>([]);

  useEffect(() => {
    if (!loading && !firebaseUser) router.push('/login');
  }, [loading, firebaseUser, router]);

  async function load() {
    const { files } = await apiFetch<{ files: FileDoc[] }>('/api/files?trash=1');
    setFiles(files);
  }

  useEffect(() => {
    if (firebaseUser) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseUser]);

  async function restore(f: FileDoc) {
    await apiFetch(`/api/files/${f.id}`, { method: 'PATCH', body: JSON.stringify({ restore: true }) });
    await load();
  }

  async function deleteForever(f: FileDoc) {
    if (!confirm(`Permanently delete "${f.name}"? This cannot be undone.`)) return;
    await apiFetch(`/api/files/${f.id}?permanent=1`, { method: 'DELETE' });
    await load();
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted">Loading…</div>;

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto px-5 md:px-8 py-8 space-y-5">
        <h1 className="text-xl font-semibold">Trash</h1>

        {files.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center">
            <p className="font-medium">Trash is empty.</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-surface divide-y divide-border overflow-hidden">
            {files.map((f) => (
              <div key={f.id} className="flex items-center gap-3 px-4 py-3">
                <FileIcon extension={f.extension} isFolder={f.isFolder} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{f.name}</p>
                  <p className="text-xs text-muted">{f.isFolder ? 'Folder' : formatBytes(f.size)}</p>
                </div>
                <button onClick={() => restore(f)} className="p-2 text-muted hover:text-accent focus-ring rounded-lg" title="Restore">
                  <RotateCcw size={16} />
                </button>
                <button onClick={() => deleteForever(f)} className="p-2 text-muted hover:text-danger focus-ring rounded-lg" title="Delete Permanently">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
