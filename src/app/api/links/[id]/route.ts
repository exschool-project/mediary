import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { requireAuth, AuthError } from '@/lib/server/auth';
import { writeAudit } from '@/lib/server/audit';
import type { ShareLinkDoc } from '@/types';

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { uid } = await requireAuth(req);
    const ref = adminDb.collection('shareLinks').doc(params.id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: 'Link not found.' }, { status: 404 });
    const link = snap.data() as ShareLinkDoc;
    if (link.ownerId !== uid) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });

    await ref.update({ revoked: true });
    await writeAudit(uid, 'link.revoke', link.id, { fileId: link.fileId });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: 'Could not revoke link.' }, { status: 500 });
  }
}
