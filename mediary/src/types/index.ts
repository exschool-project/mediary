export type Visibility = 'private' | 'public' | 'link';

export interface UserDoc {
  uid: string;
  username: string;
  usernameLower: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  quotaBytes: number; // default 1 GiB, owner-adjustable
  usedBytes: number; // authoritative server-tracked usage
  isSuspended: boolean;
  isOwner: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface FileDoc {
  id: string;
  ownerId: string;
  ownerUsername: string;
  name: string;
  originalName: string;
  description: string | null;
  mimeType: string;
  extension: string;
  size: number;
  storagePath: string;
  visibility: Visibility;
  folderId: string | null;
  isFolder: boolean;
  downloadCount: number;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null; // trash marker; null = active
}

export type LinkType = 'reusable' | 'one-time';

export interface ShareLinkDoc {
  id: string;
  fileId: string;
  ownerId: string;
  tokenHash: string; // sha256 of the raw token; raw token never stored
  type: LinkType;
  expiresAt: number | null;
  maxDownloads: number | null;
  downloadCount: number;
  passwordHash: string | null; // bcrypt hash, never plaintext
  revoked: boolean;
  consumed: boolean; // set atomically for one-time links
  createdAt: number;
}

export type ReportReason = 'abuse' | 'malware' | 'illegal' | 'spam' | 'copyright' | 'other';
export type ReportStatus = 'pending' | 'reviewing' | 'resolved' | 'dismissed';

export interface ReportDoc {
  id: string;
  fileId: string;
  reporterId: string | null;
  reason: ReportReason;
  message: string | null;
  status: ReportStatus;
  createdAt: number;
  updatedAt: number;
}

export interface AuditLogDoc {
  id: string;
  actorId: string;
  action:
    | 'file.upload'
    | 'file.delete'
    | 'file.restore'
    | 'file.visibility_change'
    | 'link.create'
    | 'link.revoke'
    | 'file.download'
    | 'owner.suspend_user'
    | 'owner.unsuspend_user'
    | 'owner.delete_user'
    | 'owner.change_quota'
    | 'owner.delete_file';
  targetId: string | null;
  metadata: Record<string, string | number | boolean> | null;
  createdAt: number;
}

export const DEFAULT_QUOTA_BYTES = 1 * 1024 * 1024 * 1024; // 1 GiB

export const LINK_EXPIRY_OPTIONS = [
  { label: 'Never', value: 'never' },
  { label: '1 hour', value: '1h' },
  { label: '6 hours', value: '6h' },
  { label: '1 day', value: '1d' },
  { label: '7 days', value: '7d' },
  { label: '30 days', value: '30d' },
] as const;

export type LinkExpiryOption = (typeof LINK_EXPIRY_OPTIONS)[number]['value'];

export function expiryOptionToMs(option: LinkExpiryOption): number | null {
  switch (option) {
    case 'never':
      return null;
    case '1h':
      return 60 * 60 * 1000;
    case '6h':
      return 6 * 60 * 60 * 1000;
    case '1d':
      return 24 * 60 * 60 * 1000;
    case '7d':
      return 7 * 24 * 60 * 60 * 1000;
    case '30d':
      return 30 * 24 * 60 * 60 * 1000;
  }
}
