/**
 * The calendar feed's inputs, shared by the server actions, the route and the
 * service (apps/web/CLAUDE.md, "one zod schema per input").
 */

import { locales } from '@kenn/ui';
import { z } from 'zod';

export const createCalendarFeedSchema = z.object({ locale: z.enum(locales) });

export const revokeCalendarFeedSchema = z.object({ feedId: z.string().uuid() });

/** 64 hex characters is the only shape create_calendar_feed() mints. */
export const calendarTokenSchema = z.string().regex(/^[0-9a-f]{64}$/);
