import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { requireAuth, AuthError } from '@/lib/server/auth';
import { isValidUsername } from '@/lib/utils';
import { DEFAULT_QUOTA_BYTES, type UserDoc } from '@/types';

const Schema = z.object({ username: z.string() });

// POST /api/users — called once, immediately after Firebase Auth
// registration, to create the Firestore profile doc and reserve the
// username. Username uniqueness is enforced with a transaction against a
// dedicated `usernames/{usernameLower}` collection, since Firestore has no
// native unique-field constraint.
export async function POST(req: NextRequest) {
  try {
    const { uid, email } = await requireAuth(req);
    const { username } = Schema.parse(await req.json());
    const usernameLower = username.toLowerCase();

    if (!isValidUsername(usernameLower)) {
      return NextResponse.json(
        { error: 'Usernames must be 3-20 characters: lowercase letters, numbers, underscore.' },
        { status: 400 }
      );
    }

    const userRef = adminDb.collection('users').doc(uid);
    const usernameRef = adminDb.collection('usernames').doc(usernameLower);

    await adminDb.runTransaction(async (tx) => {
      const [existingUser, existingUsername] = await Promise.all([tx.get(userRef), tx.get(usernameRef)]);
      if (existingUser.exists) throw new Error('profile-exists');
      if (existingUsername.exists) throw new Error('username-taken');

      const now = Date.now();
      const ownerUid = process.env.MEDIARY_OWNER_UID;
      const doc: UserDoc = {
        uid,
        username,
        usernameLower,
        email: email ?? '',
        displayName: username,
        avatarUrl: null,
        bio: null,
        quotaBytes: DEFAULT_QUOTA_BYTES,
        usedBytes: 0,
        isSuspended: false,
        isOwner: !!ownerUid && ownerUid === uid,
        createdAt: now,
        updatedAt: now,
      };

      tx.set(userRef, doc);
      tx.set(usernameRef, { uid });
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'Invalid username.' }, { status: 400 });
    if (err instanceof Error && err.message === 'username-taken') {
      return NextResponse.json({ error: 'That username is already taken.' }, { status: 409 });
    }
    if (err instanceof Error && err.message === 'profile-exists') {
      return NextResponse.json({ error: 'Profile already exists.' }, { status: 409 });
    }
    console.error('users/create error', err);
    return NextResponse.json({ error: 'Could not create profile.' }, { status: 500 });
  }
}

// GET /api/users — current user's own profile.
export async function GET(req: NextRequest) {
  try {
    const { uid } = await requireAuth(req);
    const snap = await adminDb.collection('users').doc(uid).get();
    if (!snap.exists) return NextResponse.json({ user: null });
    return NextResponse.json({ user: snap.data() });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: 'Could not load profile.' }, { status: 500 });
  }
}
