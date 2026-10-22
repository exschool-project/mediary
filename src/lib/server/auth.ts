import 'server-only';
import { NextRequest } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import type { UserDoc } from '@/types';

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

/**
 * Verifies the Firebase ID token sent in the Authorization: Bearer <token>
 * header. We NEVER trust a uid the client sends directly in a request body —
 * the authenticated uid always comes from this verified token.
 */
export async function requireAuth(req: NextRequest): Promise<{ uid: string; email: string | null }> {
  const header = req.headers.get('authorization') || '';
  const match = header.match(/^Bearer (.+)$/);
  if (!match) throw new AuthError('Missing Authorization header');

  try {
    const decoded = await adminAuth.verifyIdToken(match[1]!, true);
    return { uid: decoded.uid, email: decoded.email ?? null };
  } catch {
    throw new AuthError('Invalid or expired session. Please sign in again.');
  }
}

export async function requireUserDoc(uid: string): Promise<UserDoc> {
  const snap = await adminDb.collection('users').doc(uid).get();
  if (!snap.exists) throw new AuthError('User record not found.', 404);
  const user = snap.data() as UserDoc;
  if (user.isSuspended) throw new AuthError('This account has been suspended.', 403);
  return user;
}

/**
 * Verifies the caller is both authenticated and is the configured Mediary
 * owner. The owner identity is read from the server-side MEDIARY_OWNER_UID
 * environment variable — never from a client-supplied flag — and is checked
 * on every single owner API request, not just at the route-guard layer.
 */
export async function requireOwner(req: NextRequest): Promise<{ uid: string }> {
  const { uid } = await requireAuth(req);
  const ownerUid = process.env.MEDIARY_OWNER_UID;
  if (!ownerUid || uid !== ownerUid) {
    throw new AuthError('Owner access only.', 403);
  }
  return { uid };
}
