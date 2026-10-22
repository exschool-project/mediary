import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminDb, adminBucket } from '@/lib/firebase/admin';
import { requireAuth, AuthError } from '@/lib/server/auth';
import { releaseQuota } from '@/lib/server/quota';
import type { FileDoc } from '@/types';

const Schema = z.object({ fileId: z.string().min(1) });

export async function POST(req: NextRequest) {
  try {
    const { uid } = await requireAuth(req);
    const { fileId } = Schema.parse(await req.json());

    const ref = adminDb.collection('files').doc(fileId);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ ok: true });

    const doc = snap.data() as FileDoc & { status?: string };
    if (doc.ownerId !== uid) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    if (doc.status !== 'uploading') return NextResponse.json({ error: 'Already finalized.' }, { status: 409 });

    await adminBucket.file(doc.storagePath).delete().catch(() => {});
    await releaseQuota(uid, doc.size);
    await ref.delete();

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('upload/abort error', err);
    return NextResponse.json({ error: 'Could not abort upload.' }, { status: 500 });
  }
}
