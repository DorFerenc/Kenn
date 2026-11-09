import type { IsoDate } from './dates.ts';

export const ANCHOR_NAMES = ['LMP', 'EDD', 'BIRTH', 'CORRECTED_BIRTH'] as const;
export type AnchorName = (typeof ANCHOR_NAMES)[number];

/** The dates every window is measured from. Missing means "not known yet". */
export type Anchors = Partial<Record<AnchorName, IsoDate>>;

/** Everything `applies_if` can test. Mirrors the KB schema's appliesIf. */
export interface Profile {
  fetuses?: number;
  dating_method?: 'lmp' | 'ultrasound' | 'ivf_transfer';
  birth_type?: 'vaginal' | 'caesarean';
  firstborn?: boolean;
  customs?: 'jewish' | 'muslim' | 'christian' | 'druze' | 'none';
  sex?: 'male' | 'female';
  rh_negative?: boolean;
  health_fund?: 'clalit' | 'maccabi' | 'meuhedet' | 'leumit';
  has_supplementary?: boolean;
  has_baby_room?: boolean;
  has_car?: boolean;
  has_elevator?: boolean;
  feeding_intent?: 'breast' | 'formula' | 'mixed' | 'undecided';
  help_available?: boolean;
  season_at_birth?: 'winter' | 'spring' | 'summer' | 'autumn';
}

/** The subset of a KB schedule item the engine needs. Keeps the engine free of
 *  any dependency on @kenn/kb, so it stays pure and fast to test. */
export interface ScheduleInput {
  id: string;
  version: number;
  phase: string;
  category: string;
  status?: 'published' | 'draft';
  window: { anchor: AnchorName; start_days: number; end_days: number };
  red_flag_days?: number;
  applies_if?: Profile;
  rules?: string[];
}

export type TaskStatus =
  'upcoming' | 'open' | 'closing' | 'overdue' | 'done' | 'skipped' | 'superseded';

export interface TaskInstance {
  kbItemId: string;
  kbVersion: number;
  dueStart: IsoDate;
  dueEnd: IsoDate;
  redFlagDate?: IsoDate;
  status: TaskStatus;
  /** Set when a rule moved the window, so the UI can say why. */
  adjustedBy?: string[];
}

export interface EngineContext {
  anchors: Anchors;
  profile: Profile;
  rules?: Rule[];
}

/** A special case is a rule, not a branch inside materialize(). Adding a
 *  country or a custom means adding one of these. */
export interface Rule {
  readonly name: string;
  applies(item: ScheduleInput, ctx: EngineContext): boolean;
  adjust(
    window: { dueStart: IsoDate; dueEnd: IsoDate },
    item: ScheduleInput,
    ctx: EngineContext,
  ): { dueStart: IsoDate; dueEnd: IsoDate };
}
