/**
 * The append-only history of household writes.
 *
 * apps/web/CLAUDE.md: every service write that changes household state also
 * writes here. There is no update and no delete, in this file or in the
 * database — `audit_log` has a select policy and an insert policy and nothing
 * else, so a row cannot be rewritten even by the household it belongs to
 * (ADR-0008).
 */

import type { Json } from '@kenn/db';
import type { ServiceContext } from './context.ts';

export interface AuditEntry {
  action: string;
  entity: string;
  entityId?: string | null;
  /** The row as it was, and as it is now. `Json`, so the column's type is the
   *  one the caller has to satisfy rather than something cast away here. */
  before?: Json;
  after?: Json;
}

/**
 * Record what just happened. Called by the service function that did it, inside
 * the same request, with the same JWT — so a write the actor was not allowed to
 * make cannot be logged as though they had made it.
 */
export async function recordAudit(
  ctx: ServiceContext,
  householdId: string,
  entry: AuditEntry,
): Promise<void> {
  const { error } = await ctx.db.from('audit_log').insert({
    household_id: householdId,
    actor_kind: ctx.actor.kind,
    actor_user_id: ctx.actor.userId,
    actor_name: ctx.actor.name ?? null,
    action: entry.action,
    entity: entry.entity,
    entity_id: entry.entityId ?? null,
    before: entry.before ?? null,
    after: entry.after ?? null,
  });

  // A write that is not in the audit log is a write nobody can explain to the
  // parent who did not make it, so this fails the request rather than passing
  // quietly.
  if (error) throw new Error(`audit_log write failed: ${error.message}`);
}
