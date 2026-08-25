'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { UploadModal } from '@/components/upload-modal';
import { StorageBar } from '@/components/storage-bar';
import { FileIcon } from '@/components/file-icon';
import { useAuth } from '@/components/auth-provider';
import { apiFetch } from '@/lib/api-client';
import { formatBytes } from '@/lib/utils';
import type { FileDoc } from '@/types';

export default function DashboardPage() {
  const { firebaseUser, profile, loading, refreshProfile } = useAuth();
  const router = useRouter();
  const [recent, setRecent] = useState<FileDoc[]>([]);
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => {
    if (!loading && !firebaseUser) router.push('/login');
  }, [loading, firebaseUser, router]);

  async function loadRecent() {
    try {
      const { files } = await apiFetch<{ files: FileDoc[] }>('/api/files');
      setRecent(files.sort((a, b) => b.createdAt - a.createdAt).slice(0, 6));
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (profile) loadRecent();
  }, [profile]);

  async function handleUploaded() {
    await refreshProfile();
    await loadRecent();
  }

  if (loading || !profile) {
    return <div className="min-h-screen flex items-center justify-center text-muted">Loading…</div>;
  }

  const publicCount = 0; // computed on Files page; kept light here
  void publicCount;

  return (
    <AppShell onUpload={() => setShowUpload(true)}>
      <div className="max-w-4xl mx-auto px-5 md:px-8 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Welcome back, {profile.displayName}</h1>
          <p className="text-muted text-sm mt-1">@{profile.username}</p>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5">
          <StorageBar usedBytes={profile.usedBytes} quotaBytes={profile.quotaBytes} />
          <button
            onClick={() => setShowUpload(true)}
            className="mt-4 rounded-lg bg-accent text-accent-fg text-sm font-medium px-4 py-2 focus-ring"
          >
            Upload files
          </button>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Recent Files</h2>
            <Link href="/files" className="text-sm text-accent hover:underline">
              View all
            </Link>
          </div>

          {recent.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center">
              <p className="font-medium">No files yet.</p>
              <p className="text-sm text-muted mt-1">Upload your first file to get started.</p>
              <button
                onClick={() => setShowUpload(true)}
                className="mt-4 rounded-lg bg-accent text-accent-fg text-sm font-medium px-4 py-2 focus-ring"
              >
                Upload File
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-surface divide-y divide-border overflow-hidden">
              {recent.map((f) => (
                <div key={f.id} className="flex items-center gap-3 px-4 py-3">
                  <FileIcon extension={f.extension} isFolder={f.isFolder} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{f.name}</p>
                    <p className="text-xs text-muted">{f.isFolder ? 'Folder' : formatBytes(f.size)}</p>
                  </div>
                  <span className="text-xs rounded-full px-2 py-0.5 bg-surface2 text-muted capitalize">{f.visibility}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showUpload && (
        <UploadModal folderId={null} onClose={() => setShowUpload(false)} onUploaded={handleUploaded} />
      )}
    </AppShell>
  );
}
