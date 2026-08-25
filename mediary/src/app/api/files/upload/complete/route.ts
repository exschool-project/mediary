import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminDb, adminBucket } from '@/lib/firebase/admin';
import { requireAuth, AuthError } from '@/lib/server/auth';
import { reserveQuota, releaseQuota, QuotaExceededError } from '@/lib/server/quota';
import type { FileDoc } from '@/types';

const Schema = z.object({ fileId: z.string().min(1) });

/**
 * Called by the client after it finishes writing bytes directly to Firebase
 * Storage. We never trust the size the client declared at /upload/init —
 * here we ask Storage (via the Admin SDK, server-side only) for the real
 * object size and reconcile the quota reservation against it. If the actual
 * size is larger than what was reserved and pushes the user over quota, the
 * object is deleted and the upload is rejected. This is what prevents quota
 * bypass through a manipulated declared file size.
 */
export async function POST(req: NextRequest) {
  try {
    const { uid } = await requireAuth(req);
    const { fileId } = Schema.parse(await req.json());

    const ref = adminDb.collection('files').doc(fileId);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: 'Upload not found.' }, { status: 404 });

    const doc = snap.data() as FileDoc & { status?: string };
    if (doc.ownerId !== uid) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    if (doc.status !== 'uploading') {
      return NextResponse.json({ error: 'This upload was already finalized.' }, { status: 409 });
    }

    const [metadata] = await adminBucket.file(doc.storagePath).getMetadata().catch(() => [null]);
    if (!metadata || !metadata.size) {
      return NextResponse.json({ error: 'Uploaded object was not found in storage.' }, { status: 404 });
    }

    const actualSize = Number(metadata.size);
    const reservedSize = doc.size;
    const delta = actualSize - reservedSize;

    if (delta > 0) {
      try {
        await reserveQuota(uid, delta);
      } catch (err) {
        if (err instanceof QuotaExceededError) {
          await adminBucket.file(doc.storagePath).delete().catch(() => {});
          await releaseQuota(uid, reservedSize);
          await ref.delete();
          return NextResponse.json({ error: 'Storage limit reached.' }, { status: 413 });
        }
        throw err;
      }
    } else if (delta < 0) {
      await releaseQuota(uid, -delta);
    }

    await ref.update({ size: actualSize, status: 'active', updatedAt: Date.now() });

    return NextResponse.json({ ok: true, size: actualSize });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('upload/complete error', err);
    return NextResponse.json({ error: 'Could not finalize upload.' }, { status: 500 });
  }
}
