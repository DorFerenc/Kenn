import { describe, expect, it } from 'vitest';
import {
  defaultLocale,
  dirForLocale,
  genderBranch,
  genderForms,
  isGenderForm,
  isLocale,
  locales,
  resolveGenderForm,
  resolveLocale,
} from './locales.ts';

describe('locales', () => {
  it('ships Hebrew and English, Hebrew first', () => {
    expect(locales).toEqual(['he', 'en']);
    expect(defaultLocale).toBe('he');
  });

  it('reads Hebrew right-to-left and English left-to-right', () => {
    expect(dirForLocale('he')).toBe('rtl');
    expect(dirForLocale('en')).toBe('ltr');
  });

  it('gives every locale a direction', () => {
    for (const locale of locales) {
      expect(['rtl', 'ltr']).toContain(dirForLocale(locale));
    }
  });
});

describe('resolveLocale', () => {
  it('passes a supported locale through', () => {
    expect(resolveLocale('en')).toBe('en');
  });

  it.each(['ar', 'ru'])(
    'falls back to the default for %s, which the schema allows and the UI does not translate yet',
    (planned) => {
      // member.locale admits he/en/ar/ru. A member who chose Arabic must get a
      // usable screen, not an empty one.
      expect(resolveLocale(planned)).toBe(defaultLocale);
    },
  );

  it.each([undefined, null, '', 'EN', 'he-IL', 42, {}])(
    'falls back to the default for %s',
    (junk) => {
      expect(resolveLocale(junk)).toBe(defaultLocale);
    },
  );

  it('is the same predicate as isLocale', () => {
    for (const value of ['he', 'en', 'ar', '', null]) {
      expect(isLocale(value)).toBe(resolveLocale(value) === value);
    }
  });
});

describe('gender forms', () => {
  it('mirrors the values member.gender_form checks', () => {
    expect(genderForms).toEqual(['feminine', 'masculine', 'neutral']);
  });

  it('writes neutral as ICU’s `other` branch', () => {
    // ICU select requires a branch literally named `other`, and the database
    // stores `neutral`. This mapping is the only place that knows.
    expect(genderBranch('neutral')).toBe('other');
    expect(genderBranch('feminine')).toBe('feminine');
    expect(genderBranch('masculine')).toBe('masculine');
  });

  it('defaults to the neutral plural for anything unrecognised', () => {
    expect(resolveGenderForm(undefined)).toBe('neutral');
    expect(resolveGenderForm('other')).toBe('neutral');
    expect(isGenderForm('other')).toBe(false);
  });
});
