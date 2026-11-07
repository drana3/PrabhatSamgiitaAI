import { remoteConfig } from "@/lib/kirtan/api"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { useAuthStore } from "@/stores/authStore"

import { MockFailure, PREVIEW_NAME, createMockBackend, mockFailure } from "./mock"
import { failureFromError, remoteBackend } from "./remote"
import type { ChordFailure, ChordsBackend } from "./types"

/**
 * Which server the chord screens talk to: the real API, or in the web preview (`EXPO_PUBLIC_MOCKUP_DATA=1`) an
 * in-memory one that keeps the charts until the page is reloaded. Chosen when asked, never at module load.
 */
let mock: ChordsBackend | null = null

export function previewName(): string {
  const auth = useAuthStore.getState()
  return auth.mode === "signed_in" && auth.displayName ? auth.displayName : PREVIEW_NAME
}

/**
 * Preview only: `?team` in the address makes the previewing member count as the team, to try the review screen. Once
 * seen it sticks for the page's life, because moving between screens drops the query from the address.
 */
let teamSeen = false
function previewTeam(): boolean {
  if (teamSeen) return true
  try {
    teamSeen = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("team")
  } catch {
    teamSeen = false
  }
  return teamSeen
}

/** Preview only: `?guest` in the address previews the screens as someone who is not signed in. */
export function previewGuest(): boolean {
  return previewParam("guest") !== null
}

/** Preview only: `?empty` in the address starts the preview member with no charts (the empty Upload hub). */
function previewEmpty(): boolean {
  try {
    return typeof window !== "undefined" && new URLSearchParams(window.location.search).has("empty")
  } catch {
    return false
  }
}

/**
 * Preview only, to look at the failure screens: `?fail=network` (or any other failure name, such as `dailyLimit`,
 * `duplicate`, `tooMany`, `server`) makes every send, fix and delete fail that way; `?failList` makes the lists fail
 * as if offline.
 */
function previewParam(name: string): string | null {
  try {
    return typeof window !== "undefined" ? new URLSearchParams(window.location.search).get(name) : null
  } catch {
    return null
  }
}

function withPreviewFailures(base: ChordsBackend): ChordsBackend {
  const write = previewParam("fail") as ChordFailure | null
  const list = previewParam("failList") !== null
  if (!write && !list) return base
  const failWrite = () => Promise.reject(new MockFailure(write ?? "network"))
  const failRead = () => Promise.reject(new MockFailure("network"))
  return {
    ...base,
    ...(write ? { offer: failWrite, update: failWrite, remove: failWrite } : {}),
    ...(list ? { mine: failRead, listForSong: failRead } : {}),
  }
}

export function chordsBackend(): ChordsBackend {
  if (MOCKUP_DATA) {
    mock ??= createMockBackend({ me: previewName, team: previewTeam, seedMine: !previewEmpty() })
    return withPreviewFailures(mock)
  }
  return remoteBackend(remoteConfig())
}

/** One place that turns any error of either backend into a failure the screens have a sentence for. */
export function chordFailure(error: unknown): ChordFailure {
  return mockFailure(error) ?? failureFromError(error)
}
