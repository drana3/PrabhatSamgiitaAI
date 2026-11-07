import { t } from "@/lib/i18n"
import { artistForAuthor, type Artist } from "@/lib/kirtan/artists"
import { BHAJAN_TYPES, KIRTAN_TYPES, LANGUAGE_KINDS, LEGACY_KINDS, RECORDING_KINDS, type KindFilter, type Kirtan, type KirtanTypeId, type RecordingKind } from "@/lib/kirtan/types"

/**
 * The three kinds of one recording (Kiirtan, Bhajan, Prabhat Samgiita) and every visible word that
 * depends on the kind. One recordings system: the kind is a field, not a second system. Pure, no React, no stores.
 * Code identifiers and routes keep the `kirtan` spelling; only the strings below are shown to people.
 * Every word of a kind lives under keys named by the kind id (`kind.<id>`, `kt.head.<id>`, ...), so a new kind needs
 * words and no new code.
 */

export function isRecordingKind(value: unknown): value is RecordingKind {
  return RECORDING_KINDS.includes(value as RecordingKind)
}

/**
 * Anything that is not a known kind (old stored data, a missing field) is a Kiirtan; the removed kind
 * `devotional_song` (old stored data, old server rows) is a Bhajan.
 */
export function normalizeKind(value: unknown): RecordingKind {
  if (isRecordingKind(value)) return value
  return typeof value === "string" ? (LEGACY_KINDS[value] ?? "kiirtan") : "kiirtan"
}

/** The visible name of a kind: `Kiirtan`, `Bhajan` or `Prabhat Samgiita`. */
export function kindLabel(kind: RecordingKind | null | undefined): string {
  return t(`kind.${normalizeKind(kind)}`)
}

/** `Kiirtans`, `Bhajans`, `Prabhat Samgiita recordings`. */
export function kindLabelPlural(kind: RecordingKind | null | undefined): string {
  return t(`kind.${normalizeKind(kind)}s`)
}

/** Small capitals tag of a row: `KIIRTAN`, `BHAJAN`, `PRABHAT SAMGIITA`. */
export function kindTag(kind: RecordingKind | null | undefined): string {
  // upper-cased here, so the name "Prabhat Samgiita" is spelled one way in every dictionary
  return t(`kind.${normalizeKind(kind)}.tag`).toLocaleUpperCase()
}

/** Lower-case noun with a count: `1 kiirtan`, `3 bhajans`. */
export function kindCountLabel(kind: RecordingKind | null | undefined, count: number): string {
  return t(`kind.${normalizeKind(kind)}.count`, { count })
}

/** The second line of the tab heading for a kind chip ("for every hour"). */
export function kindHeading(kind: RecordingKind): string {
  return t(`kt.head.${kind}`)
}

/** What a list holds in a sentence ("Kiirtans", "Bhajans"); `all` says "Kiirtans or Bhajans". */
export function kindWhat(kind: KindFilter): string {
  return t(kind === "all" ? "kt.what.all" : `kt.what.${kind}`)
}

/** `KIIRTAN OF THE DAY` and its spoken form. */
export function kindDayLabel(kind: RecordingKind | null | undefined): string {
  return t(`kt.day.${normalizeKind(kind)}`).toLocaleUpperCase()
}
export function kindDayA11y(kind: RecordingKind | null | undefined, title: string): string {
  return t(`kt.day.a11y.${normalizeKind(kind)}`, { title })
}

/** The toast for "add to a playlist" (not built yet), in the words of the kind. */
export function kindPlaylistsSoon(kind: RecordingKind | null | undefined): string {
  return t(`kt.toast.playlistsSoon.${normalizeKind(kind)}`)
}

export function kindOf(item: { kind?: RecordingKind | null } | null | undefined): RecordingKind {
  return normalizeKind(item?.kind)
}

/** What a list holds: its kind when it is all of one kind, "all" when kinds are mixed (an empty list is "kiirtan"). */
export function listKindOf(list: readonly { kind?: RecordingKind | null }[]): KindFilter {
  if (!list.length) return "kiirtan"
  const first = kindOf(list[0])
  return list.every((x) => kindOf(x) === first) ? first : "all"
}

/** Keeps the items of one kind, or all of them. Items without a kind count as Kiirtans. */
export function filterByKind<T extends { kind?: RecordingKind | null }>(list: readonly T[], kind: KindFilter): T[] {
  return kind === "all" ? [...list] : list.filter((k) => kindOf(k) === kind)
}

/** Only Kiirtans and Bhajans have sub-types (Lila, Morning...). The other kinds are always type "other". */
export function kindHasTypes(kind: RecordingKind): boolean {
  return kind === "kiirtan" || kind === "bhajan"
}

/** "Words and music by" is asked for a Bhajan, not for chanting or a Prabhat Samgiita performance. */
export function kindHasCredits(kind: RecordingKind): boolean {
  return kind === "bhajan"
}

/** The sung language is asked for a Bhajan and a Prabhat Samgiita recording, never for a Kiirtan (types.ts LANGUAGE_KINDS). */
export function kindHasLanguage(kind: RecordingKind | null | undefined): boolean {
  return LANGUAGE_KINDS.includes(normalizeKind(kind))
}

/** The kinds without sub-types have the one type "other". */
const OTHER_ONLY: readonly { id: KirtanTypeId; label: string }[] = [{ id: "other", get label() { return t("kt.type.other") } }]

/** The type choices of a kind, in the order the add form and the type shelf show them. */
export function typesOfKind(kind: RecordingKind): readonly { id: KirtanTypeId; label: string }[] {
  return kind === "bhajan" ? BHAJAN_TYPES : kind === "kiirtan" ? KIRTAN_TYPES : OTHER_ONLY
}

/** Is this type id valid for this kind? ("other" is valid for both.) */
export function isTypeOfKind(kind: RecordingKind, type: unknown): type is KirtanTypeId {
  return typesOfKind(kind).some((t) => t.id === type)
}

/** The type to keep when the kind changes: the same id when both kinds have it, none otherwise. */
export function typeAfterKindChange(kind: RecordingKind, type: KirtanTypeId | null): KirtanTypeId | null {
  return type && isTypeOfKind(kind, type) ? type : null
}

/** `Kiirtan · Priya Devi` when the author is a known artist, `Bhajan · added by Ananda Marga team` otherwise, or just `Bhajan`: the player's subtitle (same rule as lib/kirtan/artists kiirtanSubtitle, which is the Kiirtan case). */
export function kindSubtitle(kind: RecordingKind | null | undefined, author: string | null | undefined, addedBy: string | null | undefined, artists: readonly Artist[]): string {
  const label = kindLabel(kind)
  const artist = artistForAuthor(artists, author)
  if (artist) return `${label} · ${artist.name}`
  const who = (addedBy ?? "").trim()
  return who ? t("kind.subtitle.addedBy", { kind: label, name: who }) : label
}

/** `Kiirtan, Title. 12:40`: the spoken label of a row. */
export function kindSpokenLabel(kind: RecordingKind | null | undefined, title: string, subline: string): string {
  return t("kind.spokenLabel", { kind: kindLabel(kind), title, subline })
}

/** Gives an item stored before kinds existed its kind. */
export function withKind<T extends { kind?: unknown }>(item: T): T & { kind: RecordingKind } {
  return { ...item, kind: normalizeKind(item.kind) }
}

export function kindOfKirtan(k: Pick<Kirtan, "kind">): RecordingKind {
  return normalizeKind(k.kind)
}

/** `5 kiirtans · 2 bhajans`: what a list holds. A kind with none is left out; an empty list says `0 kiirtans`. */
export function kindsCountLabel(list: readonly { kind?: RecordingKind | null }[]): string {
  const counts = RECORDING_KINDS.map((kind) => ({ kind, count: list.filter((x) => kindOf(x) === kind).length }))
  const shown = counts.filter((c) => c.count > 0)
  if (!shown.length) return kindCountLabel("kiirtan", 0)
  return shown.map((c) => kindCountLabel(c.kind, c.count)).join(" · ")
}

/** Swaps the leading word "Kiirtan" of a ready-made line for the kind's word (`Kiirtan · 1:05 of 12:40` to `Bhajan · 1:05 of 12:40`). Other lines stay. */
export function withKindWord(text: string, kind: RecordingKind | null | undefined): string {
  const word = t("kind.kiirtan")
  const own = normalizeKind(kind)
  return own !== "kiirtan" && text.startsWith(word) ? `${kindLabel(own)}${text.slice(word.length)}` : text
}
