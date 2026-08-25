'use client';

import { useRef, useState } from 'react';
import { X, UploadCloud } from 'lucide-react';
import { ref as storageRef, uploadBytesResumable } from 'firebase/storage';
import { storage } from '@/lib/firebase/client';
import { apiFetch, ApiError } from '@/lib/api-client';
import { formatBytes } from '@/lib/utils';

interface UploadItem {
  key: string;
  name: string;
  size: number;
  progress: number; // 0-100
  status: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
}

export function UploadModal({
  folderId,
  onClose,
  onUploaded,
}: {
  folderId: string | null;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  async function uploadOne(file: File, relativePath: string | null) {
    const key = `${file.name}-${file.size}-${Math.random()}`;
    setItems((prev) => [...prev, { key, name: relativePath ?? file.name, size: file.size, progress: 0, status: 'pending' }]);

    try {
      // For folder uploads we still register a single flat file entry per
      // real file, using `/` in the display name to preserve the folder
      // structure visually. A real folder-tree implementation would create
      // intermediate folder documents per path segment; simplified here.
      const { fileId, storagePath } = await apiFetch<{ fileId: string; storagePath: string }>(
        '/api/files/upload',
        {
          method: 'POST',
          body: JSON.stringify({
            name: relativePath ?? file.name,
            size: file.size,
            mimeType: file.type || 'application/octet-stream',
            folderId,
          }),
        }
      );

      setItems((prev) => prev.map((i) => (i.key === key ? { ...i, status: 'uploading' } : i)));

      await new Promise<void>((resolve, reject) => {
        const task = uploadBytesResumable(storageRef(storage, storagePath), file);
        task.on(
          'state_changed',
          (snap) => {
            const progress = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
            setItems((prev) => prev.map((i) => (i.key === key ? { ...i, progress } : i)));
          },
          (err) => reject(err),
          () => resolve()
        );
      });

      await apiFetch('/api/files/upload/complete', { method: 'POST', body: JSON.stringify({ fileId }) });
      setItems((prev) => prev.map((i) => (i.key === key ? { ...i, status: 'done', progress: 100 } : i)));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Upload failed.';
      setItems((prev) => prev.map((i) => (i.key === key ? { ...i, status: 'error', error: message } : i)));
    }
  }

  async function handleFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    await Promise.all(
      files.map((f) => {
        // webkitRelativePath is populated for folder-input selections and
        // preserves the folder structure instead of flattening it.
        const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath;
        return uploadOne(f, rel && rel.length > 0 ? rel : null);
      })
    );
    onUploaded();
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
  }

  const allDone = items.length > 0 && items.every((i) => i.status === 'done' || i.status === 'error');

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 p-0 md:p-4">
      <div className="w-full md:max-w-lg rounded-t-2xl md:rounded-2xl bg-surface border border-border p-5 space-y-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Upload</h2>
          <button onClick={onClose} className="text-muted hover:text-text focus-ring rounded p-1">
            <X size={18} />
          </button>
        </div>

        {items.length === 0 && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
              dragOver ? 'border-accent bg-accent/5' : 'border-border'
            }`}
          >
            <UploadCloud className="mx-auto mb-3 text-muted" size={32} />
            <p className="text-sm text-muted mb-4">Drag files here, or</p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg bg-accent text-accent-fg text-sm font-medium px-4 py-2 focus-ring"
              >
                Choose Files
              </button>
              <button
                onClick={() => folderInputRef.current?.click()}
                className="rounded-lg border border-border text-sm font-medium px-4 py-2 hover:bg-surface2 focus-ring"
              >
                Choose Folder
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
            />
            <input
              ref={folderInputRef}
              type="file"
              multiple
              // @ts-expect-error non-standard attribute for folder selection
              webkitdirectory=""
              directory=""
              className="hidden"
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
            />
            <p className="text-xs text-muted mt-4">ZIP files upload like any other file — up to your remaining storage.</p>
          </div>
        )}

        {items.length > 0 && (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.key} className="text-sm">
                <div className="flex justify-between mb-1">
                  <span className="truncate max-w-[70%] font-mono">{item.name}</span>
                  <span className="text-muted tabular font-mono">
                    {item.status === 'error' ? 'Failed' : `${formatBytes((item.size * item.progress) / 100)} / ${formatBytes(item.size)}`}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-surface2 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${item.status === 'error' ? 'bg-danger' : 'bg-accent'}`}
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
                {item.error && <p className="text-xs text-danger mt-1">{item.error}</p>}
              </div>
            ))}
            {allDone && (
              <button
                onClick={onClose}
                className="w-full rounded-lg bg-surface2 py-2.5 text-sm font-medium hover:bg-border focus-ring"
              >
                Done
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
