# Interface languages

Plain words first. Written 2026-11-09. Code is in `apps/mobile/lib/i18n/`, `apps/mobile/locales/`.
The developer notes (keys, plurals, what is never translated) are in `apps/mobile/docs/i18n.md`.

## The list

**English is the default, always.** A new install, a reset, a phone whose language the app does not have: English.
"Automatic" in the language sheet follows the phone, but only among languages that are finished.

| Code | Language | Written as | Status | Plurals (CLDR) |
| --- | --- | --- | --- | --- |
| `en` | English | English | complete, the source of every key | one, other |
| `ru` | Russian | Русский | complete, not yet reviewed by a native speaker | one, few, many, other |
| `es` | Spanish | Español | complete, not yet reviewed | one, other |
| `hi` | Hindi | हिन्दी | **stub**, "не переведено" | 0 and 1 are one, other |
| `zh-TW` | Chinese, Taiwan, Traditional | 繁體中文 | **stub** | none (only other) |
| `pt-BR` | Portuguese, Brazil | Português (Brasil) | **stub** | 0 and 1 are one, other |
| `ko` | Korean | 한국어 | **stub** | none |

Simplified Chinese (mainland) is deliberately not offered: a phone set to Simplified Chinese gets English. If it is
wanted, it is a new entry (`zh-CN`), not a change to `zh-TW`.

## What a stub is

A stub has a locale file with no translations. Every missing text shows in English (the normal fallback), so a stub
never breaks a screen. It is listed in `apps/mobile/locales/review.json` as `"не переведено"` for each language,
it has `complete: false` in the registry, it is **hidden from the language sheet in release builds** (visible in
development so a translator can try it), and "Automatic" never selects it. To publish a language: translate, have a
native speaker read it, flip `complete` to `true`.

## Adding a language: one file and one entry

1. Create `apps/mobile/locales/<code>.ts` exporting an empty `Dictionary` (copy `hi.ts`).
2. Add one line to `apps/mobile/locales/index.ts` (the import and the entry; TypeScript fails there if a
   registered language has no dictionary).
3. Add one entry to `LANGUAGE_REGISTRY` in `apps/mobile/lib/i18n/registry.ts`: the code, its name in its own script,
   the Intl tag, the plural rule, the number separators, the script (decides the font), `complete: false`, and the
   device language tags it answers to.
4. Add the language to `_languages` in `apps/mobile/locales/review.json` with the value `"не переведено"` (by hand;
   `review-sync.mjs` keeps it but does not create it). Then
   `npx vitest run __tests__/i18n.test.ts __tests__/i18nParity.test.ts __tests__/languageRegistry.test.ts` from
   `apps/mobile`: the tests check the plural forms the language needs, the stub rules and the `review.json` entry.
5. Nothing else in the code names a language. If a change elsewhere seems necessary, the registry is missing a field;
   add the field there.

A new plural rule needs one more entry in `PluralRule` and in `pluralForm`
(`apps/mobile/lib/i18n/core.ts`), following the CLDR table.

## Fonts for Hindi, Chinese and Korean

Method: `python3 apps/mobile/scripts/i18n/glyph-check.py` reads the real font files and prints which characters
of a sample string a font cannot draw. Result on 2026-11-09:

| Sample | Roboto 400 (a Latin UI font in the project) | Noto Sans Devanagari 400 |
| --- | --- | --- |
| Portuguese (Brazil) accents | all present | all present |
| Hindi | **missing** 17 letters | all present |
| Traditional Chinese | **missing** (all 10 distinct characters) | missing |
| Korean | **missing** (all 8 distinct characters) | missing |

What that means and the plan:

* **Latin brand fonts stay unchanged.** Latin text, numbers and the Latin words inside any language keep the
  existing fonts. Only the script that needs a font gets one.
* **Hindi**: Noto Sans Devanagari is already in the app (weights 400, 600, 700, `app/_layout.tsx`,
  `constants/tokens/amTypography.ts`). Plan: when the language's `script` is `devanagari`, text styles use the
  Devanagari family for Hindi sentences. Mixed lines (Latin words in Hindi) fall back per character. Licence:
  SIL Open Font License 1.1 (free to bundle).
* **Traditional Chinese and Korean**: no bundled font today. iOS and Android both ship a Traditional Chinese and a
  Korean system font, and React Native falls back to it for characters the chosen font lacks, so text will show,
  just not in a brand style. Plan: **start with the system fonts**, check on a device (iPhone and a mid-range
  Android), and only if the look or weight is wrong bundle **Noto Sans TC** and **Noto Sans KR** (both OFL, in
  Google Fonts). Warning: each CJK family is several megabytes per weight even as a subset; bundle one regular and one
  bold weight at most, or load them on demand after the person picks the language. Decision when the first
  translation exists.
* Weights: CJK scripts look heavy at 700. Use 400 and 500 for UI text in zh-TW and ko.
* Text size: CJK and Devanagari need more line height than Latin (about 1.5 for Hindi, 1.4 for CJK). Set in the
  language's text styles when the font is chosen, not by hand per screen.

## Before turning a stub on

1. Every key translated. The parity test (`i18nParity.test.ts`) lists what is missing for a language that is marked complete.
2. A native speaker read it; mark the keys true in `review.json`.
3. Screens checked at 390 px and with the phone's text size at maximum (translations differ in length: Russian and
   Spanish run 20 to 30 percent longer than English; Portuguese about the same as Spanish; CJK is shorter in width but taller).
4. Fonts decided as above and checked on a device.
5. Names that stay Latin in every language: "Prabhat Samgiita", "Kiirtan" (two i's), "Bhajan"
   (`apps/mobile/docs/i18n.md`, "What is never translated").
6. Store listings: App Store and Play Console have their own language list for the store page text; this document
   covers only the app interface.

## Where the code is

| What | File |
| --- | --- |
| The one list of languages | `apps/mobile/lib/i18n/registry.ts` |
| Dictionaries | `apps/mobile/locales/{en,ru,es,hi,zhTW,ptBR,ko}.ts`, wired in `locales/index.ts` |
| Fallback, plurals, translate | `apps/mobile/lib/i18n/core.ts` |
| Phone language to app language | `apps/mobile/lib/i18n/device.ts` |
| The choice, saved | `apps/mobile/stores/languageStore.ts` |
| The language sheet | `apps/mobile/app/language.tsx` |
| Review marks | `apps/mobile/locales/review.json`, `scripts/i18n/review-sync.mjs` |
| Font check | `apps/mobile/scripts/i18n/glyph-check.py` |
