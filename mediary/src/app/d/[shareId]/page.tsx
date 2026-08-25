'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Lock, Download as DownloadIcon, Copy, Check } from 'lucide-react';
import { FileIcon } from '@/components/file-icon';
import { Logo } from '@/components/logo';
import { formatBytes, formatDate } from '@/lib/utils';

interface FileInfo {
  name: string;
  description: string | null;
  size: number;
  extension: string;
  downloadCount: number;
  createdAt: number;
  uploader: string;
}

type PageState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; file: FileInfo; requiresPassword: boolean }
  | { kind: 'preparing'; file: FileInfo }
  | { kind: 'granted'; file: FileInfo; url: string };

export default function DownloadPage() {
  const { shareId } = useParams<{ shareId: string }>();
  const [state, setState] = useState<PageState>({ kind: 'loading' });
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/download/${shareId}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setState({ kind: 'error', message: data.error ?? 'This file is unavailable.' });
          return;
        }
        setState({ kind: 'ready', file: data.file, requiresPassword: data.requiresPassword });
      })
      .catch(() => setState({ kind: 'error', message: 'This file is unavailable.' }));
  }, [shareId]);

  async function requestDownload() {
    if (state.kind !== 'ready') return;
    const file = state.file;
    setPasswordError(null);
    setState({ kind: 'preparing', file });
    try {
      const res = await fetch(`/api/download/${shareId}`, {
        method: 'POST',
        body: JSON.stringify({ password: password || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          setPasswordError(data.error ?? 'Incorrect password.');
          setState({ kind: 'ready', file, requiresPassword: true });
          return;
        }
        setState({ kind: 'error', message: data.error ?? 'Download unavailable.' });
        return;
      }
      setState({ kind: 'granted', file, url: data.downloadUrl });
      window.location.href = data.downloadUrl;
    } catch {
      setState({ kind: 'error', message: 'Download unavailable.' });
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-10">
      <Link href="/" className="mb-10">
        <Logo size={20} />
      </Link>

      {state.kind === 'loading' && <p className="text-muted text-sm">Loading…</p>}

      {state.kind === 'error' && (
        <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-8 text-center space-y-2">
          <p className="font-semibold">File not found.</p>
          <p className="text-sm text-muted">{state.message}</p>
        </div>
      )}

      {(state.kind === 'ready' || state.kind === 'preparing' || state.kind === 'granted') && (
        <div className="w-full max-w-sm rounded-2xl border border-border bg-surface overflow-hidden">
          <div className="p-8 flex flex-col items-center text-center gap-3">
            <FileIcon extension={state.file.extension} size={48} />
            <h1 className="font-semibold text-lg break-all">{state.file.name}</h1>
            {state.file.description && <p className="text-sm text-muted">{state.file.description}</p>}
            <p className="text-sm text-muted font-mono uppercase tracking-wide">
              {formatBytes(state.file.size)} {state.file.extension && `· ${state.file.extension}`}
            </p>
          </div>

          <div className="perforation" />

          <div className="p-8 space-y-4">
            {state.kind === 'ready' && state.requiresPassword && (
              <div className="space-y-2">
                <label className="text-sm text-muted flex items-center gap-1.5">
                  <Lock size={14} /> This link is password protected
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full rounded-lg bg-surface2 border border-border px-3 py-2 text-sm focus-ring"
                />
                {passwordError && <p className="text-xs text-danger">{passwordError}</p>}
              </div>
            )}

            <button
              onClick={requestDownload}
              disabled={state.kind === 'preparing'}
              className="w-full rounded-xl bg-accent text-accent-fg font-semibold py-3 flex items-center justify-center gap-2 disabled:opacity-70 focus-ring"
            >
              <DownloadIcon size={18} />
              {state.kind === 'preparing' ? 'Preparing download…' : 'DOWNLOAD FILE'}
            </button>

            <button
              onClick={copyLink}
              className="w-full rounded-xl border border-border py-2.5 text-sm font-medium flex items-center justify-center gap-2 hover:bg-surface2 focus-ring"
            >
              {copied ? <Check size={16} className="text-accent" /> : <Copy size={16} />}
              {copied ? 'Copied' : 'Copy link'}
            </button>

            <p className="text-xs text-muted text-center pt-1">
              Uploaded by <span className="font-medium text-text">{state.file.uploader}</span> · {formatDate(state.file.createdAt)}
            </p>
          </div>
        </div>
      )}

      <p className="text-xs text-muted mt-6">Secure download powered by Mediary</p>
    </div>
  );
}
