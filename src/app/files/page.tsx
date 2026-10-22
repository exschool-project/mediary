'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Grid3x3, List, Search, FolderPlus, ChevronRight, MoreVertical, Share2, Trash2, Pencil, Download,
} from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { UploadModal } from '@/components/upload-modal';
import { ShareModal } from '@/components/share-modal';
import { FileIcon } from '@/components/file-icon';
import { useAuth } from '@/components/auth-provider';
import { apiFetch, ApiError } from '@/lib/api-client';
import { formatBytes, formatDate } from '@/lib/utils';
import type { FileDoc } from '@/types';

type SortKey = 'name' | 'size' | 'type' | 'createdAt' | 'updatedAt';

export default function FilesPage() {
  const { firebaseUser, loading } = useAuth();
  const router = useRouter();

  const [files, setFiles] = useState<FileDoc[]>([]);
  const [folderStack, setFolderStack] = useState<{ id: string; name: string }[]>([]);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [query, setQuery] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [shareTarget, setShareTarget] = useState<FileDoc | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const currentFolderId = folderStack.length ? folderStack[folderStack.length - 1]!.id : null;

  useEffect(() => {
    if (!loading && !firebaseUser) router.push('/login');
  }, [loading, firebaseUser, router]);

  async function load() {
    const params = currentFolderId ? `?folderId=${currentFolderId}` : '';
    try {
      const { files } = await apiFetch<{ files: FileDoc[] }>(`/api/files${params}`);
      setFiles(files);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (firebaseUser) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseUser, currentFolderId]);

  const visible = useMemo(() => {
    let list = files;
    if (query.trim()) list = list.filter((f) => f.name.toLowerCase().includes(query.toLowerCase()));
    return [...list].sort((a, b) => {
      // Folders first, always.
      if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
      switch (sortKey) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'size':
          return b.size - a.size;
        case 'type':
          return a.extension.localeCompare(b.extension);
        case 'createdAt':
          return b.createdAt - a.createdAt;
        case 'updatedAt':
          return b.updatedAt - a.updatedAt;
      }
    });
  }, [files, query, sortKey]);

  function openFolder(f: FileDoc) {
    setFolderStack((prev) => [...prev, { id: f.id, name: f.name }]);
  }

  function goToBreadcrumb(index: number) {
    setFolderStack((prev) => prev.slice(0, index + 1));
  }

  async function createFolder() {
    const name = prompt('Folder name');
    if (!name) return;
    setBusy(true);
    try {
      await apiFetch('/api/files', { method: 'POST', body: JSON.stringify({ name, folderId: currentFolderId }) });
      await load();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Could not create folder.');
    } finally {
      setBusy(false);
    }
  }

  async function rename(f: FileDoc) {
    const name = prompt('Rename to', f.name);
    if (!name || name === f.name) return;
    await apiFetch(`/api/files/${f.id}`, { method: 'PATCH', body: JSON.stringify({ name }) });
    await load();
  }

  async function moveToTrash(f: FileDoc) {
    if (!confirm(`Move "${f.name}" to Trash?`)) return;
    await apiFetch(`/api/files/${f.id}`, { method: 'DELETE' });
    await load();
  }

  async function downloadOwnFile(f: FileDoc) {
    // Owner downloads use the same public-token resolver: a public file's id
    // works directly; for private/link files the owner still needs a
    // generated share link (this action nudges them toward Share instead).
    if (f.visibility === 'private') {
      setShareTarget(f);
      return;
    }
    const res = await fetch(`/api/download/${f.id}`, { method: 'POST', body: JSON.stringify({}) });
    const data = await res.json();
    if (data.downloadUrl) window.location.href = data.downloadUrl;
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted">Loading…</div>;

  return (
    <AppShell onUpload={() => setShowUpload(true)}>
      <div className="max-w-5xl mx-auto px-5 md:px-8 py-8 space-y-5">
        <div className="flex items-center gap-1 text-sm text-muted">
          <button onClick={() => setFolderStack([])} className="hover:text-text focus-ring rounded">
            My Files
          </button>
          {folderStack.map((f, i) => (
            <span key={f.id} className="flex items-center gap-1">
              <ChevronRight size={14} />
              <button onClick={() => goToBreadcrumb(i)} className="hover:text-text focus-ring rounded">
                {f.name}
              </button>
            </span>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search files"
              className="w-full rounded-lg bg-surface2 border border-border pl-9 pr-3 py-2 text-sm focus-ring"
            />
          </div>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="rounded-lg bg-surface2 border border-border px-2 py-2 text-sm focus-ring"
          >
            <option value="name">Name</option>
            <option value="size">Size</option>
            <option value="type">Type</option>
            <option value="createdAt">Date uploaded</option>
            <option value="updatedAt">Date modified</option>
          </select>
          <button
            onClick={createFolder}
            disabled={busy}
            className="rounded-lg border border-border px-3 py-2 text-sm flex items-center gap-1.5 hover:bg-surface2 focus-ring"
          >
            <FolderPlus size={16} /> New folder
          </button>
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => setView('grid')}
              className={`p-2 focus-ring ${view === 'grid' ? 'bg-surface2' : ''}`}
            >
              <Grid3x3 size={16} />
            </button>
            <button
              onClick={() => setView('list')}
              className={`p-2 focus-ring ${view === 'list' ? 'bg-surface2' : ''}`}
            >
              <List size={16} />
            </button>
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center">
            <p className="font-medium">No files yet.</p>
            <p className="text-sm text-muted mt-1">Upload your first file to get started.</p>
          </div>
        ) : view === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {visible.map((f) => (
              <div key={f.id} className="group relative rounded-xl border border-border bg-surface p-4 hover:border-accent/50 transition-colors">
                <button
                  onClick={() => (f.isFolder ? openFolder(f) : undefined)}
                  className="flex flex-col items-start gap-3 w-full text-left"
                >
                  <FileIcon extension={f.extension} isFolder={f.isFolder} size={28} />
                  <div className="min-w-0 w-full">
                    <p className="text-sm font-medium truncate">{f.name}</p>
                    <p className="text-xs text-muted">{f.isFolder ? 'Folder' : formatBytes(f.size)}</p>
                  </div>
                </button>
                <span className="absolute top-3 left-3 opacity-0" />
                <FileMenu
                  open={menuOpenId === f.id}
                  onToggle={() => setMenuOpenId(menuOpenId === f.id ? null : f.id)}
                  onRename={() => rename(f)}
                  onShare={() => setShareTarget(f)}
                  onDelete={() => moveToTrash(f)}
                  onDownload={() => downloadOwnFile(f)}
                  isFolder={f.isFolder}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-surface divide-y divide-border overflow-hidden">
            {visible.map((f) => (
              <div key={f.id} className="flex items-center gap-3 px-4 py-3">
                <button
                  onClick={() => (f.isFolder ? openFolder(f) : undefined)}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left"
                >
                  <FileIcon extension={f.extension} isFolder={f.isFolder} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{f.name}</p>
                    <p className="text-xs text-muted font-mono">
                      {f.isFolder ? 'Folder' : formatBytes(f.size)} · {formatDate(f.createdAt)}
                    </p>
                  </div>
                </button>
                <span className="text-xs rounded-full px-2 py-0.5 bg-surface2 text-muted capitalize hidden sm:inline">
                  {f.visibility}
                </span>
                <FileMenu
                  open={menuOpenId === f.id}
                  onToggle={() => setMenuOpenId(menuOpenId === f.id ? null : f.id)}
                  onRename={() => rename(f)}
                  onShare={() => setShareTarget(f)}
                  onDelete={() => moveToTrash(f)}
                  onDownload={() => downloadOwnFile(f)}
                  isFolder={f.isFolder}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {showUpload && (
        <UploadModal folderId={currentFolderId} onClose={() => setShowUpload(false)} onUploaded={load} />
      )}
      {shareTarget && <ShareModal file={shareTarget} onClose={() => setShareTarget(null)} />}
    </AppShell>
  );
}

function FileMenu({
  open,
  onToggle,
  onRename,
  onShare,
  onDelete,
  onDownload,
  isFolder,
}: {
  open: boolean;
  onToggle: () => void;
  onRename: () => void;
  onShare: () => void;
  onDelete: () => void;
  onDownload: () => void;
  isFolder: boolean;
}) {
  return (
    <div className="absolute top-2 right-2">
      <button onClick={onToggle} className="p-1.5 rounded-lg text-muted hover:bg-surface2 hover:text-text focus-ring">
        <MoreVertical size={16} />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-40 rounded-lg border border-border bg-surface shadow-lg z-10 py-1 text-sm">
          {!isFolder && (
            <button onClick={onDownload} className="flex items-center gap-2 w-full px-3 py-2 hover:bg-surface2 text-left">
              <Download size={14} /> Download
            </button>
          )}
          <button onClick={onShare} className="flex items-center gap-2 w-full px-3 py-2 hover:bg-surface2 text-left">
            <Share2 size={14} /> Share
          </button>
          <button onClick={onRename} className="flex items-center gap-2 w-full px-3 py-2 hover:bg-surface2 text-left">
            <Pencil size={14} /> Rename
          </button>
          <button onClick={onDelete} className="flex items-center gap-2 w-full px-3 py-2 hover:bg-surface2 text-left text-danger">
            <Trash2 size={14} /> Delete
          </button>
        </div>
      )}
    </div>
  );
}
