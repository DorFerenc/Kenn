/**
 * Generate the ER diagram from the committed migrations.
 *
 * Parsing the migrations rather than querying the database is deliberate: CI has
 * no database, and the migrations are the thing that is reviewed. If the diagram
 * disagreed with them, the diagram would be the lie.
 *
 * Handles what Kenn's migrations actually contain: `create table`, column lines
 * with types and constraints, inline `references`, table-level `primary key`,
 * and `comment on table`. Dollar-quoted function bodies are stripped first, or
 * their semicolons and parentheses derail the parser.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS = 'packages/db/supabase/migrations';

const stripDollarQuoted = (sql) => sql.replace(/\$\$[\s\S]*?\$\$/g, "'<body>'");
const stripComments = (sql) => sql.replace(/--[^\n]*/g, '');

/** Mermaid's erDiagram wants a bare word for a type. */
function normalizeType(raw) {
  const t = raw.toLowerCase();
  if (t.startsWith('timestamptz') || t.startsWith('timestamp')) return 'timestamptz';
  if (t.startsWith('character varying') || t.startsWith('varchar')) return 'text';
  if (t.startsWith('text')) return 'text';
  if (t.startsWith('uuid')) return 'uuid';
  if (t.startsWith('boolean') || t.startsWith('bool')) return 'boolean';
  if (t.startsWith('integer') || t.startsWith('int')) return 'int';
  if (t.startsWith('bigint')) return 'bigint';
  if (t.startsWith('jsonb')) return 'jsonb';
  if (t.startsWith('date')) return 'date';
  if (t.startsWith('numeric')) return 'numeric';
  if (t.endsWith('[]')) return `${normalizeType(t.slice(0, -2))}_array`;
  return t.replace(/[^a-z0-9_]/g, '_');
}

/** Split a parenthesised column list on top-level commas only. */
function splitTopLevel(body) {
  const out = [];
  let depth = 0;
  let current = '';
  for (const ch of body) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (ch === ',' && depth === 0) {
      out.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) out.push(current);
  // Collapse each part to one line: a column definition may wrap, and a
  // line-anchored regex cannot cross a newline. This is how member.gender_form
  // went missing the first time.
  return out.map((s) => s.trim().replace(/\s+/g, ' ')).filter(Boolean);
}

export function parseMigrations(dir = MIGRATIONS) {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const tables = new Map(); // name -> { columns: [], comment }
  const relations = [];

  for (const file of files) {
    const sql = stripComments(stripDollarQuoted(readFileSync(join(dir, file), 'utf8')));

    for (const m of sql.matchAll(
      /create\s+table\s+(?:if\s+not\s+exists\s+)?([a-z0-9_."]+)\s*\(/gi,
    )) {
      const name = m[1].replace(/"/g, '').replace(/^public\./, '');
      // Walk forward to the matching close paren.
      let depth = 1;
      let i = m.index + m[0].length;
      const start = i;
      while (i < sql.length && depth > 0) {
        if (sql[i] === '(') depth += 1;
        else if (sql[i] === ')') depth -= 1;
        i += 1;
      }
      const body = sql.slice(start, i - 1);

      const columns = [];
      const tablePk = new Set();

      for (const part of splitTopLevel(body)) {
        const lower = part.toLowerCase();

        const tpk = lower.match(/^primary\s+key\s*\(([^)]*)\)/);
        if (tpk) {
          for (const c of tpk[1].split(',')) tablePk.add(c.trim().replace(/"/g, ''));
          continue;
        }
        if (/^(constraint|unique|check|foreign\s+key|exclude)\b/.test(lower)) continue;

        const col = part.match(/^"?([a-z0-9_]+)"?\s+(.+)$/i);
        if (!col) continue;
        const [, colName, rest] = col;
        const restLower = rest.toLowerCase();

        const ref = rest.match(
          /references\s+([a-z0-9_."]+)\s*\(\s*"?([a-z0-9_]+)"?\s*\)/i,
        );
        if (ref) {
          relations.push({
            from: name,
            to: ref[1].replace(/"/g, '').replace(/^public\./, ''),
            optional: !/\bnot\s+null\b/.test(restLower),
          });
        }

        columns.push({
          name: colName,
          type: normalizeType(rest.split(/\s+/)[0]),
          pk: /\bprimary\s+key\b/.test(restLower) || tablePk.has(colName),
          fk: Boolean(ref),
        });
      }

      for (const c of columns) if (tablePk.has(c.name)) c.pk = true;
      tables.set(name, { columns });
    }

    for (const m of sql.matchAll(
      /comment\s+on\s+table\s+([a-z0-9_."]+)\s+is\s+'((?:[^']|'')*)'/gi,
    )) {
      const name = m[1].replace(/"/g, '').replace(/^public\./, '');
      const existing = tables.get(name);
      if (existing) existing.comment = m[2].replace(/''/g, "'");
    }
  }

  return { tables, relations, files };
}

export function toMermaid({ tables, relations }) {
  const lines = ['erDiagram'];
  const known = new Set(tables.keys());

  const seen = new Set();
  for (const r of relations) {
    // auth.users lives outside our schema; show it, but do not invent its columns.
    const target = r.to === 'auth.users' ? 'AUTH_USERS' : r.to.toUpperCase();
    if (!known.has(r.to) && r.to !== 'auth.users') continue;
    const key = `${r.to}->${r.from}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const card = r.optional ? '||--o{' : '||--|{';
    lines.push(`  ${target} ${card} ${r.from.toUpperCase()} : has`);
  }

  for (const [name, def] of [...tables].sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`  ${name.toUpperCase()} {`);
    for (const c of def.columns) {
      const marks = [c.pk ? 'PK' : '', c.fk ? 'FK' : ''].filter(Boolean).join(',');
      lines.push(`    ${c.type} ${c.name}${marks ? ` ${marks}` : ''}`);
    }
    lines.push('  }');
  }

  if (relations.some((r) => r.to === 'auth.users')) {
    lines.push('  AUTH_USERS {');
    lines.push('    uuid id PK');
    lines.push('  }');
  }

  return `${lines.join('\n')}\n`;
}

export function generateEr(dir = MIGRATIONS) {
  const parsed = parseMigrations(dir);
  return {
    mermaid: toMermaid(parsed),
    tableCount: parsed.tables.size,
    files: parsed.files.length,
  };
}
