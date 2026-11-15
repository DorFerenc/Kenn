/**
 * Locale-aware navigation. Use `Link` rather than the one from `next/link`, or
 * a link drops the locale prefix and sends a Hebrew reader to the default.
 *
 * `usePathname` joined `Link` at step 5a: it returns the path **without** the
 * locale prefix, which is exactly what the tab bar needs to mark the current
 * tab in either language.
 *
 * `createNavigation` also returns `redirect`, `useRouter` and `getPathname`.
 * They are deliberately not re-exported: nothing needs them yet, and knip fails
 * the gate on an export nothing imports. Add each one here with the screen that
 * uses it.
 */

import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing.ts';

export const { Link, usePathname } = createNavigation(routing);
