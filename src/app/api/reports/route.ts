import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { requireAuth, requireOwner, AuthError } from '@/lib/server/auth';
import { sanitizeDescription } from '@/lib/utils';
import type { ReportDoc } from '@/types';

const CreateSchema = z.object({
  fileId: z.string(),
  reason: z.enum(['abuse', 'malware', 'illegal', 'spam', 'copyright', 'other']),
  message: z.string().max(1000).nullable().optional(),
});

export async function POST(req: NextRequest) {
  try {
    // Reports may come from any signed-in user.
    const { uid } = await requireAuth(req);
    const body = CreateSchema.parse(await req.json());

    const fileSnap = await adminDb.collection('files').doc(body.fileId).get();
    if (!fileSnap.exists) return NextResponse.json({ error: 'File not found.' }, { status: 404 });

    const id = nanoid(16);
    const now = Date.now();
    const doc: ReportDoc = {
      id,
      fileId: body.fileId,
      reporterId: uid,
      reason: body.reason,
      message: body.message ? sanitizeDescription(body.message) : null,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };
    await adminDb.collection('reports').doc(id).set(doc);

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'Invalid report.' }, { status: 400 });
    console.error('reports POST error', err);
    return NextResponse.json({ error: 'Could not submit report.' }, { status: 500 });
  }
}

// GET /api/reports?status=pending — owner only.
export async function GET(req: NextRequest) {
  try {
    await requireOwner(req);
    const status = req.nextUrl.searchParams.get('status');
    let query = adminDb.collection('reports').orderBy('createdAt', 'desc') as FirebaseFirestore.Query;
    if (status) query = query.where('status', '==', status);
    const snap = await query.limit(100).get();
    return NextResponse.json({ reports: snap.docs.map((d) => d.data()) });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: 'Could not load reports.' }, { status: 500 });
  }
}

const PatchSchema = z.object({
  id: z.string(),
  status: z.enum(['pending', 'reviewing', 'resolved', 'dismissed']),
});

export async function PATCH(req: NextRequest) {
  try {
    await requireOwner(req);
    const body = PatchSchema.parse(await req.json());
    await adminDb.collection('reports').doc(body.id).update({ status: body.status, updatedAt: Date.now() });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    return NextResponse.json({ error: 'Could not update report.' }, { status: 500 });
  }
}
