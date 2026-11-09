import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseMigrations, toMermaid } from './gen-er.mjs';

/** Write SQL to a throwaway migrations directory and parse it. */
function parse(sql) {
  const dir = mkdtempSync(join(tmpdir(), 'kenn-er-'));
  writeFileSync(join(dir, '20260101000000_test.sql'), sql);
  return parseMigrations(dir);
}

describe('parseMigrations', () => {
  it('reads columns, types and the primary key', () => {
    const { tables } = parse(`
      create table household (
        id uuid primary key default gen_random_uuid(),
        name text not null,
        created_at timestamptz not null default now()
      );
    `);
    const cols = tables.get('household').columns;
    expect(cols.map((c) => c.name)).toEqual(['id', 'name', 'created_at']);
    expect(cols.find((c) => c.name === 'id').pk).toBe(true);
    expect(cols.find((c) => c.name === 'created_at').type).toBe('timestamptz');
  });

  it('keeps a column whose definition wraps onto another line', () => {
    // The bug this test exists for: a line-anchored regex cannot cross a
    // newline, so member.gender_form silently vanished from the diagram.
    const { tables } = parse(`
      create table member (
        household_id uuid not null references household (id),
        gender_form text not null default 'neutral'
          check (gender_form in ('feminine', 'masculine', 'neutral'))
      );
    `);
    expect(tables.get('member').columns.map((c) => c.name)).toContain('gender_form');
  });

  it('marks a composite primary key declared at table level', () => {
    const { tables } = parse(`
      create table member (
        household_id uuid not null,
        user_id uuid not null,
        role text not null,
        primary key (household_id, user_id)
      );
    `);
    const cols = tables.get('member').columns;
    expect(cols.filter((c) => c.pk).map((c) => c.name)).toEqual([
      'household_id',
      'user_id',
    ]);
    expect(cols.find((c) => c.name === 'role').pk).toBe(false);
  });

  it('records a foreign key and whether it is optional', () => {
    const { relations } = parse(`
      create table a (id uuid primary key);
      create table b (
        id uuid primary key,
        a_id uuid not null references a (id),
        maybe_id uuid references a (id)
      );
    `);
    expect(relations).toEqual(
      expect.arrayContaining([
        { from: 'b', to: 'a', optional: false },
        { from: 'b', to: 'a', optional: true },
      ]),
    );
  });

  it('is not derailed by a dollar-quoted function body', () => {
    // A function body contains semicolons, parentheses and commas. Before the
    // body is stripped, the parser walks straight into it.
    const { tables } = parse(`
      create function is_member(h uuid) returns boolean
      language sql stable security definer set search_path = public as $$
        select exists (select 1 from member where household_id = h, x);
      $$;
      create table after_the_function (id uuid primary key, label text not null);
    `);
    expect([...tables.keys()]).toEqual(['after_the_function']);
    expect(tables.get('after_the_function').columns).toHaveLength(2);
  });

  it('ignores table-level constraints that are not columns', () => {
    const { tables } = parse(`
      create table t (
        id uuid primary key,
        email text not null,
        constraint t_email_unique unique (email),
        check (length(email) > 3)
      );
    `);
    expect(tables.get('t').columns.map((c) => c.name)).toEqual(['id', 'email']);
  });

  it('attaches a table comment', () => {
    const { tables } = parse(`
      create table household (id uuid primary key);
      comment on table household is 'One family.';
    `);
    expect(tables.get('household').comment).toBe('One family.');
  });
});

describe('toMermaid', () => {
  it('emits a valid erDiagram with relationships and no duplicate edges', () => {
    const out = toMermaid(
      parse(`
        create table household (id uuid primary key, name text not null);
        create table member (
          household_id uuid not null references household (id),
          user_id uuid not null references auth.users (id),
          primary key (household_id, user_id)
        );
      `),
    );
    expect(out.split('\n')[0]).toBe('erDiagram');
    expect(out).toContain('HOUSEHOLD ||--|{ MEMBER : has');
    expect(out).toContain('AUTH_USERS ||--|{ MEMBER : has');
    // auth.users is outside our schema, so show it without inventing columns.
    expect(out).toContain('AUTH_USERS {\n    uuid id PK\n  }');
    expect(out.match(/HOUSEHOLD \|\|--/g)).toHaveLength(1);
  });

  it('does not emit an edge to a table that is not in the migrations', () => {
    const out = toMermaid(
      parse(`create table b (id uuid primary key, ghost_id uuid references ghost (id));`),
    );
    expect(out).not.toContain('GHOST ||--');
  });
});
