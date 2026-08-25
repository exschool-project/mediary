import { formatBytes } from '@/lib/utils';

export function StorageBar({ usedBytes, quotaBytes }: { usedBytes: number; quotaBytes: number }) {
  const pct = Math.min(100, (usedBytes / quotaBytes) * 100);
  const isFull = usedBytes >= quotaBytes;
  const isNear = pct >= 85;

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-muted">Storage</span>
        <span className="font-mono tabular">
          {formatBytes(usedBytes)} / {formatBytes(quotaBytes)}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-surface2 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isFull ? 'bg-danger' : isNear ? 'bg-amber-400' : 'bg-accent'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {isFull && (
        <p className="text-xs text-danger">
          You are using {formatBytes(usedBytes)} of {formatBytes(quotaBytes)}. Delete existing files before
          uploading more.
        </p>
      )}
    </div>
  );
}
