'use client';

import { useEffect, useState } from 'react';
import { X, Copy, Check, Trash2 } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/api-client';
import { LINK_EXPIRY_OPTIONS, type FileDoc, type LinkExpiryOption, type ShareLinkDoc } from '@/types';

type LinkWithToken = Omit<ShareLinkDoc, 'tokenHash'> & { token?: string };

export function ShareModal({ file, onClose }: { file: FileDoc; onClose: () => void }) {
  const [visibility, setVisibility] = useState(file.visibility);
  const [links, setLinks] = useState<LinkWithToken[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [type, setType] = useState<'reusable' | 'one-time'>('reusable');
  const [expiry, setExpiry] = useState<LinkExpiryOption>('never');
  const [maxDownloads, setMaxDownloads] = useState<string>('');
  const [password, setPassword] = useState('');

  async function loadLinks() {
    try {
      const { links } = await apiFetch<{ links: LinkWithToken[] }>(`/api/files/${file.id}/share`);
      setLinks(links.filter((l) => !l.revoked));
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    loadLinks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.id]);

  async function updateVisibility(next: typeof visibility) {
    setVisibility(next);
    try {
      await apiFetch(`/api/files/${file.id}`, { method: 'PATCH', body: JSON.stringify({ visibility: next }) });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update visibility.');
    }
  }

  async function createLink() {
    setCreating(true);
    setError(null);
    try {
      const { link } = await apiFetch<{ link: LinkWithToken }>(`/api/files/${file.id}/share`, {
        method: 'POST',
        body: JSON.stringify({
          type,
          expiry,
          maxDownloads: maxDownloads ? Number(maxDownloads) : null,
          password: password || null,
        }),
      });
      setLinks((prev) => [link, ...prev]);
      setPassword('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create link.');
    } finally {
      setCreating(false);
    }
  }

  async function revokeLink(id: string) {
    await apiFetch(`/api/links/${id}`, { method: 'DELETE' });
    setLinks((prev) => prev.filter((l) => l.id !== id));
  }

  function copy(id: string, url: string) {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 p-0 md:p-4">
      <div className="w-full md:max-w-lg rounded-t-2xl md:rounded-2xl bg-surface border border-border p-5 space-y-5 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Share</h2>
            <p className="text-sm text-muted truncate max-w-[280px]">{file.name}</p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-text focus-ring rounded p-1">
            <X size={18} />
          </button>
        </div>

        <div>
          <p className="text-sm text-muted mb-2">Visibility</p>
          <div className="grid grid-cols-3 gap-2">
            {(['private', 'public', 'link'] as const).map((v) => (
              <button
                key={v}
                onClick={() => updateVisibility(v)}
                className={`rounded-lg border py-2 text-sm font-medium capitalize focus-ring ${
                  visibility === v ? 'border-accent bg-accent/10 text-accent' : 'border-border text-muted hover:bg-surface2'
                }`}
              >
                {v === 'link' ? 'Share link' : v}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted mt-2">
            {visibility === 'public' && 'Appears on your public profile and is downloadable by anyone.'}
            {visibility === 'private' && 'Only you can access this file.'}
            {visibility === 'link' && "Hidden from your profile — downloadable only by people with a link below."}
          </p>
        </div>

        <div className="border-t border-border pt-4 space-y-3">
          <p className="text-sm text-muted">Generate a link</p>
          <div className="grid grid-cols-2 gap-2">
            <select value={type} onChange={(e) => setType(e.target.value as never)} className="rounded-lg bg-surface2 border border-border px-2 py-2 text-sm focus-ring">
              <option value="reusable">Reusable</option>
              <option value="one-time">One-time</option>
            </select>
            <select value={expiry} onChange={(e) => setExpiry(e.target.value as LinkExpiryOption)} className="rounded-lg bg-surface2 border border-border px-2 py-2 text-sm focus-ring">
              {LINK_EXPIRY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              min={1}
              placeholder="Max downloads (optional)"
              value={maxDownloads}
              onChange={(e) => setMaxDownloads(e.target.value)}
              className="rounded-lg bg-surface2 border border-border px-2 py-2 text-sm focus-ring"
            />
            <input
              type="password"
              placeholder="Password (optional)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-lg bg-surface2 border border-border px-2 py-2 text-sm focus-ring"
            />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <button
            onClick={createLink}
            disabled={creating}
            className="w-full rounded-lg bg-accent text-accent-fg text-sm font-medium py-2.5 disabled:opacity-60 focus-ring"
          >
            {creating ? 'Generating…' : 'Generate Link'}
          </button>
        </div>

        {links.length > 0 && (
          <div className="border-t border-border pt-4 space-y-2">
            <p className="text-sm text-muted">Active links</p>
            {links.map((l) => {
              const url = `${origin}/d/${l.token ?? l.id}`;
              return (
                <div key={l.id} className="flex items-center gap-2 rounded-lg bg-surface2 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-mono truncate">{l.token ? url : `${l.type} link · created`}</p>
                    <p className="text-xs text-muted">
                      {l.type} · {l.expiresAt ? `expires ${new Date(l.expiresAt).toLocaleDateString()}` : 'never expires'} ·{' '}
                      {l.downloadCount} download{l.downloadCount === 1 ? '' : 's'}
                      {l.maxDownloads ? ` / ${l.maxDownloads}` : ''}
                    </p>
                  </div>
                  {l.token && (
                    <button onClick={() => copy(l.id, url)} className="text-muted hover:text-text focus-ring rounded p-1">
                      {copiedId === l.id ? <Check size={16} className="text-accent" /> : <Copy size={16} />}
                    </button>
                  )}
                  <button onClick={() => revokeLink(l.id)} className="text-muted hover:text-danger focus-ring rounded p-1">
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
