/** Inviting the other parent, and redeeming the link they were sent. */

import { z } from 'zod';

export const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

/**
 * The raw invite token: two UUIDs with the hyphens taken out, so 64 hex
 * characters. Checked for shape before it reaches the database, which keeps a
 * junk path out of `accept_invite()` — and keeps the reader's error identical
 * whether the token was malformed or simply wrong.
 */
export const inviteTokenSchema = z.string().regex(/^[0-9a-f]{64}$/);
