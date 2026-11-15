'use client';

/**
 * The two-minute wizard.
 *
 * One form, four steps. The steps are shown and hidden rather than mounted and
 * unmounted, so every answer is still in the form when the last step submits —
 * which means no draft state in the database, no half-onboarded household, and
 * no second round trip per step.
 *
 * Native radios, checkboxes and `<input type="date">`, deliberately: this is
 * the first screen a parent sees on a phone, and the platform's controls carry
 * their own keyboard, focus and screen-reader behaviour. packages/ui says reach
 * for Radix when something has focus or ARIA behaviour of its own; nothing here
 * does, so the first Radix primitive can wait for the screen that needs it.
 *
 * The gender form is answered on step 1 and used from step 2 on, so the Hebrew
 * imperatives on the buttons change as soon as it is chosen.
 */

import { genderForms, locales, type GenderForm } from '@kenn/ui';
import { genderValues } from '@/i18n/gender.ts';
import { completeOnboardingAction, type OnboardingState } from './actions.ts';
import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';

const EMPTY: OnboardingState = {};
const STEPS = 4;
const DATING_METHODS = ['lmp', 'ultrasound', 'ivf_transfer'] as const;
const FETUS_COUNTS = [1, 2, 3, 4] as const;
const CUSTOMS = ['jewish', 'muslim', 'christian', 'druze', 'none'] as const;
const HEALTH_FUNDS = ['clalit', 'maccabi', 'meuhedet', 'leumit'] as const;

type DatingMethod = (typeof DATING_METHODS)[number];

export function Wizard({ locale }: { locale: string }) {
  const t = useTranslations('onboarding');
  const common = useTranslations('common');
  const localeLabels = useTranslations('locale');

  const [state, action, pending] = useActionState(completeOnboardingAction, EMPTY);
  const [step, setStep] = useState(1);
  const [genderForm, setGenderForm] = useState<GenderForm>('neutral');
  const [datingMethod, setDatingMethod] = useState<DatingMethod>('lmp');

  const dateField = {
    lmp: { name: 'lmp', label: t('dating.lmpDate') },
    ultrasound: { name: 'edd', label: t('dating.eddDate') },
    ivf_transfer: { name: 'transferDate', label: t('dating.transferDate') },
  }[datingMethod];

  return (
    <form action={action} className="flex flex-col gap-4">
      <p className="text-text-muted text-sm" aria-live="polite">
        {t('step', { current: step, total: STEPS })}
      </p>

      {/* 1 — language and how Hebrew should address you */}
      <fieldset className={step === 1 ? 'flex flex-col gap-2' : 'hidden'}>
        <legend className="text-lg font-semibold">{t('genderForm.question')}</legend>
        <p className="text-text-muted text-sm">{t('genderForm.help')}</p>

        {genderForms.map((form) => (
          <label key={form} className="flex min-h-(--size-tap) items-center gap-2">
            <input
              type="radio"
              name="genderForm"
              value={form}
              checked={genderForm === form}
              onChange={() => setGenderForm(form)}
            />
            <span>{t(`genderForm.${form}` as 'genderForm.neutral')}</span>
          </label>
        ))}

        <span className="mt-2 text-lg font-semibold">{localeLabels('label')}</span>
        {locales.map((candidate) => (
          <label key={candidate} className="flex min-h-(--size-tap) items-center gap-2">
            <input
              type="radio"
              name="locale"
              value={candidate}
              defaultChecked={candidate === locale}
              lang={candidate}
            />
            <span lang={candidate}>{localeLabels(candidate)}</span>
          </label>
        ))}

        <label className="mt-2 flex flex-col gap-1">
          <span className="font-medium">{t('household.label')}</span>
          <input
            name="householdName"
            // Only while this step is on screen. A `required` control inside a
            // `display: none` fieldset is not focusable, so the browser blocks
            // the submit and reports "An invalid form control is not focusable"
            // to the console and nothing to the parent: the Finish button on
            // step 4 simply did nothing, for anyone who left the name blank.
            // The date field on step 2 already had this guard; this one was
            // missed, and the review of step 5a found it by clicking.
            required={step === 1}
            maxLength={80}
            className="border-border bg-surface-raised min-h-(--size-tap) rounded-md border px-2"
          />
          <span className="text-text-muted text-sm">{t('household.help')}</span>
        </label>
      </fieldset>

      {/* 2 — dating, which is where every date in the app comes from */}
      <fieldset className={step === 2 ? 'flex flex-col gap-2' : 'hidden'}>
        <legend className="text-lg font-semibold">{t('dating.question')}</legend>
        <p className="text-text-muted text-sm">{t('dating.help')}</p>

        {DATING_METHODS.map((method) => (
          <label key={method} className="flex min-h-(--size-tap) items-center gap-2">
            <input
              type="radio"
              name="datingMethod"
              value={method}
              checked={datingMethod === method}
              onChange={() => setDatingMethod(method)}
            />
            <span>{t(`dating.${method}` as 'dating.lmp')}</span>
          </label>
        ))}

        <label className="mt-2 flex flex-col gap-1">
          <span className="font-medium">{dateField.label}</span>
          {/* The engine dates an IVF transfer as a day-5 blastocyst (19 days
              after the notional LMP; a day-3 embryo is 17). Asking which is a
              column and a migration, and until then the assumption is said out
              loud rather than left in the engine's source — two days can move
              the edge of the NT window. Raised by the review of step 5a. */}
          {datingMethod === 'ivf_transfer' ? (
            <span className="text-text-muted text-sm">{t('dating.transferHelp')}</span>
          ) : null}
          {/* One input, renamed with the method, so only the date the chosen
              method is named after is ever submitted. */}
          <input
            key={dateField.name}
            type="date"
            name={dateField.name}
            required={step === 2}
            dir="ltr"
            className="border-border bg-surface-raised min-h-(--size-tap) rounded-md border px-2"
          />
        </label>
      </fieldset>

      {/* 3 — how many */}
      <fieldset className={step === 3 ? 'flex flex-col gap-2' : 'hidden'}>
        <legend className="text-lg font-semibold">{t('fetuses.question')}</legend>
        <p className="text-text-muted text-sm">{t('fetuses.help')}</p>

        {FETUS_COUNTS.map((count) => (
          <label key={count} className="flex min-h-(--size-tap) items-center gap-2">
            <input
              type="radio"
              name="fetuses"
              value={count}
              defaultChecked={count === 1}
            />
            <span className="numeric">{count}</span>
          </label>
        ))}
      </fieldset>

      {/* 4 — the applies_if answers. All optional: an unanswered condition
          does not match, which is the point (step 4's decision). */}
      <fieldset className={step === 4 ? 'flex flex-col gap-2' : 'hidden'}>
        <legend className="text-lg font-semibold">{t('profile.question')}</legend>
        <p className="text-text-muted text-sm">{t('profile.help')}</p>

        <label className="flex min-h-(--size-tap) items-center gap-2">
          <input type="checkbox" name="firstborn" />
          <span>{t('profile.firstborn')}</span>
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-medium">{t('profile.rh')}</span>
          <select
            name="rhNegative"
            defaultValue=""
            className="border-border bg-surface-raised min-h-(--size-tap) rounded-md border px-2"
          >
            {/* "Not said" first and selected, because an unanswered condition
                does not match and a guess here would show an anti-D item to
                someone who does not need it. */}
            <option value="">{common('notSaid')}</option>
            <option value="yes">{common('yes')}</option>
            <option value="no">{common('no')}</option>
          </select>
          <span className="text-text-muted text-sm">{t('profile.rhHelp')}</span>
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-medium">{t('profile.customs')}</span>
          <select
            name="customs"
            defaultValue=""
            className="border-border bg-surface-raised min-h-(--size-tap) rounded-md border px-2"
          >
            <option value="">{common('notSaid')}</option>
            {CUSTOMS.map((custom) => (
              <option key={custom} value={custom}>
                {t(`customs.${custom}` as 'customs.none')}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-medium">{t('profile.healthFund')}</span>
          <select
            name="healthFund"
            defaultValue=""
            className="border-border bg-surface-raised min-h-(--size-tap) rounded-md border px-2"
          >
            <option value="">{common('notSaid')}</option>
            {HEALTH_FUNDS.map((fund) => (
              <option key={fund} value={fund}>
                {t(`healthFund.${fund}` as 'healthFund.clalit')}
              </option>
            ))}
          </select>
        </label>

        <label className="flex min-h-(--size-tap) items-center gap-2">
          <input type="checkbox" name="hasSupplementary" />
          <span>{t('profile.supplementary')}</span>
        </label>
      </fieldset>

      {state.errorKey ? (
        <p role="alert" className="text-evidence-weak text-sm font-medium">
          {t('errors.invalid')}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-1">
        {step > 1 ? (
          <button
            type="button"
            onClick={() => setStep((current) => current - 1)}
            className="border-border min-h-(--size-tap) rounded-md border px-3"
          >
            {common('back')}
          </button>
        ) : null}

        {/*
          The keys are load-bearing, and the bug they fix took a browser to
          find. Without them React sees two `<button>` elements in the same
          position and reconciles the first into the second — mutating
          `type="button"` into `type="submit"` on the node that was just
          clicked. The click handler runs, the step advances, React flushes
          synchronously, and the browser then applies that same click's
          activation behaviour to a node that is now a submit button: the wizard
          posts itself from step 3, with the last step never seen. Distinct keys
          make React unmount one and mount the other instead.
        */}
        {step < STEPS ? (
          <button
            key="next"
            type="button"
            onClick={(event) => {
              // Validate the step the reader is on, where its fields are
              // visible, instead of letting them reach step 4 and meet a
              // button that cannot submit.
              const form = event.currentTarget.form;
              const fields = form?.querySelectorAll<HTMLInputElement>(
                'fieldset:not(.hidden) :is(input,select)',
              );
              for (const field of fields ?? []) {
                if (!field.checkValidity()) {
                  field.reportValidity();
                  return;
                }
              }
              setStep((current) => current + 1);
            }}
            className="bg-accent text-on-accent min-h-(--size-tap) rounded-md px-3 font-medium"
          >
            {t('next', genderValues(genderForm))}
          </button>
        ) : (
          <button
            key="finish"
            type="submit"
            disabled={pending}
            className="bg-accent text-on-accent min-h-(--size-tap) rounded-md px-3 font-medium disabled:opacity-60"
          >
            {t('finish', genderValues(genderForm))}
          </button>
        )}
      </div>
    </form>
  );
}
