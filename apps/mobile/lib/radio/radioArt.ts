import type { RecordingKind } from "@/lib/kirtan/types"
import { hashSeed } from "@/lib/photos/pick"

/**
 * The picture behind the Radio player for the track that plays. Pure: it only decides WHICH picture; the component draws it.
 *
 * Order (the first that exists wins):
 *  1. the cover of the recording (an uploaded recording may have one);
 *  2. the photograph of its author;
 *  3. a stock photo without people, the same one every time for the same track (mood from the title and length).
 *  Baba's Audio Discourses show a photograph of Baba in a clean frame BELOW the channel row, never under text, a scrim or a
 *  button (docs/photo-system.md, "Baba photos"). That one is a different layout, see `radioHeroLayout`.
 * There is no picture per collection in the data, so a collection has no picture of its own here.
 */
export type RadioArt =
  | { kind: "cover"; uri: string }
  | { kind: "author"; uri: string }
  | { kind: "stock"; seed: string }
  | { kind: "baba"; id: "today" }

const isRemote = (uri: string | null | undefined): uri is string => typeof uri === "string" && /^(https?:|file:|data:image)/.test(uri.trim())

export function radioArtFor(input: {
  recordingKind: RecordingKind | null
  coverUrl?: string | null
  authorPhotoUrl?: string | null
  /** a stable id of the track: its number or recording id */
  seed: string
}): RadioArt {
  if (input.recordingKind === "baba_audio") return { kind: "baba", id: "today" }
  if (isRemote(input.coverUrl)) return { kind: "cover", uri: input.coverUrl.trim() }
  if (isRemote(input.authorPhotoUrl)) return { kind: "author", uri: input.authorPhotoUrl.trim() }
  return { kind: "stock", seed: `radio-${input.seed}` }
}

/** "photo-under-controls": the picture fills the top and the channel row sits on it. "baba-clean": the row sits above a clean framed photograph. */
export function radioHeroLayout(art: RadioArt): "photo-under-controls" | "baba-clean" {
  return art.kind === "baba" ? "baba-clean" : "photo-under-controls"
}

/** A small stable number for a seed (which of several equal choices), exported for tests. */
export const radioSeedNumber = (seed: string) => hashSeed(seed)
