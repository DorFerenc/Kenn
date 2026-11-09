/**
 * Special cases, as rules.
 *
 * Adding a country, a custom or a health-fund quirk means adding one of these,
 * never editing materialize(). Each rule decides whether it applies and then
 * returns a window — it never mutates anything.
 */

import { HDate } from '@hebcal/core';
import {
  addDays,
  assertIsoDate,
  dayOfWeek,
  diffDays,
  isShabbat,
  type IsoDate,
} from './dates.ts';
import type { Rule } from './types.ts';

/**
 * A due date on Shabbat is not actionable: clinics, Tipat Halav and the health
 * funds are closed. Pull the end of the window back to Thursday rather than
 * Friday, since Friday closes at midday.
 *
 * Only moves the END, and only earlier. Never extends a medical window, because
 * extending one is a clinical decision and this is a calendar.
 */
export const shabbatShiftRule: Rule = {
  name: 'shabbat-shift',
  applies(item) {
    // Things you do yourself are fine on Shabbat; appointments are not.
    return ['test', 'vaccine', 'visit', 'course'].includes(item.category);
  },
  adjust(window) {
    let end = window.dueEnd;
    if (isShabbat(end))
      end = addDays(end, -2); // Saturday -> Thursday
    else if (dayOfWeek(end) === 5) end = addDays(end, -1); // Friday -> Thursday
    // Never push the end before the start.
    if (diffDays(window.dueStart, end) < 0) return window;
    return { dueStart: window.dueStart, dueEnd: end };
  },
};

/**
 * Brit milah is on day 8 of life, counting the birth day as day 1, so it falls
 * seven days after the birth. It happens on Shabbat and on festivals, which is
 * why this rule deliberately does NOT defer to shabbatShiftRule.
 *
 * Medical postponement — jaundice, prematurity, low weight — is a doctor's
 * decision, not a calendar's. The rule computes the date; the item's text says
 * it may be postponed.
 */
export const britMilahRule: Rule = {
  name: 'brit-milah',
  applies(item, ctx) {
    return (
      item.id.includes('brit') &&
      ctx.profile.customs === 'jewish' &&
      ctx.profile.sex === 'male' &&
      Boolean(ctx.anchors.BIRTH)
    );
  },
  adjust(window, _item, ctx) {
    const birth = ctx.anchors.BIRTH;
    if (!birth) return window;
    const day8 = addDays(birth, 7);
    return { dueStart: day8, dueEnd: day8 };
  },
};

/**
 * Pidyon haben is on day 31 of life, and only for a firstborn son delivered
 * vaginally — a caesarean birth does not create the obligation. Children of
 * Kohanim and Levi'im are exempt, which the KB item's applies_if carries;
 * this rule only places the date.
 */
export const pidyonHabenRule: Rule = {
  name: 'pidyon-haben',
  applies(item, ctx) {
    return (
      item.id.includes('pidyon') &&
      ctx.profile.customs === 'jewish' &&
      ctx.profile.sex === 'male' &&
      ctx.profile.firstborn === true &&
      ctx.profile.birth_type === 'vaginal' &&
      Boolean(ctx.anchors.BIRTH)
    );
  },
  adjust(window, _item, ctx) {
    const birth = ctx.anchors.BIRTH;
    if (!birth) return window;
    const day31 = addDays(birth, 30);
    return { dueStart: day31, dueEnd: day31 };
  },
};

/**
 * RSV immunisation (Beyfortus). Most newborns get it in hospital, but babies
 * born between 1 April and 31 August get it at Tipat Halav instead, ahead of the
 * RSV season, which moves the window out of the first days of life.
 */
export const rsvBirthMonthRule: Rule = {
  name: 'rsv-birth-month',
  applies(item, ctx) {
    if (!item.id.includes('rsv') && !item.id.includes('beyfortus')) return false;
    const birth = ctx.anchors.BIRTH;
    if (!birth) return false;
    const month = Number(birth.slice(5, 7));
    return month >= 4 && month <= 8;
  },
  adjust(window, _item, ctx) {
    const birth = ctx.anchors.BIRTH;
    if (!birth) return window;
    // Given at Tipat Halav before the season, rather than in hospital.
    return { dueStart: addDays(birth, 14), dueEnd: addDays(birth, 180) };
  },
};

/** The Hebrew date of a Gregorian date, for display beside it. */
export function hebrewDate(date: IsoDate): string {
  assertIsoDate(date);
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const day = Number(date.slice(8, 10));
  return new HDate(new Date(Date.UTC(year, month - 1, day))).toString();
}

/** The default rule set. Order matters: placement rules run before shifting. */
export const defaultRules: Rule[] = [
  britMilahRule,
  pidyonHabenRule,
  rsvBirthMonthRule,
  shabbatShiftRule,
];
