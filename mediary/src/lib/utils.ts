export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${value >= 100 ? Math.round(value) : value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Strips any characters that could be used to break out of a filename
 * context or inject markup when a name/description is rendered. We rely on
 * React's default text escaping for XSS safety in JSX, but we still reject
 * control characters and path separators so a filename can never be used to
 * manipulate a storage path or terminal output in logs/exports.
 */
export function sanitizeDisplayName(input: string): string {
  return input
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/[\/\\]/g, '_')
    .trim()
    .slice(0, 255);
}

export function sanitizeDescription(input: string): string {
  return input.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, 1000);
}

const RESERVED_USERNAMES = new Set([
  'admin', 'owner', 'api', 'login', 'register', 'logout', 'dashboard',
  'files', 'trash', 'settings', 'u', 'd', 'static', 'app', 'mediary',
  'about', 'help', 'support', 'root',
]);

export function isValidUsername(input: string): boolean {
  if (!/^[a-z0-9_]{3,20}$/.test(input)) return false;
  return !RESERVED_USERNAMES.has(input);
}

export function extensionOf(filename: string): string {
  const idx = filename.lastIndexOf('.');
  if (idx === -1 || idx === filename.length - 1) return '';
  return filename.slice(idx + 1).toLowerCase();
}

export type FileKind =
  | 'archive' | 'pdf' | 'image' | 'video' | 'audio' | 'code' | 'text' | 'folder' | 'unknown';

const EXT_KIND: Record<string, FileKind> = {
  zip: 'archive', rar: 'archive', '7z': 'archive', tar: 'archive', gz: 'archive',
  pdf: 'pdf',
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', svg: 'image', bmp: 'image',
  mp4: 'video', mov: 'video', webm: 'video', avi: 'video', mkv: 'video',
  mp3: 'audio', wav: 'audio', flac: 'audio', ogg: 'audio', m4a: 'audio',
  js: 'code', ts: 'code', tsx: 'code', jsx: 'code', py: 'code', java: 'code', c: 'code', cpp: 'code',
  cs: 'code', go: 'code', rs: 'code', php: 'code', rb: 'code', sh: 'code', pwn: 'code', json: 'code',
  html: 'code', css: 'code', sql: 'code', yaml: 'code', yml: 'code', cfg: 'code', ini: 'code',
  txt: 'text', md: 'text', log: 'text',
};

export function fileKindFromExtension(ext: string): FileKind {
  return EXT_KIND[ext.toLowerCase()] ?? 'unknown';
}
