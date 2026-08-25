import 'server-only';
import { randomBytes, createHash } from 'crypto';

/**
 * Generates a URL-safe random token for a share link (mediary.app/d/<token>)
 * and returns both the raw token (given to the user once, never persisted)
 * and its SHA-256 hash (what we store in Firestore). This mirrors how
 * passwords are handled: the secret itself never touches the database.
 */
export function generateShareToken(): { token: string; tokenHash: string } {
  const token = randomBytes(24).toString('base64url');
  const tokenHash = hashToken(token);
  return { token, tokenHash };
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
