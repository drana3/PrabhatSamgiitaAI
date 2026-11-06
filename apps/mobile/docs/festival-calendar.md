# Festival calendar

Source of truth in the app: `data/festivals.ts` (the reviewed 2026 list and the merge) plus
`data/festivalDates2027.ts` (the 2027 and 2028 dates, one place, with the basis of every date).
The notification scheduler (`lib/notifications/sources.ts`) and the Festivals screens read the same list,
so one edit changes the reminders, the list and the detail page.

## Policy

Lunar and festival dates are never guessed (the same rule as `apps/api/app/services/domain_catalog.py`).
A date is listed only when it comes from the official Ananda Marga material with a stated rule.
Everything else stays out and is not shown anywhere in the app until it is confirmed.

## Sources (all read on 2026-11-06)

| Source | URL | Used for |
| --- | --- | --- |
| AMPS India, Festivals and Important Days 2024, 2025, 2026 | https://india.anandamarga.org/ananda-marga-festivals-imp-days (2024 and 2025 from the Web Archive snapshots 20241110091557 and 20250211221844) | Official festival dates, three years |
| Ananda Marga fasting calendar (anandamarga.org, with a time zone selector) | https://anandamarga.org/practices/fasting-calendar | Purnima, Amavasya and Ekadashi dates |
| Its calendar file for any year and zone | `https://anandamarga.org/practices/fasting-calendar/ics?zone=Asia%2FKolkata&year=2027` (and `year=2028`) | The same table as the page, as a file. For 2026 it matches the printed table at https://india.anandamarga.org/fasting-calendar-2026/ date for date (49 of 49) |
| Ananda Marga Caryacarya part 1, chapter 21, "Social Functions and Festivals" (text as on https://sarkarverse.org/wiki/Social_Functions_and_Festivals) | same | The lunar rule of each festival |

The static download `/downloads/fasting-2027.ics` does not exist (404): only the 2026 files are linked on the page.
The `/practices/fasting-calendar/ics` address is the site's own generator and answers for other years and zones. The
2027 data for India is also embedded in the page itself (`Asia/Kolkata:2027`) and equals the file. 2028 exists only
through the generator.

## Time zone

The official fasting calendar is published per zone, and the page says: "Dates are given for India. Where the local
date differs by a day, your ácárya will tell you." All dates in the app are the **India (IST) civil date as published**.
The site's generator for other zones moves the fasting day by one day on part of the dates (2027 versus India: 3 of 50
for Dubai, 10 for Sydney, 21 for New York, 25 for Los Angeles). The festival dates below follow the same India
reckoning, so a user far from India can meet an observance one day earlier or later locally. The app does not shift
dates; the answer for a given place is the local ácárya, as the official page says. `FESTIVAL_DATES_TIME_ZONE` in
`data/festivalDates2027.ts` records the zone.

## Dates for 2027 and 2028

"Fixed" means the same civil date in the official lists of 2024, 2025 and 2026 (three years, different weekdays).
"Derived" means computed by the rule in the next section; the official 2027 and 2028 festival lists are not published
yet. Switch off all derived dates with `FESTIVAL_DATES_INCLUDE_LUNAR_DERIVED = false`.

| Festival | Rule | 2027 | 2028 | Basis | Confidence |
| --- | --- | --- | --- | --- | --- |
| R.U. Day | 25 Jan | 25 Jan | 25 Jan | Fixed (already in the app) | high |
| Niilakanth'a Divasa | 12 Feb | 12 Feb | 12 Feb | Fixed, official lists 2024 to 2026 | high |
| Dadhicii Divas | 5 Mar (not tied to Vasantotsava) | 5 Mar | 5 Mar | Fixed, official lists 2024 to 2026 | high |
| PROUT Day | 5 Jun | 5 Jun | 5 Jun | Fixed, official lists 2024 to 2026 | high |
| Kaoshiki Divas | 6 Sep | 6 Sep | 6 Sep | Fixed, official lists 2024 to 2026 | high |
| Prabháta Saḿgiita Divasa | 14 Sep | 14 Sep | 14 Sep | Fixed (already in the app) | high |
| Kiirtana Divas | 8 Oct | 8 Oct | 8 Oct | Fixed, official lists 2024 to 2026 | high |
| Bábá's Birthday | 21 May | 21 May | 21 May | Fixed (already in the app) | high |
| Ánanda Purnimá | Full moon day of Vaeshákha | 20 May | 8 May | Derived, rule A | medium-high |
| Shrávanii Purnimá | Full moon day of Shrávana | 17 Aug | 5 Aug | Derived, rule A | medium-high |
| Sharadotsava and Children's Day (6th day) | 6th to 10th day of the bright fortnight of Áshvina | 5 Oct | 23 Sep | Derived, rule B (Vijayotsava minus 4 days) | medium-high |
| Public Day (7th day) | same | 6 Oct | 24 Sep | Derived, rule B | medium-high |
| Fine Arts Day (8th day) | same | 7 Oct | 25 Sep | Derived, rule B | medium-high |
| Music Day (9th day) | same | 8 Oct | 26 Sep | Derived, rule B | medium-high |
| Vijayotsava (10th day) | same | 9 Oct | 27 Sep | Derived, rule B | medium-high |
| Diipavalii | New moon of Kárttika | 29 Oct | 17 Oct | Derived, rule C | medium-high |

Source URLs: the fixed rows come from the AMPS India list above; the derived rows use the rules of the Caryacarya
chapter above and are cross-checked with the fasting calendar above.

Cross-check against the official fasting calendar (India):

| Date used | Fasting calendar entry (India) |
| --- | --- |
| Ánanda Purnimá 20 May 2027, 8 May 2028 | Full moon fast on 20 May 2027 and 8 May 2028: same day |
| Shrávanii Purnimá 17 Aug 2027, 5 Aug 2028 | Full moon fast on 16 Aug 2027 and on 5 Aug 2028. In 2027 the Purnima tithi begins on the 16th at 10:29 and ends on the 17th at 12:59, so the sunrise falls on the 17th; in 2026 the pattern was the same (fast 27 Aug, festival 28 Aug) |
| Diipavalii 29 Oct 2027, 17 Oct 2028 | New moon fast on 29 Oct 2027 and 17 Oct 2028: same day |
| Vijayotsava 9 Oct 2027, 27 Sep 2028 | Shukla Ekadashi fast on 11 Oct 2027 and 28 Sep 2028 (2 and 1 days later; in 2024 to 2026 it was 1, 1 and 2 days later) |

Finding: the fasting calendar alone does not give the festival day. In 2025 the Shrávanii Purnimá festival was on
the fasting day (9 Aug), in 2026 one day after it (fast 27 Aug, festival 28 Aug). So the fasting calendar is used to
identify the right full moon or new moon and to cross-check, and the day is taken with the tested rules below.

### Rules and how they were tested

Reckoning: sunrise and sunset at Kolkata (22.57 N, 88.36 E); Delhi gives the same date for every row below. Moon-Sun
elongation and sunrise were computed with the astronomy-engine library, not from memory. A lunar month is named by the
sidereal sign (Lahiri) of the Sun at the new moon that opens it; a month without a sign change is an extra month and is
skipped (2026 has one, Jyeshtha; 2027 and 2028 have none).

* Rule A, Purnimá festivals: the date whose sunrise falls inside the Purnima tithi (elongation 168 to 180 degrees) of the named month.
* Rule B, Sharadotsava: Vijayotsava (10th day of the bright fortnight of Áshvina) is the date on which that tithi covers most of the afternoon (aparahna, the fourth fifth of the daylight). The festival runs over five consecutive days, so the earlier days are Vijayotsava minus 1, 2, 3 and 4.
* Rule C, Diipavalii: the date on which the Amávasyá tithi covers most of dusk (pradosha, 2 h 24 min from sunset).

Test against the official lists (all fit):

| Festival | 2024 official / rule | 2025 official / rule | 2026 official / rule |
| --- | --- | --- | --- |
| Ánanda Purnimá (A) | 23 May / 23 May | 12 May / 12 May | 1 May / 1 May |
| Shrávanii Purnimá (A) | 19 Aug / 19 Aug | 9 Aug / 9 Aug | 28 Aug / 28 Aug |
| Vijayotsava (B) | 12 Oct / 12 Oct | 2 Oct / 2 Oct | 20 Oct / 20 Oct |
| Sharadotsava first day (B) | 8 Oct / 8 Oct | 28 Sep / 28 Sep | 16 Oct / 16 Oct |
| Diipavalii (C) | 31 Oct / 31 Oct | 20 Oct / 20 Oct | 8 Nov / 8 Nov |

Margins for the derived dates: among the Purnimá dates the closest call is 8 May 2028, where the tithi begins 1.4 h
before Kolkata sunrise (2.0 h for Delhi); every other Purnimá date is more than 4.7 h from a tithi boundary.
Vijayotsava and Diipavalii have a single candidate day in each year. The month-naming margin is smallest for
Diipavalii 2028 (the Sun is 1.0 degree into the sign), which gives the same month with every common ayanamsa.

These rules reproduce all 15 published dates and agree with the fasting calendar, but the 2027 and 2028 dates are
**computed, not published**. When AMPS India publishes its 2027 list (about the end of 2026), compare it with this
table and correct any row.

## Still hidden (no confirmed date, reason)

| Observance | 2026 date | Why it stays hidden |
| --- | --- | --- |
| Vasantotsava | 4 Mar | The rule "full moon of Phálguna at sunrise" fits 2024 (25 Mar) and 2025 (14 Mar) but not 2026, where the official date (4 Mar) is the day after the Purnima sunrise. The same rule would give 22 Mar 2027 and 11 Mar 2028, but a rule that misses one of three years is not enough. |
| Navavarsa | 14 Apr | Official lists: 14 Apr 2024, 15 Apr 2025, 14 Apr 2026. Not a fixed civil date, and no tested rule from the time of the Sun's entry into Mesha reproduces all three. |
| Navánna | 25 Oct | Caryacarya: any full-moon day of the harvest season of the area. Official lists: 15 Nov 2024, 4 Nov 2025, 25 Oct 2026. Not computable. |
| Bhrátrdvitiiyá | 11 Nov | Kárttika, 2nd day of the bright fortnight, but the official dates fall 2, 3 and 3 days after Diipavalii (2024, 2025, 2026) and no single rule reproduces them. |

Ask AMPS India (the Sectorial Office, Delhi, named on the official list) for these four when the 2027 list is out, or
send them to Dada. Add each as a row in `EXTRA_FESTIVAL_DATES` and remove it from `FESTIVAL_DATES_STILL_HIDDEN`.

The calendar now ends after 2028-10-17 (Diipavalii). After that date the Festivals screen says that no confirmed date is ahead.

## How to add a confirmed date

1. A known observance: add a row to `EXTRA_FESTIVAL_DATES` in `data/festivalDates2027.ts` (`idBase`, year, month, day,
   basis). A new observance: add its 2026 entry to `festivalCalendar2026` in `data/festivals.ts` first (title, subtitle,
   `relatedCollectionLabel` only when it matches a label in `data/collections`), because the later years reuse it.
2. Run `npx vitest run __tests__/festivals.test.ts __tests__/festivalDates2027.test.ts`.
3. Raise `FESTIVAL_CALENDAR_LAST_YEAR` in `data/festivals.ts` when a later year is added, and extend this file.

The longer-term plan (checkup item 7) is to serve the calendar from the backend and keep this file as the offline fallback.
