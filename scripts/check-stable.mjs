/**
 * pnpm check:twice — the gate must be stable, not merely green once.
 *
 * `pnpm check` regenerates the ER diagram and the KB catalogue. If a generator
 * is not idempotent, the first run passes and the second fails — which is
 * exactly what happened when docs:gen wrote files after Prettier had already
 * run.
 *
 * Comparing a hash of every tracked file before and after, rather than running
 * `git diff --exit-code`, means this also works with uncommitted work in
 * progress: it asks "did running the gate change anything?", not "is the tree
 * clean?".
 */

import { execFileSync } from 'node:child_process';

function hashAll() {
  const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
    .split('\0')
    .filter(Boolean);
  const out = execFileSync('git', ['hash-object', '--stdin-paths'], {
    input: `${files.join('\n')}\n`,
    encoding: 'utf8',
  })
    .trim()
    .split('\n');
  return new Map(files.map((f, i) => [f, out[i]]));
}

function check(label) {
  process.stdout.write(`\n--- ${label} ---\n`);
  execFileSync('pnpm', ['check'], { stdio: 'inherit' });
}

check('pnpm check, first run');
const before = hashAll();
check('pnpm check, second run');
const after = hashAll();

const changed = [...after].filter(([f, h]) => before.get(f) !== h).map(([f]) => f);
const vanished = [...before.keys()].filter((f) => !after.has(f));

if (changed.length > 0 || vanished.length > 0) {
  console.error('\ncheck:twice — the gate is not stable. A second run changed:\n');
  for (const f of [...changed, ...vanished]) console.error(`  ${f}`);
  console.error(
    '\nA generator that rewrites a file every run makes the gate pass once and\n' +
      'fail next time. Make it idempotent, or stop it writing that file.',
  );
  process.exit(1);
}

console.log(
  `\ncheck:twice — stable: a second run changed none of ${after.size} tracked files.`,
);
