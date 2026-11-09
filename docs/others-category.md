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
| `pitriyajina` | Pitr Yajina | Питри Джагья | Pitr Yajina |
| `samgacchadhvam` | Samgacchadhvam | Самгаччхадхвам | Samgacchadhvam |
| `nityam_shuddham` | Nityam Shuddham | Нитьям шуддхам | Nityam Shuddham |
| `ananda_sutram` | Ananda Sutram | Ананда Сутрам | Ananda Sutram |
| `shlokas` | Shlokas | Шлоки | Shlokas |
| `other` | Something else | Другое | Otra cosa |

The Russian and Spanish words are marked "not yet read by a native speaker" in `locales/review.json`. Shlokas means (and the hint of the
sheet says) other Sanskrit verses recited or sung, for example those Baba quoted in his discourses; see "Check of 10 Nov 2026" below.

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

### Check of 10 Nov 2026 against the library (EE9 and Ananda Marga books)

Dada's decisions: the label is written **Pitr Yajina** (his word); for the others "look in the library". Read: EE9 (`EE9/текущая`, 2000
entries) and the library search (jnanamandira). EE9 itself names its files without diacritics (`GuruPuja_en`, `Samgacchadhvam_en`,
`NityamShuddham_en`, `BathingProcedureAndPitrYajina_en`), which is the plain form the app uses. Counts are spellings found in the EE9 texts.

| Visible name | Diacritic form in EE9 (count) | Evidence (verbatim) | Result |
|---|---|---|---|
| **Guru Puja** | "Guru Pújá" (8), "gurupúja" (30), "gurupújá" (5) | EE9 discourse "Guru Pújá", 4 October 1978, Patna (Ánanda Vacanámrtam Part 3; Who Is the Real Guru?); Practices: "Guru Pújá is performed just after the Nityam Shuddham shlokas that follow collective meditation." | kept |
| **Pitr Yajina** | "Pitr Yajiṋa" (13), "pitr yajiṋa" (8) | EE9 Caryácarya Part 3, "Bathing Procedure and Pitr Yajiṋa", 1956, Jamalpur: "Remembering the rśis and ancestors in this way is known as Pitr Yajiṋa." | kept (Dada's word); the ṋ (the ny sound) is written n |
| **Samgacchadhvam** | "Saḿgacchadhvaḿ" (20) | EE9 Ánanda Vacanámrtam Part 3, "Saḿgacchadhvaḿ", 12 October 1978, Patna: "Now there will be an interpretation of another common Vaedika shloka. It is, Saḿgacchadhvaḿ saḿvadadhvaḿ ..." | kept |
| **Nityam Shuddham** | "Nityaḿ shuddhaḿ" (5), "Nityaḿ Shuddhaḿ" (1) | EE9 Ánanda Vacanámrtam Part 3, "Nityaḿ Shuddhaḿ", 15 October 1978, Patna: "There is a shloka of Tantra, Nityaḿ shuddhaḿ nirábhásaḿ nirákáraḿ niraiṋjanam;" | kept (the practice books also write "Shudham"; recognised as typed) |
| **Ananda Sutram** | "Ánanda Sútram" (149) | EE9 book Ánanda Sútram, Publisher's Note: "Ánanda Sútram means, in part, “aphorisms leading to ánanda, divine bliss”." | kept |
| **Shlokas** | "shloka" (257, EE9 uses sh), "sloka" (18) | EE9: "another common Vaedika shloka"; library shelf "Shlokas Quoted by Bábá": "Shlokas, sútras and verses quoted by Bábá in his discourses"; Practices: "three shlokas known as Guru Vandaná" | kept; the hint now says what it covers |
| **Baba Nam Kevalam** | "Bábá Nam Kevalam" (6), "Bábá náma kevalam" (18), "Bábá nám kevalam" (9) | EE9 Ideology, Goal and Devotion: "When living beings will sing Bábá Nam Kevalam then the Lord will also sing, Bábá Nam Kevalam in His mind." | kept (fixed) |

**What Shlokas covers in Ananda Marga practice.** A shloka is a Sanskrit verse. In practice the word is used for the verses sung or
recited around meditation (the Nityam Shuddham shlokas, the three shlokas of Guru Vandaná, Samgacchadhvam, which the Path of Bliss calls
"This shloka (verse)"), and in Baba's discourses for the verses he quoted from the Gita, the Tantras and other works. Because Guru Puja,
Nityam Shuddham and Samgacchadhvam are shlokas too but have their own choice, **Shlokas** in the list means the **other** Sanskrit verses.
The hint of the sheet (`mantra.type.hint`) says: "Shlokas are other Sanskrit verses, recited or sung, for example those Baba quoted in his
discourses."

**Russian** (checked in the Russian books of the library, not by a native reader, so still unreviewed): the pocket handbook of
Ananda Marga (Карманный справочник АМ) writes «Гуру пуджа», «Нитьям́ шуддхам́», «Сам́гаччхадхвам́» and «питри джагья (служение предкам)»;
the Russian commentary writes «Ананда Сутрам» and the library shelf «Шлоки, которые цитировал Баба». So only one label changed:
**Питри Яджна became Питри Джагья**. The others stay as they were.

### Doubts for Dada

1. **Pitr Yajina.** Decided by Dada on 10 Nov 2026. "Pitri Yajna" and "Pitr Yajna" typed by a person are still recognised as the same choice.
2. **Samgacchadhvam.** Two forms occur: "Samgacchadhvam" (EE9, the Dictionary) and "Samgacchadvam" (a heading of one practice book). The
   first is the default; the second is recognised when typed.
3. **Nityam Shuddham.** "Shuddham" (EE9) against "Shudham" / "Shudam" (some practice books). "Shuddham" is the default; the other two are
   recognised when typed.
4. **Shlokas** is a general name. If Dada wants only the verses of Subhásita Samgraha, the name must say so; the hint now says "other Sanskrit
   verses, for example those Baba quoted".
5. **Russian**: "Питри Джагья" follows one Russian Ananda Marga handbook only; the other forms follow the handbook and the Russian commentary.
   All Russian words are unreviewed.
6. **Spanish** keeps the Latin names; "Otra cosa" and the new hint are unverified.

## Limits

* Verified on SQLite only (tests); the migration was not run on Postgres.
* Not checked on a real phone: the sheet, the Choose button and the "Something else" row were checked in the headless web build only.
