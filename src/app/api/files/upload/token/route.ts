import { NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { adminDb } from '@/lib/firebase/admin';
import type { FileDoc } from '@/types';

/**
 * Issues a client upload token for Vercel Blob.
 *
 * The browser must have already called POST /api/files/upload (which is
 * authenticated, reserves quota and creates the Firestore doc in the
 * "uploading" state). Here we only hand out a token if:
 *   - clientPayload is the id of such a pending doc,
 *   - the requested pathname is exactly the path the server reserved, and
 *   - the doc is still "uploading".
 * The token is capped at the size that was reserved against the user's
 * quota, and overwriting is disabled, so the quota cannot be bypassed.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const fileId = clientPayload ?? '';
        if (!fileId) throw new Error('Upload not found.');

        const snap = await adminDb.collection('files').doc(fileId).get();
        if (!snap.exists) throw new Error('Upload not found.');

        const doc = snap.data() as FileDoc & { status?: string };
        if (doc.status !== 'uploading' || doc.storagePath !== pathname) {
          throw new Error('Upload not authorized.');
        }

        return {
          maximumSizeInBytes: doc.size,
          addRandomSuffix: false,
          allowOverwrite: false,
          validUntil: Date.now() + 60 * 60 * 1000,
          tokenPayload: fileId,
        };
      },
      // Finalization is done by the client calling /api/files/upload/complete.
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(json);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
