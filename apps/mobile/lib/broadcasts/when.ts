import type { Broadcast } from "./types"
import { phaseNow } from "./rules"

const TAGS: Record<string, string> = { en: "en-GB", ru: "ru-RU", es: "es-ES" }

/** A moment as the person reads it, in the phone's own zone: "Tue, 10 Nov, 18:30". */
export function whenLabel(iso: string, language: string): string {
  try {
    return new Intl.DateTimeFormat(TAGS[language] ?? language, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso))
  } catch {
    return iso.slice(0, 16).replace("T", " ")
  }
}

/** The line under a broadcast's title: when it starts, or since when it is on, or when it ended. `t` is the screen's translator. */
export function whenLine(b: Broadcast, t: (key: string, vars?: Record<string, string | number>) => string, language: string, now: number = Date.now()): string {
  const phase = phaseNow(b, now)
  if (phase === "ended") return t("bc.p.endedAt", { when: whenLabel(b.endsAt, language) })
  if (phase === "upcoming" && b.startsAt) return t("bc.p.starts", { when: whenLabel(b.startsAt, language) })
  if (b.startsAt) return t("bc.p.started", { when: whenLabel(b.startsAt, language) })
  return t("bc.p.liveNow")
}
