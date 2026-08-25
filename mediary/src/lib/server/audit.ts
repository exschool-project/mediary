import 'server-only';
import { nanoid } from 'nanoid';
import { adminDb } from '@/lib/firebase/admin';
import type { AuditLogDoc } from '@/types';

/**
 * Appends an audit log entry. Never pass passwords, private keys, or raw
 * share tokens into `metadata` — only non-secret identifiers/labels.
 */
export async function writeAudit(
  actorId: string,
  action: AuditLogDoc['action'],
  targetId: string | null,
  metadata: AuditLogDoc['metadata']
): Promise<void> {
  const id = nanoid(16);
  const doc: AuditLogDoc = {
    id,
    actorId,
    action,
    targetId,
    metadata,
    createdAt: Date.now(),
  };
  await adminDb.collection('auditLogs').doc(id).set(doc);
}
