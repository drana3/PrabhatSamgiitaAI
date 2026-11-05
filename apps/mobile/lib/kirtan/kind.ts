import { t } from "@/lib/i18n"
import { artistForAuthor, type Artist } from "@/lib/kirtan/artists"
import { BHAJAN_TYPES, KIRTAN_TYPES, RECORDING_KINDS, type KindFilter, type Kirtan, type KirtanTypeId, type RecordingKind } from "@/lib/kirtan/types"

/**
 * The two kinds of one recording, Kiirtan and Bhajan, and every visible word that depends on the kind.
 * One recordings system: the kind is a field, not a second system. Pure, no React, no stores.
 * Code identifiers and routes keep the `kirtan` spelling; only the strings below are shown to people.
 */

export function isRecordingKind(value: unknown): value is RecordingKind {
  return RECORDING_KINDS.includes(value as RecordingKind)
}

/** Anything that is not a known kind (old stored data, a missing field) is a Kiirtan. */
export function normalizeKind(value: unknown): RecordingKind {
  return value === "bhajan" ? "bhajan" : "kiirtan"
}

/** The visible name of a kind: `Kiirtan` or `Bhajan`. */
export function kindLabel(kind: RecordingKind | null | undefined): string {
  return kind === "bhajan" ? t("kind.bhajan") : t("kind.kiirtan")
}

/** `Kiirtans` or `Bhajans`. */
export function kindLabelPlural(kind: RecordingKind | null | undefined): string {
  return kind === "bhajan" ? t("kind.bhajans") : t("kind.kiirtans")
}

/** Small capitals tag of a row: `KIIRTAN` or `BHAJAN`. */
export function kindTag(kind: RecordingKind | null | undefined): string {
  return kind === "bhajan" ? t("kind.bhajan.tag") : t("kind.kiirtan.tag")
}

/** Lower-case noun with a count: `1 kiirtan`, `3 bhajans`. */
export function kindCountLabel(kind: RecordingKind | null | undefined, count: number): string {
  return kind === "bhajan" ? t("kind.bhajan.count", { count }) : t("kind.kiirtan.count", { count })
}

export function kindOf(item: { kind?: RecordingKind | null } | null | undefined): RecordingKind {
  return normalizeKind(item?.kind)
}

/** What a list holds: "bhajan" or "kiirtan" when it is all of one kind, "all" when both kinds are in it (an empty list is "kiirtan"). */
export function listKindOf(list: readonly { kind?: RecordingKind | null }[]): KindFilter {
  const bhajans = list.filter((x) => kindOf(x) === "bhajan").length
  if (bhajans === 0) return "kiirtan"
  return bhajans === list.length ? "bhajan" : "all"
}

/** Keeps the items of one kind, or all of them. Items without a kind count as Kiirtans. */
export function filterByKind<T extends { kind?: RecordingKind | null }>(list: readonly T[], kind: KindFilter): T[] {
  return kind === "all" ? [...list] : list.filter((k) => kindOf(k) === kind)
}

/** The type choices of a kind, in the order the add form and the type shelf show them. */
export function typesOfKind(kind: RecordingKind): readonly { id: KirtanTypeId; label: string }[] {
  return kind === "bhajan" ? BHAJAN_TYPES : KIRTAN_TYPES
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
  return kind === "bhajan" && text.startsWith(word) ? `${t("kind.bhajan")}${text.slice(word.length)}` : text
}
