import { audioRecordingLabel } from "@/lib/mediaEmbed"

export type VersionInstrument = "voice" | "guitar" | "harmonium" | "group" | "instrumental"

export type SongVersion = {
  id: string
  url: string
  instrument: VersionInstrument
  performer: string
  /** seconds, only when the real length is known */
  length: number | null
  tag: "Best" | "Verified" | "Community" | null
}

type Recording = { title: string; url: string; provider: string }

export function inferInstrument(title: string): VersionInstrument {
  const t = title.toLowerCase()
  if (/guitar/.test(t)) return "guitar"
  if (/harmonium/.test(t)) return "harmonium"
  if (/instrumental|karaoke|backing/.test(t)) return "instrumental"
  if (/group|chorus|kiirtan|kirtan|choir/.test(t)) return "group"
  return "voice"
}

export const INSTRUMENT_LABEL: Record<VersionInstrument, string> = {
  voice: "Voice",
  guitar: "Guitar",
  harmonium: "Harmonium",
  group: "Group",
  instrumental: "Instrumental",
}

function tagFor(provider: string, index: number): SongVersion["tag"] {
  if (index === 0) return "Best"
  const p = provider.toLowerCase()
  if (p === "official" || p.includes("verified")) return "Verified"
  if (p.includes("community")) return "Community"
  return null
}

/** Versions of a song from the catalog recordings. A title like "Guitar - Performer B" is split into instrument and performer. */
export function buildVersions(
  recordings: Recording[] | undefined,
  fallbackPerformer: string,
  currentUrl: string | null | undefined,
  currentLength: number,
): SongVersion[] {
  return (recordings ?? []).map((recording, index) => {
    const label = audioRecordingLabel(recording, index)
    const instrument = inferInstrument(label)
    const performer =
      label.replace(/\b(guitar|harmonium|instrumental|voice|group)\b/gi, "").replace(/^[\s\-–·:]+|[\s\-–·:]+$/g, "") ||
      fallbackPerformer
    return {
      id: recording.url,
      url: recording.url,
      instrument,
      performer,
      length: currentUrl === recording.url && currentLength > 0 ? currentLength : null,
      tag: tagFor(recording.provider, index),
    }
  })
}

export function formatLength(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return ""
  const total = Math.floor(seconds)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`
}

/** `Voice · Performer A · 3:58` — the one-line version picker. Length is left out when unknown. */
export function versionLine(version: SongVersion | null): string {
  if (!version) return "No recording yet"
  return [INSTRUMENT_LABEL[version.instrument], version.performer, formatLength(version.length)]
    .filter(Boolean)
    .join(" · ")
}

/** `Instrument · length · tag` under the performer name in the sheet. */
export function versionDetail(version: SongVersion): string {
  return [INSTRUMENT_LABEL[version.instrument], formatLength(version.length), version.tag].filter(Boolean).join(" · ")
}

/** What picking a version does to the chord settings (spec round 7). */
export function chordsForVersion(
  instrument: VersionInstrument,
): { chordsOn: boolean; instrument: "guitar" | "harmonium" } | null {
  if (instrument === "guitar") return { chordsOn: true, instrument: "guitar" }
  if (instrument === "harmonium") return { chordsOn: true, instrument: "harmonium" }
  return null
}

export type DownloadPhase = "idle" | "downloading" | "saved"

export function downloadPhase(state: { downloaded: boolean; downloading: boolean }): DownloadPhase {
  if (state.downloading) return "downloading"
  return state.downloaded ? "saved" : "idle"
}

/** `Download`, `Downloading 45%`, `Downloaded`. */
export function downloadLabel(phase: DownloadPhase, progress?: number): string {
  if (phase === "saved") return "Downloaded"
  if (phase === "downloading") {
    return progress != null && progress > 0 ? `Downloading ${Math.round(progress * 100)}%` : "Downloading"
  }
  return "Download"
}
