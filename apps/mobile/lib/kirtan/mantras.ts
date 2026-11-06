import { t } from "@/lib/i18n"
import type { RemoteMantra } from "@/lib/kirtan/remote"
import type { Kirtan, RecordingKind } from "@/lib/kirtan/types"

/**
 * Mantras: many performances of one chant are VERSIONS of it, not duplicates (docs/kiirtan-publishing.md, "Duplicates").
 * The uploader types the mantra as free text; the server turns it into a key and keeps one group per key, and this file
 * applies the same rule on the phone for the demo preview and for the "N versions" line while a person types.
 * Pure: no React, no network. The key rule is the API's `mantra_key` (apps/api/app/services/mantras.py); keep them equal.
 */

export type MantraSummary = { id: string; kind: RecordingKind; title: string; versions: number; plays: number }

/** The longest key the server keeps. */
const KEY_LIMIT = 200

/**
 * Lower case, accents of Latin letters removed, everything but letters and digits dropped:
 * "Baba Nam Kevalam", "Bábá Nám Kevalam" and "baba-nam-kevalam" all give `babanamkevalam`.
 * Letters of other scripts keep their combining marks (Devanagari, Cyrillic), only case and punctuation go.
 */
export function mantraKey(text: string | null | undefined): string {
  if (!text) return ""
  const kept: string[] = []
  for (const char of text.normalize("NFKD").toLowerCase()) {
    const mark = /\p{Mn}/u.test(char)
    const previous = kept[kept.length - 1]
    if (mark && previous && (previous.codePointAt(0) ?? 0) < 0x250 && /\p{L}/u.test(previous)) continue
    if (/[\p{L}\p{N}\p{M}]/u.test(char)) kept.push(char)
  }
  return kept.join("").normalize("NFC").slice(0, KEY_LIMIT)
}

/** The mantra as shown: whitespace collapsed. */
export function cleanMantra(text: string | null | undefined): string {
  return (text ?? "").trim().replace(/\s+/g, " ").slice(0, 200)
}

export function summaryFromRemote(remote: RemoteMantra): MantraSummary {
  return { id: remote.id, kind: remote.kind, title: remote.title, versions: remote.versions, plays: remote.plays }
}

/** "1 version of this mantra" / "12 versions of this mantra". */
export function versionsOfThisLabel(count: number): string {
  return t("mantra.versionsOfThis", { count })
}

/** The word alone, for a large number shown beside it: "version" / "versions". Taken from the counted label, so it follows each language's plural rule. */
export function versionWord(count: number): string {
  return t("mantra.versions", { count }).replace(String(count), "").trim()
}

/** "1 version" / "12 versions". */
export function versionsLabel(count: number): string {
  return t("mantra.versions", { count })
}

/* ------------------------------------------------------------------ the same on the phone (demo preview) */

function liveVersions(list: readonly Kirtan[]): Kirtan[] {
  return list.filter((k) => k.status === "published" && Boolean(mantraKey(k.mantra)))
}

/** The id the mantra page opens with: the server's group id, else a stable one made from the key (demo preview). */
export function localMantraId(k: Pick<Kirtan, "mantra" | "mantraId">): string {
  return k.mantraId ?? `local-${mantraKey(k.mantra)}`
}

/** Mantras of a list of recordings, most versions first (the title of the newest version names the group). */
export function groupLocalMantras(list: readonly Kirtan[], kind?: RecordingKind): MantraSummary[] {
  const groups = new Map<string, { summary: MantraSummary; newest: number }>()
  for (const k of liveVersions(list)) {
    if (kind && k.kind !== kind) continue
    const key = mantraKey(k.mantra)
    const found = groups.get(key)
    if (found) {
      found.summary.versions += 1
      found.summary.plays += k.plays ?? 0
      if (k.addedAt > found.newest) {
        found.newest = k.addedAt
        found.summary.title = cleanMantra(k.mantra)
      }
    } else {
      groups.set(key, { summary: { id: localMantraId(k), kind: k.kind, title: cleanMantra(k.mantra), versions: 1, plays: k.plays ?? 0 }, newest: k.addedAt })
    }
  }
  return [...groups.values()].map((g) => g.summary).sort((a, b) => b.versions - a.versions || a.title.localeCompare(b.title))
}

/** Autocomplete from the phone's own list: groups whose key contains the typed text; those that START with it first. */
export function suggestLocalMantras(list: readonly Kirtan[], query: string, kind: RecordingKind, limit = 6): MantraSummary[] {
  const needle = mantraKey(query)
  const all = groupLocalMantras(list, kind)
  if (!needle) return all.slice(0, limit)
  const keyOf = (m: MantraSummary) => mantraKey(m.title)
  const hits = all.filter((m) => keyOf(m).includes(needle))
  hits.sort((a, b) => Number(keyOf(b).startsWith(needle)) - Number(keyOf(a).startsWith(needle)) || b.versions - a.versions)
  return hits.slice(0, limit)
}

/** How many versions of exactly this mantra (spelling-proof) the list holds. */
export function lookupLocalMantra(list: readonly Kirtan[], title: string, kind: RecordingKind): { mantra: MantraSummary | null; versions: number } {
  const key = mantraKey(title)
  if (!key) return { mantra: null, versions: 0 }
  const mantra = groupLocalMantras(list, kind).find((m) => mantraKey(m.title) === key) ?? null
  return { mantra, versions: mantra?.versions ?? 0 }
}

/** The versions of one mantra in a list, newest or most played first. */
export function localVersions(list: readonly Kirtan[], id: string, sort: "newest" | "plays"): { mantra: MantraSummary | null; items: Kirtan[] } {
  const items = liveVersions(list).filter((k) => localMantraId(k) === id)
  if (!items.length) return { mantra: null, items: [] }
  const mantra = groupLocalMantras(items)[0] ?? null
  const ordered = [...items].sort((a, b) => (sort === "plays" ? (b.plays ?? 0) - (a.plays ?? 0) || b.addedAt - a.addedAt : b.addedAt - a.addedAt))
  return { mantra, items: ordered }
}
