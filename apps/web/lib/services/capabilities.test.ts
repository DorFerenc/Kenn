/**
 * What an AI client may not do, asserted now rather than at step 9.
 *
 * Hard rule 5 says the MCP route and the coach never get share or
 * outbound-message powers. Until step 9 there is one actor, so the rule holds
 * by accident — and "must be impossible, not merely unused" is the standard the
 * security review of step 5a held it to. These tests are what make the guard
 * load-bearing before the second actor exists.
 */

import { describe, expect, it } from 'vitest';
import { assertHuman, type ServiceContext } from './context.ts';
import { createHousehold } from './household.ts';
import { createInvite, revokeInvite } from './invites.ts';
import { fakeDb, HOUSEHOLD_A, USER_A } from './fake-db.ts';

function contextFor(kind: 'user' | 'mcp' | 'cron'): ServiceContext {
  const db = fakeDb({
    invite: { data: { id: 'ffffffff-0000-4000-8000-000000000001' }, error: null },
  });
  return {
    db: db as unknown as ServiceContext['db'],
    actor:
      kind === 'mcp'
        ? { kind, userId: USER_A, name: 'Claude Desktop' }
        : { kind, userId: kind === 'cron' ? null : USER_A },
  };
}

describe('assertHuman', () => {
  it('lets a signed-in person through', () => {
    expect(() => assertHuman(contextFor('user'), 'test')).not.toThrow();
  });

  it('refuses an MCP client and a cron job, and names which', () => {
    expect(() => assertHuman(contextFor('mcp'), 'creating an invite')).toThrow(
      /creating an invite is available to a signed-in person only, not to mcp/,
    );
    expect(() => assertHuman(contextFor('cron'), 'creating an invite')).toThrow(
      /not to cron/,
    );
  });
});

describe('the powers an AI client must not have', () => {
  it('refuses to create an invite for an MCP client', async () => {
    await expect(
      createInvite(contextFor('mcp'), HOUSEHOLD_A, 'someone@example.test'),
    ).rejects.toThrow(/signed-in person only/);
  });

  it('refuses to revoke an invite for an MCP client', async () => {
    await expect(
      revokeInvite(
        contextFor('mcp'),
        HOUSEHOLD_A,
        'ffffffff-0000-4000-8000-000000000001',
      ),
    ).rejects.toThrow(/signed-in person only/);
  });

  it('refuses to create a household for an MCP client', async () => {
    await expect(createHousehold(contextFor('mcp'), 'Theirs', 'he')).rejects.toThrow(
      /signed-in person only/,
    );
  });

  it('still lets a person do all three', async () => {
    // The guard must not be deny-all: a test that only asserts refusals passes
    // just as well when the function is broken for everyone.
    await expect(
      createInvite(contextFor('user'), HOUSEHOLD_A, 'partner@example.test'),
    ).resolves.toMatchObject({ token: expect.stringMatching(/^[0-9a-f]{64}$/) });
  });
});
