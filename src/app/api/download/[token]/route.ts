import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { adminDb, adminBucket } from '@/lib/firebase/admin';
import { resolveDownloadToken } from '@/lib/server/resolve-download';
import { writeAudit } from '@/lib/server/audit';

const ERROR_STATUS: Record<string, number> = {
  'not-found': 404,
  expired: 410,
  revoked: 410,
  'limit-reached': 410,
  private: 403,
};

const ERROR_MESSAGE: Record<string, string> = {
  'not-found':
    'The file may have been deleted, made private, or the link is invalid.',
  expired: 'This Mediary link has expired.',
  revoked: 'This link has been revoked by its owner.',
  'limit-reached': 'This link has reached its download limit.',
  private: "This file is private. You don't have permission to access it.",
};

// GET — returns display metadata for the /d/[shareId] page without granting
// a download yet, so the page can render the file card / password prompt.
export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const resolution = await resolveDownloadToken(params.token);

  if (resolution.kind === 'public-file' || resolution.kind === 'share-link') {
    const { file } = resolution;
    const ownerSnap = await adminDb.collection('users').doc(file.ownerId).get();
    const uploader = ownerSnap.exists ? (ownerSnap.data() as { username: string }).username : file.ownerUsername;

    return NextResponse.json({
      file: {
        name: file.name,
        description: file.description,
        size: file.size,
        extension: file.extension,
        mimeType: file.mimeType,
        downloadCount: file.downloadCount,
        createdAt: file.createdAt,
        uploader,
      },
      requiresPassword: resolution.kind === 'share-link' && !!resolution.link.passwordHash,
    });
  }

  return NextResponse.json({ error: ERROR_MESSAGE[resolution.kind] }, { status: ERROR_STATUS[resolution.kind] });
}

const PostSchema = z.object({ password: z.string().max(200).optional() });

// POST — validates password (if required), atomically consumes the
// download (one-time / max-downloads bookkeeping), and returns a
// short-lived signed URL. The signed URL is the only place a Storage URL
// ever appears, and it expires quickly.
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const resolution = await resolveDownloadToken(params.token);

  if (resolution.kind !== 'public-file' && resolution.kind !== 'share-link') {
    return NextResponse.json({ error: ERROR_MESSAGE[resolution.kind] }, { status: ERROR_STATUS[resolution.kind] });
  }

  const { file } = resolution;
  const body = PostSchema.parse(await req.json().catch(() => ({})));

  if (resolution.kind === 'share-link' && resolution.link.passwordHash) {
    const ok = body.password ? await bcrypt.compare(body.password, resolution.link.passwordHash) : false;
    if (!ok) return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 });
  }

  // Atomic consumption: re-check + increment inside a transaction so two
  // simultaneous requests against a one-time or limited link cannot both
  // succeed (prevents race-condition bypass of the usage limit).
  try {
    await adminDb.runTransaction(async (tx) => {
      const fileRef = adminDb.collection('files').doc(file.id);
      tx.update(fileRef, { downloadCount: (file.downloadCount ?? 0) + 1 });

      if (resolution.kind === 'share-link') {
        const linkRef = adminDb.collection('shareLinks').doc(resolution.link.id);
        const freshLinkSnap = await tx.get(linkRef);
        if (!freshLinkSnap.exists) throw new Error('gone');
        const fresh = freshLinkSnap.data()!;
        if (fresh.revoked) throw new Error('gone');
        if (fresh.type === 'one-time' && fresh.consumed) throw new Error('gone');
        if (fresh.maxDownloads !== null && fresh.downloadCount >= fresh.maxDownloads) throw new Error('gone');

        tx.update(linkRef, {
          downloadCount: (fresh.downloadCount ?? 0) + 1,
          consumed: fresh.type === 'one-time' ? true : fresh.consumed,
        });
      }
    });
  } catch {
    return NextResponse.json({ error: 'This link has already been used.' }, { status: 410 });
  }

  const [signedUrl] = await adminBucket.file(file.storagePath).getSignedUrl({
    action: 'read',
    expires: Date.now() + 60 * 1000, // 60 seconds
    responseDisposition: `attachment; filename="${file.name.replace(/"/g, '')}"`,
  });

  await writeAudit(file.ownerId, 'file.download', file.id, { via: resolution.kind });

  return NextResponse.json({ downloadUrl: signedUrl });
}
