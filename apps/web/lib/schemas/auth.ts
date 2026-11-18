/**
 * Sign-in and sign-up input.
 *
 * One schema, used by the form and again by the server action, because the
 * client's validation is a convenience and the server's is the one that counts
 * (apps/web/CLAUDE.md).
 */

import { z } from 'zod';

/** Matches `minimum_password_length` in packages/db/supabase/config.toml. */
export const MIN_PASSWORD_LENGTH = 8;

export const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(MIN_PASSWORD_LENGTH).max(200),
});
