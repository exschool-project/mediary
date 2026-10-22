import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminDb, adminBucket } from '@/lib/firebase/admin';
import { requireOwner, AuthError } from '@/lib/server/auth';
import { releaseQuota } from '@/lib/server/quota';
import { writeAudit } from '@/lib/server/audit';
import type { FileDoc } from '@/types';

// Owner file browser exposes metadata only (name, size, owner, visibility,
// counts) — never a direct link to private file contents. See #28: any
// privileged content access must be explicit and audit logged, which this
// route does not provide (marked TODO below).
export async function GET(req: NextRequest) {
  try {
    await requireOwner(req);
    const snap = await adminDb.collection('files').orderBy('createdAt', 'desc').limit(100).get();
    const files = snap.docs.map((d) => {
      const f = d.data() as FileDoc;
      return {
        id: f.id,
        name: f.name,
        ownerUsername: f.ownerUsername,
        ownerId: f.ownerId,
        size: f.size,
        visibility: f.visibility,
        isFolder: f.isFolder,
        downloadCount: f.downloadCount,
        createdAt: f.createdAt,
        deletedAt: f.deletedAt,
      };
    });
    return NextResponse.json({ files });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: 'Could not load files.' }, { status: 500 });
  }
}

const DeleteSchema = z.object({ fileId: z.string() });

export async function DELETE(req: NextRequest) {
  try {
    const { uid: ownerUid } = await requireOwner(req);
    const { fileId } = DeleteSchema.parse(await req.json());
    const ref = adminDb.collection('files').doc(fileId);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: 'File not found.' }, { status: 404 });
    const file = snap.data() as FileDoc;

    if (!file.isFolder && file.storagePath) {
      await adminBucket.file(file.storagePath).delete().catch(() => {});
      await releaseQuota(file.ownerId, file.size);
    }
    await ref.delete();

    const links = await adminDb.collection('shareLinks').where('fileId', '==', fileId).get();
    await Promise.all(links.docs.map((l) => l.ref.update({ revoked: true })));

    await writeAudit(ownerUid, 'owner.delete_file', fileId, { ownerId: file.ownerId });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    console.error('owner/files DELETE error', err);
    return NextResponse.json({ error: 'Could not delete file.' }, { status: 500 });
  }
}
