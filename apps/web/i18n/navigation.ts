/**
 * Locale-aware navigation. Use `Link` rather than the one from `next/link`, or
 * a link drops the locale prefix and sends a Hebrew reader to the default.
 *
 * `createNavigation` also returns `redirect`, `usePathname`, `useRouter` and
 * `getPathname`. They are deliberately not re-exported: nothing needs them yet,
 * and knip fails the gate on an export nothing imports. Add each one here with
 * the screen that uses it.
 */

import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing.ts';

export const { Link } = createNavigation(routing);
