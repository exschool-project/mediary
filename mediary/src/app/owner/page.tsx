'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/components/auth-provider';
import { apiFetch } from '@/lib/api-client';
import { formatBytes, formatDate } from '@/lib/utils';
import type { UserDoc, ReportReason, ReportStatus } from '@/types';

interface Stats {
  users: number;
  files: number;
  storageUsedBytes: number;
  downloads: number;
  activeLinks: number;
}

interface OwnerFile {
  id: string;
  name: string;
  ownerUsername: string;
  ownerId: string;
  size: number;
  visibility: string;
  isFolder: boolean;
  downloadCount: number;
  createdAt: number;
  deletedAt: number | null;
}

interface Report {
  id: string;
  fileId: string;
  reason: ReportReason;
  message: string | null;
  status: ReportStatus;
  createdAt: number;
}

type Tab = 'overview' | 'users' | 'files' | 'reports';

export default function OwnerPage() {
  const { profile, loading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [userQuery, setUserQuery] = useState('');
  const [files, setFiles] = useState<OwnerFile[]>([]);
  const [reports, setReports] = useState<Report[]>([]);

  useEffect(() => {
    if (!loading && profile && !profile.isOwner) router.push('/dashboard');
    if (!loading && !profile) router.push('/login');
  }, [loading, profile, router]);

  useEffect(() => {
    if (!profile?.isOwner) return;
    apiFetch<Stats>('/api/owner/stats').then(setStats).catch(() => {});
  }, [profile]);

  async function loadUsers(q?: string) {
    const { users } = await apiFetch<{ users: UserDoc[] }>(`/api/owner/users${q ? `?q=${q}` : ''}`);
    setUsers(users);
  }
  async function loadFiles() {
    const { files } = await apiFetch<{ files: OwnerFile[] }>('/api/owner/files');
    setFiles(files);
  }
  async function loadReports() {
    const { reports } = await apiFetch<{ reports: Report[] }>('/api/reports');
    setReports(reports);
  }

  useEffect(() => {
    if (!profile?.isOwner) return;
    if (tab === 'users') loadUsers();
    if (tab === 'files') loadFiles();
    if (tab === 'reports') loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, profile]);

  async function toggleSuspend(u: UserDoc) {
    await apiFetch('/api/owner/users', {
      method: 'PATCH',
      body: JSON.stringify({ uid: u.uid, isSuspended: !u.isSuspended }),
    });
    await loadUsers(userQuery);
  }

  async function changeQuota(u: UserDoc) {
    const input = prompt('New quota in MB', String(Math.round(u.quotaBytes / (1024 * 1024))));
    if (!input) return;
    const mb = Number(input);
    if (!Number.isFinite(mb) || mb <= 0) return;
    await apiFetch('/api/owner/users', {
      method: 'PATCH',
      body: JSON.stringify({ uid: u.uid, quotaBytes: mb * 1024 * 1024 }),
    });
    await loadUsers(userQuery);
  }

  async function deleteUser(u: UserDoc) {
    if (!confirm(`Permanently delete @${u.username} and all of their files? This cannot be undone.`)) return;
    await apiFetch('/api/owner/users', { method: 'DELETE', body: JSON.stringify({ uid: u.uid }) });
    await loadUsers(userQuery);
  }

  async function deleteFile(f: OwnerFile) {
    if (!confirm(`Remove "${f.name}"?`)) return;
    await apiFetch('/api/owner/files', { method: 'DELETE', body: JSON.stringify({ fileId: f.id }) });
    await loadFiles();
  }

  async function setReportStatus(r: Report, status: ReportStatus) {
    await apiFetch('/api/reports', { method: 'PATCH', body: JSON.stringify({ id: r.id, status }) });
    await loadReports();
  }

  if (loading || !profile?.isOwner) {
    return <div className="min-h-screen flex items-center justify-center text-muted">Loading…</div>;
  }

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-5 md:px-8 py-8 space-y-6">
        <h1 className="text-xl font-semibold">Mediary Owner</h1>

        <div className="flex gap-1 border-b border-border">
          {(['overview', 'users', 'files', 'reports'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-2 text-sm font-medium capitalize border-b-2 -mb-px ${
                tab === t ? 'border-accent text-text' : 'border-transparent text-muted hover:text-text'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'overview' && stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatCard label="Users" value={stats.users.toLocaleString()} />
            <StatCard label="Files" value={stats.files.toLocaleString()} />
            <StatCard label="Storage Used" value={formatBytes(stats.storageUsedBytes)} />
            <StatCard label="Downloads" value={stats.downloads.toLocaleString()} />
            <StatCard label="Active Links" value={stats.activeLinks.toLocaleString()} />
          </div>
        )}

        {tab === 'users' && (
          <div className="space-y-3">
            <input
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadUsers(userQuery)}
              placeholder="Search username…"
              className="rounded-lg bg-surface2 border border-border px-3 py-2 text-sm focus-ring w-full max-w-xs"
            />
            <div className="rounded-2xl border border-border bg-surface divide-y divide-border overflow-hidden overflow-x-auto">
              {users.map((u) => (
                <div key={u.uid} className="flex items-center gap-3 px-4 py-3 text-sm min-w-[600px]">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">@{u.username}</p>
                    <p className="text-xs text-muted truncate">{u.email}</p>
                  </div>
                  <span className="font-mono text-xs text-muted w-32">
                    {formatBytes(u.usedBytes)} / {formatBytes(u.quotaBytes)}
                  </span>
                  {u.isSuspended && <span className="text-xs rounded-full px-2 py-0.5 bg-danger/15 text-danger">Suspended</span>}
                  <button onClick={() => changeQuota(u)} className="text-xs text-accent hover:underline">Quota</button>
                  <button onClick={() => toggleSuspend(u)} className="text-xs text-accent hover:underline">
                    {u.isSuspended ? 'Unsuspend' : 'Suspend'}
                  </button>
                  {!u.isOwner && (
                    <button onClick={() => deleteUser(u)} className="text-xs text-danger hover:underline">Delete</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'files' && (
          <div className="rounded-2xl border border-border bg-surface divide-y divide-border overflow-hidden overflow-x-auto">
            {files.map((f) => (
              <div key={f.id} className="flex items-center gap-3 px-4 py-3 text-sm min-w-[600px]">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{f.name}</p>
                  <p className="text-xs text-muted">@{f.ownerUsername}</p>
                </div>
                <span className="font-mono text-xs text-muted w-20">{formatBytes(f.size)}</span>
                <span className="text-xs rounded-full px-2 py-0.5 bg-surface2 text-muted capitalize">{f.visibility}</span>
                <button onClick={() => deleteFile(f)} className="text-xs text-danger hover:underline">Remove</button>
              </div>
            ))}
          </div>
        )}

        {tab === 'reports' && (
          <div className="rounded-2xl border border-border bg-surface divide-y divide-border overflow-hidden">
            {reports.length === 0 && <p className="p-6 text-sm text-muted">No reports.</p>}
            {reports.map((r) => (
              <div key={r.id} className="px-4 py-3 text-sm space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium capitalize">{r.reason}</span>
                  <span className="text-xs text-muted">{formatDate(r.createdAt)}</span>
                </div>
                {r.message && <p className="text-muted text-xs">{r.message}</p>}
                <div className="flex gap-2 pt-1">
                  {(['pending', 'reviewing', 'resolved', 'dismissed'] as ReportStatus[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => setReportStatus(r, s)}
                      className={`text-xs rounded-full px-2 py-0.5 capitalize ${
                        r.status === s ? 'bg-accent/15 text-accent' : 'bg-surface2 text-muted'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-2xl font-semibold font-mono tabular mt-1">{value}</p>
    </div>
  );
}
