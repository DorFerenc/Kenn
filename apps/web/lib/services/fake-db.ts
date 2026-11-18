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
  /** The filters the caller applied, in order. */
  filters?: [string, unknown][];
}

/**
 * `tables` maps a table name to what a select returns. Writes are recorded
 * rather than applied, because every assertion in these tests is about what the
 * service decided to write, not about what a database would do with it.
 *
 * **Filters are honoured, and that is not a detail.** The first version of this
 * fake answered `eq()` with itself and ignored the argument, so a query with
 * `.eq('household_id', id)` and a query without were indistinguishable to every
 * test — which is exactly how a bug that mixed two households' data passed the
 * unit suite and had to be found by driving a browser. A fake that ignores the
 * filters the real client applies cannot test the thing most worth testing.
 */
export function fakeDb(
  tables: Record<string, TableResult>,
  rpc: Record<string, TableResult> = {},
) {
  const calls: RecordedCall[] = [];

  const builder = (table: string) => {
    const result = tables[table] ?? { data: null, error: null };
    const filters: [string, unknown][] = [];

    /** Apply the recorded filters to canned rows, as Postgres would. */
    const filtered = (): TableResult => {
      if (result.error) return result;
      const rows = result.data;
      if (!Array.isArray(rows)) {
        // A single canned row: it is returned only if it matches every filter,
        // so a test can hand the fake household B's row and watch a correctly
        // scoped read come back empty.
        if (rows && typeof rows === 'object') {
          const row = rows as Record<string, unknown>;
          const matches = filters.every(
            ([column, value]) => !(column in row) || row[column] === value,
          );
          return { data: matches ? rows : null, error: null };
        }
        return result;
      }
      return {
        data: (rows as Record<string, unknown>[]).filter((row) =>
          filters.every(([column, value]) => !(column in row) || row[column] === value),
        ),
        error: null,
      };
    };

    const one = (): TableResult => {
      const result = filtered();
      if (result.error) return result;
      return Array.isArray(result.data)
        ? { data: result.data[0] ?? null, error: null }
        : result;
    };

    const record = (operation: RecordedCall['operation'], payload?: unknown) => {
      calls.push({ table, operation, payload, filters: [...filters] });
    };

    // Every builder method returns the same object, and the object is also a
    // promise: that is exactly how supabase-js behaves, and it is why a service
    // can `await` a select with or without a modifier on the end.
    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: (column: string, value: unknown) => {
        filters.push([column, value]);
        return chain;
      },
      order: () => chain,
      limit: () => chain,
      // `maybeSingle()` reduces to one row, as PostgREST does: a test can
      // therefore hand the fake both households' rows and watch a correctly
      // scoped read pick the right one — or none.
      maybeSingle: () => Promise.resolve(one()),
      single: () => Promise.resolve(one()),
      insert: (payload: unknown) => {
        record('insert', payload);
        return chain;
      },
      update: (payload: unknown) => {
        record('update', payload);
        return chain;
      },
      upsert: (payload: unknown) => {
        record('upsert', payload);
        return chain;
      },
      then: (resolve: (value: TableResult) => unknown) =>
        Promise.resolve(filtered()).then(resolve),
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
export const HOUSEHOLD_B = '33333333-3333-4333-8333-333333333333';
