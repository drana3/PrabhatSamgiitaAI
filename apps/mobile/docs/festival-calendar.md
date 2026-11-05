# Festival calendar

Source of truth in the app: `data/festivals.ts`. The notification scheduler (`lib/notifications/sources.ts`)
and the Festivals screens read the same list, so one edit changes the reminders, the list and the detail page.

## Policy

Lunar and festival dates are never guessed (the same rule as `apps/api/app/services/domain_catalog.py`).
A date is listed only when it is known: reviewed by hand, or an observance held on the same civil date
every year. Everything else is left out and is not shown anywhere in the app until it is confirmed.

## What the calendar holds today

| Years | Entries | Basis |
| --- | --- | --- |
| 2026 | 19 observances | Reviewed list, same as the website (`apps/web/lib/recommendation-presets.ts`). Not changed. |
| 2027, 2028 | 3 observances per year | Computed: the same civil date every year (see below). |

Computed (live in the app, 2027 and 2028):

| Observance | Date | Why it is computable | Please confirm |
| --- | --- | --- | --- |
| R.U. Day | 25 January | Reviewed 2026 date is 25 Jan; held on this civil date every year | yes |
| Bábá's Birthday | 21 May | The API already treats 21 May as a fixed civil-calendar observance (`fixed_reviewed_festival`) | yes |
| Prabháta Saḿgiita Divasa | 14 September | Reviewed 2026 date is 14 Sep; held on this civil date every year | yes |

The calendar ends after 2028-09-14. After that date the Festivals screen says that no confirmed date is ahead.

## Needs Dada's confirmation (hidden until then)

These observances are in the reviewed 2026 list. Their 2027 and 2028 dates are not in the app. The "likely rule"
column is only a hint about how the date is found, not a date; please check it and send the 2027 and 2028 dates.

| Observance | 2026 date | Likely rule (to be confirmed) |
| --- | --- | --- |
| Niilakanth'a Divasa | 12 Feb | unknown |
| Vasantotsava | 4 Mar | lunar (Phalguna purnima) |
| Dadhicii Divas | 5 Mar | lunar, the day after Vasantotsava |
| Navavarsa | 14 Apr | solar new year, 14 or 15 April |
| Ánanda Purnimá | 1 May | lunar (Vaishakha purnima) |
| PROUT Day | 5 Jun | unknown |
| Shrávanii Purnimá | 28 Aug | lunar (Shravana purnima) |
| Kaoshiki Divas | 6 Sep | unknown |
| Sharadotsava and Children's Day | 16 Oct | lunar (Durga Puja days) |
| Public Day | 17 Oct | lunar, follows Sharadotsava |
| Fine Arts Day | 18 Oct | lunar, follows Sharadotsava |
| Music Day | 19 Oct | lunar, follows Sharadotsava |
| Vijayotsava | 20 Oct | lunar, follows Sharadotsava |
| Kiirtana Divas | 8 Oct | unknown |
| Navánna | 25 Oct | unknown |
| Diipavalii | 8 Nov | lunar (new moon) |
| Bhrátrdvitiiyá | 11 Nov | lunar, after Diipavalii |

The same names are exported as `FESTIVAL_DATES_TO_CONFIRM` in `data/festivals.ts` (checked by `__tests__/festivals.test.ts`).

## How to add a confirmed date

1. Add the entry to `festivalCalendar2026` style data in `data/festivals.ts` (id `<name>-<year>`, month, day, year,
   `relatedCollectionLabel` only when it matches a label in `data/collections`).
2. Add it to the `festivalCalendar` array, and remove its name from `FESTIVAL_DATES_TO_CONFIRM` (it is derived;
   extend the filter if the new entry is not a `-2026` id).
3. Raise `FESTIVAL_CALENDAR_LAST_YEAR` when a later year is added.
4. Run `npx vitest run __tests__/festivals.test.ts`.

The longer-term plan (checkup item 7) is to serve the calendar from the backend and keep this file as the offline fallback.
