import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminAuth, adminDb, adminBucket } from '@/lib/firebase/admin';
import { requireOwner, AuthError } from '@/lib/server/auth';
import { writeAudit } from '@/lib/server/audit';
import type { UserDoc } from '@/types';

export async function GET(req: NextRequest) {
  try {
    await requireOwner(req);
    const search = req.nextUrl.searchParams.get('q')?.toLowerCase().trim();

    let snap;
    if (search) {
      snap = await adminDb
        .collection('users')
        .orderBy('usernameLower')
        .startAt(search)
        .endAt(search + '\uf8ff')
        .limit(50)
        .get();
    } else {
      snap = await adminDb.collection('users').orderBy('createdAt', 'desc').limit(50).get();
    }

    return NextResponse.json({ users: snap.docs.map((d) => d.data()) });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('owner/users GET error', err);
    return NextResponse.json({ error: 'Could not load users.' }, { status: 500 });
  }
}

const PatchSchema = z.object({
  uid: z.string(),
  isSuspended: z.boolean().optional(),
  quotaBytes: z.number().int().positive().optional(),
});

export async function PATCH(req: NextRequest) {
  try {
    const { uid: ownerUid } = await requireOwner(req);
    const body = PatchSchema.parse(await req.json());
    const ref = adminDb.collection('users').doc(body.uid);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: 'User not found.' }, { status: 404 });

    const update: Partial<UserDoc> & { updatedAt: number } = { updatedAt: Date.now() };
    if (body.isSuspended !== undefined) update.isSuspended = body.isSuspended;
    if (body.quotaBytes !== undefined) update.quotaBytes = body.quotaBytes;

    await ref.update(update);

    if (body.isSuspended !== undefined) {
      await writeAudit(ownerUid, body.isSuspended ? 'owner.suspend_user' : 'owner.unsuspend_user', body.uid, null);
    }
    if (body.quotaBytes !== undefined) {
      await writeAudit(ownerUid, 'owner.change_quota', body.uid, { quotaBytes: body.quotaBytes });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    console.error('owner/users PATCH error', err);
    return NextResponse.json({ error: 'Could not update user.' }, { status: 500 });
  }
}

const DeleteSchema = z.object({ uid: z.string() });

export async function DELETE(req: NextRequest) {
  try {
    const { uid: ownerUid } = await requireOwner(req);
    const { uid } = DeleteSchema.parse(await req.json());
    if (uid === ownerUid) {
      return NextResponse.json({ error: 'The owner account cannot be deleted.' }, { status: 400 });
    }

    // Delete storage objects, file/link docs, then the auth user + profile.
    const filesSnap = await adminDb.collection('files').where('ownerId', '==', uid).get();
    await Promise.all(
      filesSnap.docs.map(async (d) => {
        const f = d.data() as { storagePath?: string; isFolder?: boolean };
        if (!f.isFolder && f.storagePath) await adminBucket.file(f.storagePath).delete().catch(() => {});
        await d.ref.delete();
      })
    );
    const linksSnap = await adminDb.collection('shareLinks').where('ownerId', '==', uid).get();
    await Promise.all(linksSnap.docs.map((d) => d.ref.delete()));

    const userSnap = await adminDb.collection('users').doc(uid).get();
    if (userSnap.exists) {
      const usernameLower = (userSnap.data() as { usernameLower: string }).usernameLower;
      await adminDb.collection('usernames').doc(usernameLower).delete().catch(() => {});
    }
    await adminDb.collection('users').doc(uid).delete();
    await adminAuth.deleteUser(uid).catch(() => {});

    await writeAudit(ownerUid, 'owner.delete_user', uid, null);

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    console.error('owner/users DELETE error', err);
    return NextResponse.json({ error: 'Could not delete user.' }, { status: 500 });
  }
}
