import { t } from "@/lib/i18n"

/**
 * The practice a Kiirtan is for. Today one: "avarta" (Avarta Kiirtan, a special style of kiirtan done by facing six
 * different directions in turn; the sources are listed in docs/kiirtan-practice.md). It is a flag
 * on a Kiirtan, a sub-category INSIDE Kiirtan, never a kind of its own. The same id lives in the API
 * (`apps/api/app/services/recording_practice.py`); `__tests__/kirtanPractice.test.ts` and
 * `apps/api/tests/test_recording_practice.py` pin the two sides. Only a Kiirtan carries it.
 */
export const PRACTICES = ["avarta"] as const
export type PracticeId = (typeof PRACTICES)[number]
export const AVARTA: PracticeId = "avarta"

export function isPractice(value: unknown): value is PracticeId {
  return typeof value === "string" && (PRACTICES as readonly string[]).includes(value)
}

/** The practice an upload keeps: a known id, and only for a Kiirtan. Anything else is nothing. */
export function cleanPractice(kind: string, practice: string | null | undefined): PracticeId | null {
  return kind === "kiirtan" && isPractice(practice) ? practice : null
}

/** The visible name of a practice. */
export function practiceLabel(practice: PracticeId = AVARTA): string {
  return t(`practice.${practice}` as const)
}

/** The recordings of a list that are Avarta Kiirtan. */
export function avartaOnly<T extends { kind?: string | null; practice?: string | null }>(list: readonly T[]): T[] {
  return list.filter((item) => isAvarta(item))
}

/**
 * How many Avarta Kiirtan the list holds. The Kiirtan tab shows its "Avarta Kiirtan" choice only when this is more than
 * nothing: a category with no recording is never shown (docs/kiirtan-practice.md).
 */
export function avartaCount(list: readonly { kind?: string | null; practice?: string | null }[]): number {
  return avartaOnly(list).length
}

/** Is this item an Avarta Kiirtan? */
export function isAvarta(item: { kind?: string | null; practice?: string | null } | null | undefined): boolean {
  return !!item && item.practice === AVARTA && (item.kind ?? "kiirtan") === "kiirtan"
}

/** May this person change the mark? A published Kiirtan, and the person who uploaded it or the team. */
export function canEditPractice(k: { kind?: string | null; status: string }, who: { mine: boolean; team: boolean }): boolean {
  if (!who.mine && !who.team) return false
  return k.status === "published" && (k.kind ?? "kiirtan") === "kiirtan"
}

/** The value to save when the switch is turned `on` or off. */
export function nextPractice(on: boolean): string | null {
  return on ? AVARTA : null
}
