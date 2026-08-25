import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminDb, adminBucket } from '@/lib/firebase/admin';
import { requireAuth, AuthError } from '@/lib/server/auth';
import { releaseQuota } from '@/lib/server/quota';
import { sanitizeDescription, sanitizeDisplayName } from '@/lib/utils';
import { writeAudit } from '@/lib/server/audit';
import type { FileDoc, Visibility } from '@/types';

async function loadOwnedFile(id: string, uid: string) {
  const ref = adminDb.collection('files').doc(id);
  const snap = await ref.get();
  if (!snap.exists) return { ref, doc: null as FileDoc | null };
  const doc = snap.data() as FileDoc;
  if (doc.ownerId !== uid) return { ref, doc: null };
  return { ref, doc };
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { uid } = await requireAuth(req);
    const { doc } = await loadOwnedFile(params.id, uid);
    if (!doc) return NextResponse.json({ error: 'File not found.' }, { status: 404 });
    return NextResponse.json({ file: doc });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: 'Could not load file.' }, { status: 500 });
  }
}

const PatchSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).nullable().optional(),
  visibility: z.enum(['private', 'public', 'link']).optional(),
  folderId: z.string().nullable().optional(), // move
  restore: z.boolean().optional(), // restore from Trash
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { uid } = await requireAuth(req);
    const { ref, doc } = await loadOwnedFile(params.id, uid);
    if (!doc) return NextResponse.json({ error: 'File not found.' }, { status: 404 });

    const body = PatchSchema.parse(await req.json());
    const update: Partial<FileDoc> & { updatedAt: number } = { updatedAt: Date.now() };

    if (body.name !== undefined) update.name = sanitizeDisplayName(body.name);
    if (body.description !== undefined) {
      update.description = body.description === null ? null : sanitizeDescription(body.description);
    }
    if (body.visibility !== undefined) update.visibility = body.visibility as Visibility;
    if (body.folderId !== undefined) update.folderId = body.folderId;
    if (body.restore) update.deletedAt = null;

    await ref.update(update);

    if (body.visibility !== undefined) {
      await writeAudit(uid, 'file.visibility_change', doc.id, { visibility: body.visibility });
    }
    if (body.restore) {
      await writeAudit(uid, 'file.restore', doc.id, null);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'Invalid update.' }, { status: 400 });
    console.error('files/[id] PATCH error', err);
    return NextResponse.json({ error: 'Could not update file.' }, { status: 500 });
  }
}

// DELETE /api/files/[id]           -> move to Trash (soft delete)
// DELETE /api/files/[id]?permanent=1 -> permanently delete object + free quota
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { uid } = await requireAuth(req);
    const { ref, doc } = await loadOwnedFile(params.id, uid);
    if (!doc) return NextResponse.json({ error: 'File not found.' }, { status: 404 });

    const permanent = req.nextUrl.searchParams.get('permanent') === '1';

    if (!permanent) {
      if (doc.deletedAt) {
        // already in trash and asked to soft-delete again: treat as restore no-op
        return NextResponse.json({ ok: true });
      }
      await ref.update({ deletedAt: Date.now(), updatedAt: Date.now() });
      await writeAudit(uid, 'file.delete', doc.id, { permanent: false });
      return NextResponse.json({ ok: true });
    }

    if (!doc.isFolder && doc.storagePath) {
      await adminBucket.file(doc.storagePath).delete().catch(() => {});
      await releaseQuota(uid, doc.size);
    }
    await ref.delete();
    // Revoke any share links pointing at this file so old links stop resolving.
    const links = await adminDb.collection('shareLinks').where('fileId', '==', doc.id).get();
    await Promise.all(links.docs.map((l) => l.ref.update({ revoked: true })));

    await writeAudit(uid, 'file.delete', doc.id, { permanent: true });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('files/[id] DELETE error', err);
    return NextResponse.json({ error: 'Could not delete file.' }, { status: 500 });
  }
}
