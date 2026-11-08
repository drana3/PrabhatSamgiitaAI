# Avarta Kiirtan (a sub-category of Kiirtan)

Avarta Kiirtan (Avartta, Avartha in other spellings) is a special style of kiirtan done by facing six different
directions in turn. In the library it is a flag on a Kiirtan recording, not a new type: it lives inside Kiirtan, next to the
style ("Indian kiirtan / style") but independent of it. A Bengali-style kiirtan can be an Avarta Kiirtan and so can a
Hindi one.

Related: `docs/kiirtan-publishing.md` (single uploads), `docs/kiirtan-sets.md` (playlists), `docs/search-menu.md`
(how categories appear on their own).

## The field

| Where | Name | Values |
|---|---|---|
| API, `recordings.practice` (String(16), nullable; migration `0044`) | `practice` | `"avarta"` or `null` |
| Upload payload, recording out | `practice` | same |
| Phone, `lib/kirtan/practice.ts` | `AVARTA`, `PRACTICES` | the same id |

Only a Kiirtan may carry it: for any other type the schema drops it silently (a Bhajan form that sends `practice` is not an error).
The database stores the id only, so a second practice later is a new id in `PRACTICES` on both sides and no migration.
Tests pin the two lists together (`__tests__/kirtanPractice.test.ts`, `tests/test_recording_practice.py`).

## Where a person marks it

All three places use one optional tick, "This is an Avarta Kiirtan", with one line of explanation under it. Nothing is
required and nothing is guessed from a file name.

1. **One recording** (`/add-kirtan`, type Kiirtan): the tick sits under the style.
2. **A queue of files** (`/add-kirtan` with several files): the tick under the style is the whole queue. Every row also
   has its own small "Avarta Kiirtan" button that overrides it for that file only, and above the rows the screen says
   "All are Avarta Kiirtan" or "Avarta Kiirtan: 2 of 3". `QueueDraft.practice` is the queue; `QueueItem.practice` is
   `undefined` (follows the queue), `null` (not Avarta) or `"avarta"`; `effectivePractice` resolves it at send time.
3. **A playlist** (`/upload-set`): the tick under the default type (shown when the default type is Kiirtan) is the whole playlist;
   each track row has the same per-track button. Same three-state rule.

A row's mark counts only while its type is Kiirtan (`effectivePractice` gives `null` for any other type), so changing a track to another type never sends a stale mark.

## Afterwards

- Everybody sees an "Avarta Kiirtan" tag on the recording's page (`PracticeTag`).
- The person who uploaded it, and the team, also get a switch there (`PracticeBlock`) that calls
  `PATCH /recordings/{id}/practice` with `{"practice": "avarta" | null}`. Rate limit 60 per hour per member. A removed or
  not-yet-uploaded recording says so in words.
- Any other member who thinks the mark is wrong (or missing) uses the existing report reason "wrong information"
  (`wrong_info`). There is no separate suggestion endpoint; the team looks at the report and sets the flag.
- The same audio file marked and unmarked is still the same file: it counts as an exact duplicate (409), as it did before.

## Browsing

The Kiirtan tab shows a two-way choice "All Kiirtans / Avarta Kiirtan (N)" under the heading, only while the library holds at
least one Avarta Kiirtan. With none, the choice does not exist (the same "empty means absent" rule as the search menu).
The choice lives inside the Kiirtan tab on purpose: the other types are not affected and nothing is added to the type chips.
Pure helpers: `avartaCount`, `avartaOnly`. A separate Avarta list screen is not built.

For the search menu the field is documented in `docs/search-menu.md` ("Fields feeding categories"): it can arrive in
`tags` as `practice: ["avarta"]`, for Kiirtan only; that mapping belongs to whoever owns the menu code and has not been made.

## Hint text and its sources

The phone's one-line explanation: "A special style of kiirtan, done by facing six different directions in turn." (Russian and
Spanish say the same.) It follows the library text, not an invention:

- *Ananda Marga Path of Bliss*, section "Kiirtan" (acharyas' booklet): "Avarta Kiirtan is one special style of kiirtan done by
  facing six different directions in turn."
- *Ananda Marga Path of Bliss*, 2006 edition (Practice, section "Kiirtan"): "performed by facing six different directions in turn".
- *Ananda Marga: The Path of Bliss*, Prabhat Library edition, "Kiirtana": a special kind of kiirtana, done by successively
  facing east, west, north, south, up and down.
- *Seva Dharma Mission, Berlin Sector, Global Conference 1998 (Practices)*, "Avartta Kiirtan": the six ideations.
- A Russian line exists in the *Карманный справочник АМ* ("Аварта киртан").

All are acharyas' or organisation documents in the reading library (jnanamandira), not discourses of Bába himself; no EE9
discourse that defines the word was found by the library search. The ideations of the six directions are in those sources too;
the app does not print them. The hint says only what the sources agree on.

## Not done

- A dedicated Avarta page or list; a per-direction guide or timer.
- Setting the flag by the importer script (`import_kiirtan_library.py` writes rows directly; a CSV column `practice` is easy to
  add if the team wants it).
- Teaching the search menu about `practice` (documented only).
