import { allKirtans } from "@/lib/kirtan/catalog"
import type { RemoteRecording } from "@/lib/kirtan/remote"
import type { Kirtan, RecordingKind } from "@/lib/kirtan/types"
import { useKirtanStore } from "@/stores/kirtanStore"

/**
 * "This file is already in the library" and "Sounds like a recording already in the library" both point at a recording
 * the person can listen to before deciding. The server names it by id, title, author and audio link; this finds it in
 * the app's list, or adds it to the catalogue from those four facts so the one player can queue it. Outside React.
 */

export type OriginalRef = { id: string; title: string; author: string; audioUrl: string; kind?: RecordingKind }

/** A server recording reduced to the facts a brief carries. The rest is filled with neutral values. */
function recordingFromRef(ref: OriginalRef): RemoteRecording {
  return {
    id: ref.id,
    kind: ref.kind ?? "kiirtan",
    type: "other",
    title: ref.title,
    author: ref.author,
    added_by: "",
    author_id: null,
    by_author: false,
    status: "published",
    duration_sec: null,
    plays: 0,
    audio_url: ref.audioUrl,
    thumbnail_url: null,
    published_at: null,
    created_at: new Date(0).toISOString(),
  }
}

function find(id: string): Kirtan | null {
  return allKirtans().find((k) => k.serverId === id || k.id === id) ?? null
}

/** The recording as a playable item of the app, or null when it cannot be played (no audio link, or not published). */
export function playableOriginal(ref: OriginalRef): Kirtan | null {
  const known = find(ref.id)
  if (known) return known.status === "published" ? known : null
  if (!ref.audioUrl) return null
  useKirtanStore.getState().addToCatalog([recordingFromRef(ref)])
  return find(ref.id)
}
