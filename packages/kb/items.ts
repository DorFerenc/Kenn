/**
 * The knowledge base, as the app sees it.
 *
 * This is the only entry point anything outside this package may use to read
 * guidance: `load.ts` walks the filesystem, which a bundler cannot follow, so
 * the app imports the artefact `pnpm kb:build` committed instead.
 *
 * The JSON is parsed through the schema rather than cast to it. A cast would
 * make a hand-edited or half-written artefact into silently wrong medical
 * guidance on a screen; a parse makes it a loud failure at startup. For a file
 * that tells someone when to have a test, loud is the right failure.
 */

import { z } from 'zod';
import generated from './generated/items.json';
import { kbItemSchema, type KbItem } from './schema.ts';

export const kbItems: KbItem[] = z.array(kbItemSchema).parse(generated.items);

/** The content files the artefact was built from. Used by the docs generator. */
export const kbSourceFiles: string[] = generated.files;

/**
 * Items that may be shown to a family. A draft has no reliable source, so it is
 * never published, never materialised and never on a screen — the engine skips
 * drafts too, and this is the same rule one step earlier.
 */
export const publishedKbItems: KbItem[] = kbItems.filter(
  (item) => item.status === 'published',
);
