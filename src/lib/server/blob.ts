import 'server-only';
import { del, head, issueSignedToken, presignUrl } from '@vercel/blob';

// All file bytes live in a PRIVATE Vercel Blob store. Nothing here ever
// returns a permanent URL: downloads go through a short-lived presigned URL
// that is only minted after /api/download/[token] has run every check.

/** Delete a blob by pathname. Never throws (missing blob == already deleted). */
export async function deleteBlob(pathname: string): Promise<void> {
  try {
    await del(pathname);
  } catch {
    // ignore
  }
}

/** Real stored size in bytes, or null if the blob does not exist. */
export async function blobSize(pathname: string): Promise<number | null> {
  try {
    const meta = await head(pathname);
    return meta.size;
  } catch {
    return null;
  }
}

/** 60-second presigned GET URL for a private blob. */
export async function signedDownloadUrl(pathname: string): Promise<string> {
  const token = await issueSignedToken({
    pathname,
    operations: ['get'],
    validUntil: Date.now() + 5 * 60 * 1000,
  });
  const { presignedUrl } = await presignUrl(token, {
    operation: 'get',
    pathname,
    access: 'private',
    validUntil: Date.now() + 60 * 1000,
  });
  return presignedUrl;
}
