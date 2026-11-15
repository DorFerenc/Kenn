/**
 * A fake Supabase client, for the service tests.
 *
 * It is not a database and does not pretend to be one: RLS is proven by the
 * pgTAP suite against a real Postgres, which is the only place it can be
 * proven. What this fake covers is the part pgTAP cannot see — the composition
 * in `tasks.ts`, where KB guidance, the engine's windows and the stored
 * decisions meet, and where a wrong answer looks entirely plausible on screen.
 *
 * Only in a test file's import graph. The eslint boundary allows
 * `@supabase/*` under lib/services, and this imports nothing at all.
 */

export interface TableResult {
  data?: unknown;
  error?: { message: string } | null;
}

interface RecordedCall {
  table: string;
  operation: 'select' | 'insert' | 'update' | 'upsert' | 'rpc';
  payload?: unknown;
}

/**
 * `tables` maps a table name to what a select returns. Writes are recorded
 * rather than applied, because every assertion in these tests is about what the
 * service decided to write, not about what a database would do with it.
 */
export function fakeDb(
  tables: Record<string, TableResult>,
  rpc: Record<string, TableResult> = {},
) {
  const calls: RecordedCall[] = [];

  const builder = (table: string) => {
    const result = tables[table] ?? { data: null, error: null };

    // Every builder method returns the same object, and the object is also a
    // promise: that is exactly how supabase-js behaves, and it is why a service
    // can `await` a select with or without a modifier on the end.
    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: () => chain,
      order: () => chain,
      limit: () => chain,
      maybeSingle: () => Promise.resolve(result),
      single: () => Promise.resolve(result),
      insert: (payload: unknown) => {
        calls.push({ table, operation: 'insert', payload });
        return chain;
      },
      update: (payload: unknown) => {
        calls.push({ table, operation: 'update', payload });
        return chain;
      },
      upsert: (payload: unknown) => {
        calls.push({ table, operation: 'upsert', payload });
        return chain;
      },
      then: (resolve: (value: TableResult) => unknown) =>
        Promise.resolve(result).then(resolve),
    };
    return chain;
  };

  return {
    from: builder,
    rpc: (name: string, args: unknown) => {
      calls.push({ table: name, operation: 'rpc', payload: args });
      return Promise.resolve(rpc[name] ?? { data: null, error: null });
    },
    auth: { getUser: () => Promise.resolve({ data: { user: { id: USER_A } } }) },
    calls,
  };
}

export const USER_A = '11111111-1111-4111-8111-111111111111';
export const HOUSEHOLD_A = '22222222-2222-4222-8222-222222222222';
