/**
 * @kenn/engine — the pure schedule engine.
 *
 * KB items plus anchors in, task instances out. No database, no clock, no
 * framework: see docs/architecture.md, section "Domain model", and
 * packages/engine/CLAUDE.md for the rules this package lives by.
 */

export {
  addDays,
  assertIsoDate,
  dayOfWeek,
  diffDays,
  formatGestation,
  gestationalAge,
  isFriday,
  isIsoDate,
  isShabbat,
  maxDate,
  minDate,
  type IsoDate,
} from './dates.ts';

export {
  anchorsFromChild,
  anchorsFromPregnancy,
  correctedAgeDays,
  seasonAtBirth,
  TERM_DAYS,
  type ChildInput,
  type PregnancyInput,
} from './anchors.ts';

export {
  britMilahRule,
  defaultRules,
  hebrewDate,
  pidyonHabenRule,
  rsvBirthMonthRule,
  shabbatShiftRule,
} from './rules.ts';

export {
  appliesTo,
  CLOSING_WINDOW_DAYS,
  dueNow,
  materialize,
  statusFor,
} from './materialize.ts';

export {
  ANCHOR_NAMES,
  type Anchors,
  type AnchorName,
  type EngineContext,
  type Profile,
  type Rule,
  type ScheduleInput,
  type TaskInstance,
  type TaskStatus,
} from './types.ts';
