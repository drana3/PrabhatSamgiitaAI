# Others (the category formerly called "Other mantras")

Decision of Dada, 9 Nov 2026. A Kiirtan is only Baba Nam Kevalam. Every other recording of Ananda Marga material that is sung or
recited (Guru Puja, Pitr Yajina, Samgacchadhvam, Nityam Shuddham, Ananda Sutram, Shlokas ...) is the kind **Others**.

## What changed, and what did not

* **Visible name**: "Other mantras" became **Others** everywhere a person reads it: the hub tile, the tab and chip of the Kiirtan page,
  the upload page title, notices, search shelves, share cards, queue names. Russian "Другое", Spanish "Otros".
* **Identifiers stay**: the kind is still `other_mantra` (API enum, database, routes `/add-mantra`, locale keys `kind.other_mantra`,
  `upload.mantra.*`). Old rows stay valid and readable; the check constraint was only widened (migration
  `apps/api/alembic/versions/0067_others_choice.py`, which is safe to run twice and whose downgrade refuses while new data exists).
* **`pitriyajina` keeps its old id**; only its visible name is now "Pitr Yajina".
* **No default.** The old default "Other mantra" is gone. A new upload must choose; a draft with nothing chosen is stopped with the
  sentence "Choose what this is ...". A row stored before this change with type `other` and no name reads as "Something else" and
  shows no name.

## The required choice

One required single choice, not tags, shown as one row (the value and a Choose / Change button) that opens the same white sheet as
Style and Mood (`components/kirtan/add/MantraField.tsx`, built on `TagPicker` in `single` mode):

| id (API and phone) | Visible name (en) | ru | es |
|---|---|---|---|
| `guru_puja` | Guru Puja | Гуру Пуджа | Guru Puja |
| `pitriyajina` | Pitr Yajina | Питри Яджна | Pitr Yajina |
| `samgacchadhvam` | Samgacchadhvam | Самгаччхадхвам | Samgacchadhvam |
| `nityam_shuddham` | Nityam Shuddham | Нитьям шуддхам | Nityam Shuddham |
| `ananda_sutram` | Ananda Sutram | Ананда Сутрам | Ananda Sutram |
| `shlokas` | Shlokas | Шлоки | Shlokas |
| `other` | Something else | Другое | Otra cosa |

The Russian and Spanish words are marked "not yet read by a native speaker" in `locales/review.json`.

### "Something else" and the team's review

Under "Something else" the person writes a short name (2 to 40 characters). It is **not a second review path**: it uses the existing
own-word queue (`value_suggestions`, now with field `mantra`, `apps/api/app/services/value_suggestions.py`), the same one as the main
instrument's own word:

* the author sees the name at once; a stranger sees it only after the team **accepts** it (`type_other_checked`);
* a name that IS a listed one ("Sloka", "Nityam Shudham", "Pitri Yajna") becomes that choice and nothing goes to the queue;
* the team can accept, merge into a listed choice (the recording's type becomes it and the word is cleared) or reject (the word is
  cleared and the author gets a notice to name it under "Something else" again);
* the limit of three NEW words a week per person is shared with the other own words.

API: `POST /recordings` for `other_mantra` requires `type` in the seven values; `type: "other"` requires `type_other`. A recording of
another kind ignores both. Output carries `type_other` (its author, or everybody once accepted) and `type_other_checked`.

## Where the choice shows

* **Recording page**: the first tag under the title is the choice (or the accepted name), `lib/kirtan/pageTags.ts`.
* **Search**: one shelf per choice, `mantra:type:<id>` in the block "Others" (visible from the first recording), and a row "What it is"
  in the "Search by" list (`lib/searchMenu/*`).

## Spelling of the visible names: sources

The app writes Baba's romanisation without diacritics in the "Kiirtan" / "Samgiita" style: long i is doubled, the other accents are
dropped (a-acute becomes a, s-acute stays sh), m-dot becomes m, n-tilde (the sound ny) becomes n ("Yajina"). Sources are the library
(jnanamandira: EE9 and other books) read on 9 Nov 2026; quotations are verbatim.

| Visible name | Other spellings found | Source of the choice |
|---|---|---|
| **Guru Puja** | "Guru Pújá" (EE9 and Path of Bliss), "Gurupújá" | Ánanda Vacanámrtam Part 3, "Guru Pújá" (4 October 1978, Patna): "What is the meaning of the incantation that is used in Guru Pújá?" Ánanda Márga Path of Bliss, Appendix, Fifteen Shiilas: "Guru Pújá is the offering of the “colours” of one’s mind to the Guru." |
| **Pitr Yajina** | "Pitr yajiṋa" (AM Practices, Ánanda Márga Dictionary), "Pitr-yajina" (AM Spiritual Philosophy), "Pitri Yajna" (common Hindu and Dada's own spelling) | Ananda Marga Practices, 9. Sádhaná, Notes: "(3) Pitr yajiņa: Pitr yajiņa ..." (one of the yajiṋas after bhúta yajiṋa and nr yajiṋa). Ánanda Márga Dictionary: "pitr yajiṋa service to one’s ancestors." The 16 Points: "3) PITR YAJINA: to remember with respect all our ancestors and the personalities of the past ..." A chapter of the Caryacarya is titled "Bathing Procedure and Pitr Yajina" (sarkarverse.org). |
| **Samgacchadhvam** | "Saḿgacchadhvaḿ" (EE9, Dictionary), "Samgacchadvaṁ" (AM Practices, heading), "Sam Gaccha Dhvam" (Practices and Philosophy), "Sam'gacchadhvam'" (Path of Bliss), "Сам́гаччхадхвам́" (Pocket handbook) | Ánanda Vacanámrtam Part 3, "Saḿgacchadhvaḿ" (12 October 1978, Patna): "Now there will be an interpretation of another common Vaedika shloka. It is, Saḿgacchadhvaḿ saḿvadadhvaḿ saḿ vo manáḿsi jánatám ..." Ananda Marga Practices: "Samgacchadhvam means to build up a strong, well-knit society ..." |
| **Nityam Shuddham** | "Nityaḿ Shuddhaḿ" (EE9), "Nityam Shudham" (AM Practices and Philosophy, Path of Bliss), "Nityam Shudam" (About AM Yoga) | Ánanda Vacanámrtam Part 3, "Nityaḿ Shuddhaḿ" (15 October 1978, Patna): "There is a shloka of Tantra, Nityaḿ shuddhaḿ nirábhásaḿ nirákáraḿ niraiṋjanam; Nityabodhaḿ cidánandaḿ Gurubrahma namámyaham." Ananda Marga Practices, "Nityam Shuddham": "At the end of collective meditation the song Nityam Shuddham is sung." |
| **Ananda Sutram** | "Ánanda Sútram" (EE9), "Ananda Sutra", "Ānanda Sūtram" (Word-Index) | Ánanda Sútram, Publisher’s Note (EE9): "Ánanda Sútram means, in part, “aphorisms leading to ánanda, divine bliss”." Word-Index of the Ánanda Sútram: "The substance of philosophy of Ananda Marga ... is contained in his work Ananda Sutram." |
| **Shlokas** | "Slokas" (Vidyasagar syllabus "Subha's'ita Sam'graha Slokas", AM Practices and Philosophy), "Shlokas" (library shelf "Shlokas Quoted by Bábá") | Library book "Shlokas Quoted by Bábá": "Shlokas, sútras and verses quoted by Bábá in his discourses, from the Ananda Marga digital library (shelf “shloki”)." EE9 uses "shloka" in the same sense ("another common Vaedika shloka"). |

### Doubts for Dada

1. **Pitr Yajina or Pitri Yajna.** Dada wrote "Pitri Yajna". The Ananda Marga texts read (Practices, Dictionary, 16 Points, Caryacarya)
   spell it "Pitr yajiṋa" / "Pitr Yajina". The app's convention (n-tilde becomes n, so "Yajina", as in "Pitriyajina" before) gives
   **Pitr Yajina**, which is the default. "Pitri Yajna" is a valid typed word: it is recognised and becomes the same choice.
2. **Samgacchadhvam.** Two forms occur: "Samgacchadhvam" (EE9, Baba's own discourse, and the Dictionary) and "Samgacchadvam" (a heading of
   one practice book). The first is the default.
3. **Nityam Shuddham.** "Shuddham" (EE9) against "Shudham" (some practice books). "Shuddham" is the default and the sh-dd form is the
   correct Sanskrit; "Shudham" is recognised as the same choice.
4. **Shlokas** is the choice name for verses in general. If Dada means "Subhásita Samgraha" slokas only, the name should say so.
5. **Russian**: no source gave a Russian form of Pitr Yajna; "Питри Яджна" is a transliteration made for the app and **unverified**.
   "Нитьям шуддхам", "Сам́гаччхадхвам́" and "Ананда Сутрам" follow the Russian pocket handbook and the Russian commentary.
6. **Spanish** keeps the Latin names; "Otra cosa" is unverified.

## Limits

* Verified on SQLite only (tests); the migration was not run on Postgres.
* Not checked on a real phone: the sheet, the Choose button and the "Something else" row were checked in the headless web build only.
