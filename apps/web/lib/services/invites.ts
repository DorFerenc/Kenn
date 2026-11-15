/**
 * Inviting the other parent.
 *
 * The invite is a link, not an email. Local Supabase caps outbound email at two
 * an hour and production email is roadmap step 5b's problem, but the deeper
 * reason is that this is how a couple actually does it: one of them sends the
 * other a link over WhatsApp.
 *
 * Only the SHA-256 hash of the token is stored (step 1), so the raw token is
 * returned exactly once, by the call that creates it, and cannot be recovered
 * afterwards — not by this app, not from a database dump. Expiry, revocation
 * and reuse are all checked inside `accept_invite()` in SQL, so a bug here
 * cannot widen the window.
 */

import { timestampInDays, nowTimestamp } from '../today.ts';
import { recordAudit } from './audit.ts';
import type { ServiceContext } from './context.ts';

const INVITE_DAYS = 7;

export interface Invite {
  id: string;
  email: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
}

/** Hex SHA-256, the same encoding `accept_invite()` compares against. */
async function tokenHash(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export interface CreatedInvite {
  id: string;
  /** Shown once, to be copied into a message. Never stored, never logged. */
  token: string;
}

export async function createInvite(
  ctx: ServiceContext,
  householdId: string,
  email: string,
): Promise<CreatedInvite> {
  if (!ctx.actor.userId) throw new Error('createInvite needs a signed-in user');

  const token =
    crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');
  const expiresAt = timestampInDays(INVITE_DAYS);

  const { data, error } = await ctx.db
    .from('invite')
    .insert({
      household_id: householdId,
      email,
      token_hash: await tokenHash(token),
      invited_by: ctx.actor.userId,
      expires_at: expiresAt,
    })
    .select('id')
    .single();

  if (error) throw new Error(`invite write failed: ${error.message}`);

  await recordAudit(ctx, householdId, {
    action: 'invite.create',
    entity: 'invite',
    entityId: data.id,
    // The address, never the token: an audit row is readable by the household
    // and a token in it would be a second copy of the secret.
    after: { email, expires_at: expiresAt },
  });

  return { id: data.id, token };
}

export async function listInvites(ctx: ServiceContext): Promise<Invite[]> {
  const { data, error } = await ctx.db
    .from('invite')
    .select('id, email, expires_at, accepted_at, revoked_at')
    .order('created_at', { ascending: false });

  if (error) throw new Error(`invite list failed: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id,
    email: row.email,
    expiresAt: row.expires_at,
    acceptedAt: row.accepted_at,
    revokedAt: row.revoked_at,
  }));
}

export async function revokeInvite(
  ctx: ServiceContext,
  householdId: string,
  inviteId: string,
): Promise<void> {
  const { error } = await ctx.db
    .from('invite')
    .update({ revoked_at: nowTimestamp() })
    .eq('id', inviteId);

  if (error) throw new Error(`invite revoke failed: ${error.message}`);

  await recordAudit(ctx, householdId, {
    action: 'invite.revoke',
    entity: 'invite',
    entityId: inviteId,
  });
}

/**
 * Redeem a raw token. Returns the household joined, or null when the token is
 * unknown, expired, revoked or already used — all four decided in SQL, and all
 * four reported to the reader as one thing, because telling them which is
 * telling them about a household they are not in.
 */
export async function acceptInvite(
  ctx: ServiceContext,
  token: string,
): Promise<{ householdId: string } | null> {
  const { data, error } = await ctx.db.rpc('accept_invite', { p_token: token });
  if (error) return null;

  const householdId = data as unknown as string;
  await recordAudit(ctx, householdId, {
    action: 'invite.accept',
    entity: 'member',
    entityId: ctx.actor.userId,
  });

  return { householdId };
}
