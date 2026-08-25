import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { requireOwner, AuthError } from '@/lib/server/auth';

// Aggregate counts. For very large collections these count() aggregation
// queries are the efficient path (Firestore server-side count, not a full
// document read) and are what should back the owner dashboard tiles.
export async function GET(req: NextRequest) {
  try {
    await requireOwner(req);

    const [users, files, links] = await Promise.all([
      adminDb.collection('users').count().get(),
      adminDb.collection('files').where('deletedAt', '==', null).count().get(),
      adminDb.collection('shareLinks').where('revoked', '==', false).count().get(),
    ]);

    // Storage used and total downloads require a sum, which Firestore count()
    // aggregation cannot do directly — for a production-scale deployment this
    // should be maintained as a running counter (e.g. incremented alongside
    // reserveQuota/downloadCount writes) rather than summed per-request.
    // TODO: replace with a maintained aggregate doc for datasets beyond a
    // few thousand files.
    const filesSnap = await adminDb.collection('files').where('deletedAt', '==', null).get();
    let storageUsed = 0;
    let totalDownloads = 0;
    filesSnap.docs.forEach((d) => {
      const f = d.data() as { size?: number; downloadCount?: number };
      storageUsed += f.size ?? 0;
      totalDownloads += f.downloadCount ?? 0;
    });

    return NextResponse.json({
      users: users.data().count,
      files: files.data().count,
      storageUsedBytes: storageUsed,
      downloads: totalDownloads,
      activeLinks: links.data().count,
    });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('owner/stats error', err);
    return NextResponse.json({ error: 'Could not load stats.' }, { status: 500 });
  }
}
