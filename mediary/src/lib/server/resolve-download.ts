import 'server-only';
import { adminDb } from '@/lib/firebase/admin';
import { hashToken } from '@/lib/server/tokens';
import type { FileDoc, ShareLinkDoc } from '@/types';

export type DownloadResolution =
  | { kind: 'public-file'; file: FileDoc }
  | { kind: 'share-link'; file: FileDoc; link: ShareLinkDoc }
  | { kind: 'not-found' }
  | { kind: 'expired' }
  | { kind: 'revoked' }
  | { kind: 'limit-reached' }
  | { kind: 'private' };

/**
 * Resolves a public /d/{token} identifier. A token is tried first as a
 * share-link (secret token, hashed lookup), then as a public file's id.
 * This function performs every check called out in the download-security
 * flow except password verification and download-count consumption, which
 * the caller performs atomically at the moment it actually grants access.
 */
export async function resolveDownloadToken(token: string): Promise<DownloadResolution> {
  const tokenHash = hashToken(token);
  const linkSnap = await adminDb.collection('shareLinks').where('tokenHash', '==', tokenHash).limit(1).get();

  if (!linkSnap.empty) {
    const link = linkSnap.docs[0]!.data() as ShareLinkDoc;
    const fileSnap = await adminDb.collection('files').doc(link.fileId).get();
    if (!fileSnap.exists) return { kind: 'not-found' };
    const file = fileSnap.data() as FileDoc;
    if (file.deletedAt) return { kind: 'not-found' };

    if (link.revoked) return { kind: 'revoked' };
    if (link.expiresAt && Date.now() > link.expiresAt) return { kind: 'expired' };
    if (link.type === 'one-time' && link.consumed) return { kind: 'limit-reached' };
    if (link.maxDownloads !== null && link.downloadCount >= link.maxDownloads) {
      return { kind: 'limit-reached' };
    }

    return { kind: 'share-link', file, link };
  }

  // Fall back: token as a public file id.
  const fileSnap = await adminDb.collection('files').doc(token).get();
  if (!fileSnap.exists) return { kind: 'not-found' };
  const file = fileSnap.data() as FileDoc;
  if (file.deletedAt) return { kind: 'not-found' };
  if (file.visibility !== 'public') return { kind: 'private' };

  return { kind: 'public-file', file };
}
