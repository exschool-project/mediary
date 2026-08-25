import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { requireAuth, requireUserDoc, AuthError } from '@/lib/server/auth';
import { reserveQuota, QuotaExceededError } from '@/lib/server/quota';
import { extensionOf, sanitizeDisplayName } from '@/lib/utils';
import type { FileDoc } from '@/types';

const InitSchema = z.object({
  name: z.string().min(1).max(255),
  size: z.number().int().positive().max(5 * 1024 * 1024 * 1024), // hard ceiling: 5 GiB/object
  mimeType: z.string().min(1).max(255),
  folderId: z.string().nullable().optional(),
  isFolder: z.boolean().optional(),
});

// A single reasonable per-object ceiling. The real quota check is the
// user's remaining 1 GB balance, enforced transactionally below.
const MAX_OBJECT_BYTES = 5 * 1024 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const { uid } = await requireAuth(req);
    const user = await requireUserDoc(uid);

    const body = InitSchema.parse(await req.json());
    if (body.size > MAX_OBJECT_BYTES) {
      return NextResponse.json({ error: 'File exceeds the maximum object size.' }, { status: 413 });
    }

    // Atomically reserve the declared size against the user's quota. This is
    // what actually prevents bypass through parallel uploads or duplicate
    // requests — the increment happens inside a Firestore transaction keyed
    // on the user doc, so two concurrent requests cannot both "fit".
    try {
      await reserveQuota(uid, body.size);
    } catch (err) {
      if (err instanceof QuotaExceededError) {
        return NextResponse.json(
          {
            error: 'Storage limit reached.',
            usedBytes: err.usedBytes,
            quotaBytes: err.quotaBytes,
          },
          { status: 413 }
        );
      }
      throw err;
    }

    const fileId = nanoid(16);
    const cleanName = sanitizeDisplayName(body.name);
    const storagePath = `users/${uid}/files/${fileId}/${cleanName}`;

    const now = Date.now();
    const doc: FileDoc & { status: 'uploading' } = {
      id: fileId,
      ownerId: uid,
      ownerUsername: user.username,
      name: cleanName,
      originalName: cleanName,
      description: null,
      mimeType: body.mimeType,
      extension: extensionOf(cleanName),
      size: body.size, // reconciled against actual bytes in /complete
      storagePath,
      visibility: 'private',
      folderId: body.folderId ?? null,
      isFolder: !!body.isFolder,
      downloadCount: 0,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      status: 'uploading',
    };

    await adminDb.collection('files').doc(fileId).set(doc);

    return NextResponse.json({ fileId, storagePath });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'Invalid upload request.' }, { status: 400 });
    console.error('upload/init error', err);
    return NextResponse.json({ error: 'Upload could not be started.' }, { status: 500 });
  }
}
