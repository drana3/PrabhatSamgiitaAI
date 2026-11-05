import { formatKirtanLength } from "@/lib/kirtan/list"
import type { Kirtan } from "@/lib/kirtan/types"

/** `Resume 4:18 of 12:40`. */
export function resumeLabel(positionSec: number, durationSec: number | null): string {
  const at = formatKirtanLength(positionSec)
  return durationSec ? `Resume ${at} of ${formatKirtanLength(durationSec)}` : `Resume ${at}`
}

/** 0 to 1 of the way through; 0 while the length is unknown. */
export function resumeProgress(positionSec: number, durationSec: number | null): number {
  if (!durationSec || durationSec <= 0) return 0
  return Math.min(1, Math.max(0, positionSec / durationSec))
}

export type ResumeEntry<T> = { kirtan: T; positionSec: number }

/** "Jump back in": the entries that point at a known, approved Kiirtan and are neither at the start nor at the end. */
export function resumeEntries<T extends Pick<Kirtan, "id" | "status" | "durationSec">>(
  positions: readonly { id: string; positionSec: number }[],
  byId: ReadonlyMap<string, T>,
  limit = 2,
): ResumeEntry<T>[] {
  const out: ResumeEntry<T>[] = []
  for (const pos of positions) {
    const kirtan = byId.get(pos.id)
    if (!kirtan || kirtan.status !== "approved" || pos.positionSec <= 0) continue
    if (kirtan.durationSec && pos.positionSec >= kirtan.durationSec - 5) continue
    out.push({ kirtan, positionSec: pos.positionSec })
    if (out.length >= limit) break
  }
  return out
}

/** "Kiirtan of the day": the same one all day, a different one tomorrow. `dayNumber` is days since the epoch. */
export function kiirtanOfTheDay<T>(list: readonly T[], dayNumber: number): T | null {
  if (!list.length) return null
  const i = ((Math.trunc(dayNumber) % list.length) + list.length) % list.length
  return list[i] ?? null
}

export function dayNumberOf(ms: number): number {
  return Math.floor(ms / 86_400_000)
}
