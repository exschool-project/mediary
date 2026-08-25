import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import type { FileDoc, UserDoc } from '@/types';

export async function GET(_req: NextRequest, { params }: { params: { username: string } }) {
  const usernameLower = params.username.toLowerCase();
  const nameSnap = await adminDb.collection('usernames').doc(usernameLower).get();
  if (!nameSnap.exists) return NextResponse.json({ error: 'User not found.' }, { status: 404 });

  const uid = (nameSnap.data() as { uid: string }).uid;
  const userSnap = await adminDb.collection('users').doc(uid).get();
  if (!userSnap.exists) return NextResponse.json({ error: 'User not found.' }, { status: 404 });
  const user = userSnap.data() as UserDoc;
  if (user.isSuspended) return NextResponse.json({ error: 'User not found.' }, { status: 404 });

  // Only files explicitly marked Public are ever returned here — share-link
  // and private files must never appear on a public profile.
  const filesSnap = await adminDb
    .collection('files')
    .where('ownerId', '==', uid)
    .where('visibility', '==', 'public')
    .where('deletedAt', '==', null)
    .get();

  const files = filesSnap.docs
    .map((d) => d.data() as FileDoc)
    .map((f) => ({
      id: f.id,
      name: f.name,
      description: f.description,
      size: f.size,
      extension: f.extension,
      isFolder: f.isFolder,
      downloadCount: f.downloadCount,
      createdAt: f.createdAt,
    }));

  return NextResponse.json({
    user: {
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
    },
    files,
  });
}
