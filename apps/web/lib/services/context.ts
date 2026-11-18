/**
 * Who is asking, and the client that carries their JWT.
 *
 * Every service function takes a `ServiceContext` rather than reaching for a
 * client itself, for two reasons that both arrive later: the MCP route at step 9
 * and the coach at step 11 are other actors, and the audit log has to be able to
 * name which one made a write.
 *
 * `actor.kind` is already three-valued even though only `user` exists today,
 * because `audit_log` requires an MCP write to name its client and a column
 * nobody can fill is a column nobody fills honestly.
 */

import type { Db } from './server-client.ts';
import { serverDb } from './server-client.ts';

interface Actor {
  kind: 'user' | 'mcp' | 'cron';
  /** The signed-in user. Null for a cron job that acts on no one's behalf. */
  userId: string | null;
  /** The MCP client's name. Required for `kind: 'mcp'` by audit_log. */
  name?: string;
}

export interface ServiceContext {
  db: Db;
  actor: Actor;
}

/**
 * The context for the signed-in user, or null when nobody is signed in.
 *
 * `getUser()`, never `getSession()`: a session is read from a cookie the browser
 * sent, and only `getUser()` asks the auth server whether the token is real. For
 * health data the difference is the whole point.
 */
export async function userContext(): Promise<ServiceContext | null> {
  const db = await serverDb();
  const {
    data: { user },
  } = await db.auth.getUser();

  if (!user) return null;
  return { db, actor: { kind: 'user', userId: user.id } };
}

/** As above, but for a route that has already been guarded. */
export async function requireUserContext(): Promise<ServiceContext> {
  const ctx = await userContext();
  if (!ctx) throw new Error('not signed in');
  return ctx;
}

/**
 * Refuse a capability that belongs to a person.
 *
 * Hard rule 5 says the MCP route and the coach never get share or
 * outbound-message powers, and today that holds only because neither exists —
 * which is not the standard. An `import { createInvite }` in a step-9 tool
 * handler would satisfy the type checker and pass lint, because it is inside
 * the allowed directory, and would mint a share link.
 *
 * So the powers say no themselves, now, while there is exactly one actor and
 * the cost is one line each. Raised by the security review of step 5a.
 */
export function assertHuman(ctx: ServiceContext, what: string): void {
  if (ctx.actor.kind !== 'user') {
    throw new Error(
      `${what} is available to a signed-in person only, not to ${ctx.actor.kind}`,
    );
  }
}
