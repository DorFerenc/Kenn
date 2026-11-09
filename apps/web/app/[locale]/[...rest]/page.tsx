import { notFound } from 'next/navigation';

/**
 * Catch-all inside the locale segment, so an unmatched path reaches a route
 * that can render a localised 404.
 *
 * Without it, `/he/nope` never matches anything under `app/[locale]/`, the
 * 404 boundary resolves above the segment, and the reader gets Next's built-in
 * English page with no `lang` and no `dir` — which is exactly what happened
 * until this file existed.
 */
export default function CatchAll(): never {
  notFound();
}
