'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { UploadModal } from '@/components/upload-modal';
import { StorageBar } from '@/components/storage-bar';
import { FileIcon } from '@/components/file-icon';
import { useAuth } from '@/components/auth-provider';
import { apiFetch, ApiError } from '@/lib/api-client';
import { formatBytes, isValidUsername } from '@/lib/utils';
import type { FileDoc } from '@/types';

export default function DashboardPage() {
  const { firebaseUser, profile, loading, profileError, refreshProfile } = useAuth();
  const router = useRouter();
  const [recent, setRecent] = useState<FileDoc[]>([]);
  const [showUpload, setShowUpload] = useState(false);
  const [filesError, setFilesError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !firebaseUser) router.push('/login');
  }, [loading, firebaseUser, router]);

  async function loadRecent() {
    try {
      const { files } = await apiFetch<{ files: FileDoc[] }>('/api/files');
      setRecent(files.sort((a, b) => b.createdAt - a.createdAt).slice(0, 6));
      setFilesError(null);
    } catch (err) {
      setFilesError(err instanceof Error ? err.message : 'Could not load files.');
    }
  }

  useEffect(() => {
    if (profile) loadRecent();
  }, [profile]);

  // The profile may have been created a moment after sign-in (e.g. right
  // after registering). Re-check once before asking the user to create one.
  const [rechecked, setRechecked] = useState(false);
  useEffect(() => {
    if (!loading && firebaseUser && !profile && !rechecked) {
      setRechecked(true);
      refreshProfile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, firebaseUser, profile, rechecked]);

  async function handleUploaded() {
    await refreshProfile();
    await loadRecent();
  }

  if (loading || !firebaseUser || (!profile && !rechecked)) {
    return <div className="min-h-screen flex items-center justify-center text-muted">Loading…</div>;
  }

  if (!profile) {
    return <CreateProfile onDone={refreshProfile} loadError={profileError} />;
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
          {filesError && <p className="text-sm text-danger mb-3">{filesError}</p>}
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


// Shown when a user is signed in but has no Firestore profile yet (e.g. the
// profile write failed during registration, or they signed in with Google).
function CreateProfile({ onDone, loadError }: { onDone: () => Promise<unknown>; loadError: string | null }) {
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isValidUsername(username)) {
      setError('Usernames must be 3-20 characters: lowercase letters, numbers, underscore.');
      return;
    }
    setBusy(true);
    try {
      await apiFetch('/api/users', { method: 'POST', body: JSON.stringify({ username }) });
      await onDone();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && /already exists/i.test(err.message)) {
        // Profile is already there; just load it.
        await onDone();
      } else {
        setError(err instanceof ApiError ? err.message : 'Could not create your profile.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-5">
      <form onSubmit={submit} className="w-full max-w-sm space-y-3">
        <h1 className="text-lg font-semibold">Finish setting up your profile</h1>
        <input
          required
          value={username}
          onChange={(e) => setUsername(e.target.value.toLowerCase())}
          placeholder="username"
          className="w-full rounded-lg bg-surface2 border border-border px-3 py-2 text-sm focus-ring"
        />
        {(error || loadError) && <p className="text-sm text-danger">{error ?? loadError}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-accent text-accent-fg font-medium py-2.5 text-sm disabled:opacity-60 focus-ring"
        >
          {busy ? 'Saving…' : 'Create profile'}
        </button>
      </form>
    </div>
  );
}
