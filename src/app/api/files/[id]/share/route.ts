import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { requireAuth, AuthError } from '@/lib/server/auth';
import { generateShareToken } from '@/lib/server/tokens';
import { writeAudit } from '@/lib/server/audit';
import { LINK_EXPIRY_OPTIONS, expiryOptionToMs, type ShareLinkDoc } from '@/types';
import type { FileDoc } from '@/types';

const CreateLinkSchema = z.object({
  type: z.enum(['reusable', 'one-time']).default('reusable'),
  expiry: z.enum(LINK_EXPIRY_OPTIONS.map((o) => o.value) as [string, ...string[]]).default('never'),
  maxDownloads: z.number().int().positive().nullable().default(null),
  password: z.string().min(1).max(200).nullable().optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { uid } = await requireAuth(req);
    const fileRef = adminDb.collection('files').doc(params.id);
    const fileSnap = await fileRef.get();
    if (!fileSnap.exists) return NextResponse.json({ error: 'File not found.' }, { status: 404 });
    const file = fileSnap.data() as FileDoc;
    if (file.ownerId !== uid) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });

    const body = CreateLinkSchema.parse(await req.json());
    const { token, tokenHash } = generateShareToken();
    const passwordHash = body.password ? await bcrypt.hash(body.password, 10) : null;
    const expiresAt = expiryOptionToMs(body.expiry as never);

    const id = nanoid(16);
    const doc: ShareLinkDoc = {
      id,
      fileId: file.id,
      ownerId: uid,
      tokenHash,
      type: body.type,
      expiresAt: expiresAt ? Date.now() + expiresAt : null,
      maxDownloads: body.maxDownloads,
      downloadCount: 0,
      passwordHash,
      revoked: false,
      consumed: false,
      createdAt: Date.now(),
    };

    await adminDb.collection('shareLinks').doc(id).set(doc);
    await writeAudit(uid, 'link.create', id, { fileId: file.id, type: body.type });

    // The raw token is returned exactly once — it is never persisted.
    return NextResponse.json({ link: { ...doc, token } });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'Invalid link options.' }, { status: 400 });
    console.error('files/[id]/share POST error', err);
    return NextResponse.json({ error: 'Could not create link.' }, { status: 500 });
  }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { uid } = await requireAuth(req);
    const fileRef = adminDb.collection('files').doc(params.id);
    const fileSnap = await fileRef.get();
    if (!fileSnap.exists) return NextResponse.json({ error: 'File not found.' }, { status: 404 });
    const file = fileSnap.data() as FileDoc;
    if (file.ownerId !== uid) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });

    const linksSnap = await adminDb.collection('shareLinks').where('fileId', '==', file.id).get();
    // tokenHash is stripped — the raw token was shown once at creation time
    // and cannot be recovered or re-displayed.
    const links = linksSnap.docs.map((d) => {
      const { tokenHash: _drop, ...rest } = d.data() as ShareLinkDoc;
      return rest;
    });

    return NextResponse.json({ links });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: 'Could not load links.' }, { status: 500 });
  }
}
