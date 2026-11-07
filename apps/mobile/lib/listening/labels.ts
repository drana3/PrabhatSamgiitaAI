import { BABA_AUDIO_KIND } from "@/lib/searchMenu/kinds"
import { kindLabel } from "@/lib/kirtan/kind"
import type { RecordingKind } from "@/lib/kirtan/types"
import { t } from "@/lib/i18n"

/** The visible name of a history entry's kind: Prabhat Samgiita, Baba's Audio Discourses, or the recording kinds. */
export function historyKindLabel(kind: string): string {
  if (kind === "prabhat_samgiita") return t("history.kind.ps")
  if (kind === BABA_AUDIO_KIND) return t("searchMenu.baba.title")
  return kindLabel(kind as RecordingKind)
}

/** `Kind · Author` (the author only for recordings that name one). */
export function historySubline(entry: { kind: string; author?: string }): string {
  const kind = historyKindLabel(entry.kind)
  const who = (entry.author ?? "").trim()
  return who ? `${kind} · ${who}` : kind
}

/** `14:05` in the device's own clock style. */
export function historyTime(at: number): string {
  try {
    return new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  } catch {
    return ""
  }
}
