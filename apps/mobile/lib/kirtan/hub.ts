import { filterByKind, kindCountLabel, kindHasTypes, kindOf, typesOfKind } from "@/lib/kirtan/kind"
import type { Kirtan, KirtanTypeId, RecordingKind } from "@/lib/kirtan/types"
import { RECORDING_KINDS } from "@/lib/kirtan/types"
import { t } from "@/lib/i18n"

/**
 * The rebuilt Kiirtan tab (Dada, 10 Nov 2026): the category cards, the one Saved list, My uploads grouped by kind and the
 * address of the full-list screen. Pure: no React, no stores.
 */

/**
 * The kinds the Kiirtan tab shows as a chip and a card, in Dada's order. Prabhat Samgiita is not here on purpose: that
 * tag and category left this page (decision 9); its recordings stay in New recordings and on the author's page.
 */
export const HUB_KINDS: readonly RecordingKind[] = ["kiirtan", "bhajan", "spiritual_song", "dance_song", "baba_audio", "other_mantra"]

export type KindCard = { kind: RecordingKind; count: number; empty: boolean }

/** One card per kind with its real count. A kind with no recording is "empty": the card is drawn pale. */
export function kindCards(list: readonly Pick<Kirtan, "kind">[]): KindCard[] {
  return HUB_KINDS.map((kind) => {
    const count = filterByKind(list, kind).length
    return { kind, count, empty: count === 0 }
  })
}

/** The line under a card's name: `15 kiirtans`, or `No recordings yet`. */
export function kindCardLine(card: Pick<KindCard, "kind" | "count">): string {
  return card.count > 0 ? kindCountLabel(card.kind, card.count) : t("kh.cat.none")
}

/** The spoken label of a card. */
export function kindCardA11y(card: Pick<KindCard, "kind" | "count">, kindName: string): string {
  return card.count > 0 ? t("kh.cat.a11y", { kind: kindName, count: kindCountLabel(card.kind, card.count) }) : t("kh.cat.a11yNone", { kind: kindName })
}

/* ------------------------------------------------------------------ one Saved list */

/**
 * Saved and Downloaded are ONE list (Dada, 10 Nov 2026): what the person saved, in the order it was saved, and then whatever is on
 * the phone without a save (downloaded before this rule; a download is a save from now on). Unpublished or unknown ids are left out.
 */
export function savedWithDownloads<T extends Pick<Kirtan, "id" | "status">>(savedIds: readonly string[], byId: ReadonlyMap<string, T>, downloaded: readonly T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const id of savedIds) {
    const k = byId.get(id)
    if (k && k.status === "published" && !seen.has(k.id)) {
      seen.add(k.id)
      out.push(k)
    }
  }
  for (const k of downloaded) {
    if (k.status === "published" && !seen.has(k.id)) {
      seen.add(k.id)
      out.push(k)
    }
  }
  return out
}

/** The "Only on this phone" switch: keeps the downloaded ones. */
export function onlyOnPhone<T extends Pick<Kirtan, "id">>(list: readonly T[], downloaded: readonly Pick<Kirtan, "id">[]): T[] {
  const ids = new Set(downloaded.map((k) => k.id))
  return list.filter((k) => ids.has(k.id))
}

/** The kinds present in a list, in the order of the chips (then any other kind, such as Prabhat Samgiita, last). */
export function kindsPresent(list: readonly Pick<Kirtan, "kind">[]): RecordingKind[] {
  const present = new Set(list.map((k) => kindOf(k)))
  const order: RecordingKind[] = [...HUB_KINDS, ...RECORDING_KINDS.filter((k) => !HUB_KINDS.includes(k))]
  return order.filter((k) => present.has(k))
}

/* ------------------------------------------------------------------ My uploads by kind */

export type KindGroup<T> = { kind: RecordingKind; items: T[] }

/**
 * The person's own recordings grouped by the kind they were uploaded as, in the order of the chips; a kind with none is left out
 * and the order inside a group is kept (newest first as given). Every recording is in a group: nothing the author uploaded
 * is hidden, whatever its kind.
 */
export function groupByKind<T extends Pick<Kirtan, "kind">>(list: readonly T[]): KindGroup<T>[] {
  return kindsPresent(list).map((kind) => ({ kind, items: filterByKind(list, kind) }))
}

/* ------------------------------------------------------------------ types inside a kind */

export type TypeChip = { id: KirtanTypeId; label: string; count: number }

/** The types of a kind with their counts (Kiirtan: Baba Nam Kevalam, Lila...; Bhajan: Morning...; Others: Guru Puja...). Kinds without types give none. */
export function typeChips(list: readonly Pick<Kirtan, "kind" | "type">[], kind: RecordingKind): TypeChip[] {
  if (!kindHasTypes(kind)) return []
  const ofKind = filterByKind(list, kind)
  return typesOfKind(kind).map((type) => ({ id: type.id, label: type.label, count: ofKind.filter((k) => k.type === type.id).length }))
}

/** The recordings of a kind, narrowed to one type (null: all of the kind). */
export function listOfKind<T extends Pick<Kirtan, "kind" | "type">>(list: readonly T[], kind: RecordingKind, type: KirtanTypeId | null): T[] {
  const ofKind = filterByKind(list, kind)
  return type ? ofKind.filter((k) => k.type === type) : ofKind
}

/* ------------------------------------------------------------------ the full-list screen's address */

export type HubListMode = "category" | "saved" | "mine"

export const KIIRTAN_LIST_PATH = "/kiirtan-list"

/** `/kiirtan-list?mode=category&kind=bhajan`, `...?mode=saved&phone=1`, `...?mode=mine`. */
export function kiirtanListHref(target: { mode: "category"; kind: RecordingKind } | { mode: "saved"; phone?: boolean } | { mode: "mine" }): string {
  if (target.mode === "category") return `${KIIRTAN_LIST_PATH}?mode=category&kind=${target.kind}`
  if (target.mode === "saved") return `${KIIRTAN_LIST_PATH}?mode=saved${target.phone ? "&phone=1" : ""}`
  return `${KIIRTAN_LIST_PATH}?mode=mine`
}

/** The Add Recording form; on a tab of Others it opens with the type already on Others (Others is a type of that one form). */
export function addRecordingHref(kind: RecordingKind | "all"): string {
  return kind === "other_mantra" ? "/add-kirtan?kind=other_mantra" : "/add-kirtan"
}

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? ""
}

export type HubListParams = { mode: HubListMode; kind: RecordingKind; phone: boolean }

/** Reads the list screen's parameters; anything unknown is the first category. */
export function parseHubListParams(params: { mode?: string | string[]; kind?: string | string[]; phone?: string | string[] }): HubListParams {
  const mode = first(params.mode)
  const kind = first(params.kind)
  return {
    mode: mode === "saved" || mode === "mine" ? mode : "category",
    kind: (HUB_KINDS as readonly string[]).includes(kind) ? (kind as RecordingKind) : "kiirtan",
    phone: first(params.phone) === "1",
  }
}

/**
 * The old chips of the tab (`?filter=saved`, `downloaded`, `mine`) are still linked from the profile, the library and the
 * upload exit: they open the list screen now. Anything else stays on the tab.
 */
export function listAddressOfFilter(value: string | string[] | undefined): string | null {
  const filter = first(value)
  if (filter === "saved") return kiirtanListHref({ mode: "saved" })
  if (filter === "downloaded") return kiirtanListHref({ mode: "saved", phone: true })
  if (filter === "mine") return kiirtanListHref({ mode: "mine" })
  return null
}
