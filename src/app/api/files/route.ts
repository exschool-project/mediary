import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { requireAuth, AuthError } from '@/lib/server/auth';
import { sanitizeDisplayName } from '@/lib/utils';
import type { FileDoc } from '@/types';

// GET /api/files?folderId=xxx&trash=1 — list the authenticated user's own files.
export async function GET(req: NextRequest) {
  try {
    const { uid } = await requireAuth(req);
    const folderId = req.nextUrl.searchParams.get('folderId');
    const trash = req.nextUrl.searchParams.get('trash') === '1';

    let query = adminDb.collection('files').where('ownerId', '==', uid) as FirebaseFirestore.Query;
    query = trash ? query.where('deletedAt', '!=', null) : query.where('deletedAt', '==', null);

    const snap = await query.get();
    let files = snap.docs.map((d) => d.data() as FileDoc & { status?: string });
    files = files.filter((f) => f.status !== 'uploading');
    if (!trash) {
      files = files.filter((f) => (folderId ? f.folderId === folderId : f.folderId === null));
    }

    return NextResponse.json({ files });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('files/list error', err);
    return NextResponse.json({ error: 'Could not load files.' }, { status: 500 });
  }
}

const CreateFolderSchema = z.object({
  name: z.string().min(1).max(255),
  folderId: z.string().nullable().optional(),
});

// POST /api/files — create a folder (empty container; does not touch quota).
export async function POST(req: NextRequest) {
  try {
    const { uid } = await requireAuth(req);
    const userSnap = await adminDb.collection('users').doc(uid).get();
    if (!userSnap.exists) return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    const username = (userSnap.data() as { username: string }).username;

    const body = CreateFolderSchema.parse(await req.json());
    const id = nanoid(16);
    const now = Date.now();
    const doc: FileDoc = {
      id,
      ownerId: uid,
      ownerUsername: username,
      name: sanitizeDisplayName(body.name),
      originalName: sanitizeDisplayName(body.name),
      description: null,
      mimeType: 'application/vnd.mediary.folder',
      extension: '',
      size: 0,
      storagePath: '',
      visibility: 'private',
      folderId: body.folderId ?? null,
      isFolder: true,
      downloadCount: 0,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    await adminDb.collection('files').doc(id).set(doc);
    return NextResponse.json({ file: doc });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'Invalid folder name.' }, { status: 400 });
    console.error('files/create-folder error', err);
    return NextResponse.json({ error: 'Could not create folder.' }, { status: 500 });
  }
}
