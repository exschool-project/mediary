import 'server-only';
import { adminDb } from '@/lib/firebase/admin';
import { DEFAULT_QUOTA_BYTES } from '@/types';

export class QuotaExceededError extends Error {
  constructor(public usedBytes: number, public quotaBytes: number) {
    super('Storage limit reached.');
  }
}

/**
 * Atomically reserves `size` bytes against a user's quota. This runs inside
 * a Firestore transaction so concurrent uploads (multi-file, duplicate
 * requests, etc.) can never race past the limit — each reservation reads the
 * latest usedBytes and commits the increment in the same transaction.
 *
 * Call this BEFORE granting upload access, and call releaseQuota() if the
 * upload is later aborted or the file is deleted.
 */
export async function reserveQuota(uid: string, sizeBytes: number): Promise<void> {
  const userRef = adminDb.collection('users').doc(uid);

  await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) throw new Error('User not found');
    const data = snap.data() as { usedBytes?: number; quotaBytes?: number };
    const used = data.usedBytes ?? 0;
    const quota = data.quotaBytes ?? DEFAULT_QUOTA_BYTES;

    if (used + sizeBytes > quota) {
      throw new QuotaExceededError(used, quota);
    }

    tx.update(userRef, { usedBytes: used + sizeBytes, updatedAt: Date.now() });
  });
}

export async function releaseQuota(uid: string, sizeBytes: number): Promise<void> {
  const userRef = adminDb.collection('users').doc(uid);
  await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) return;
    const used = (snap.data() as { usedBytes?: number }).usedBytes ?? 0;
    tx.update(userRef, { usedBytes: Math.max(0, used - sizeBytes), updatedAt: Date.now() });
  });
}
