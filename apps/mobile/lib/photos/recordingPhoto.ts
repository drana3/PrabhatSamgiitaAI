import { normalizeKind } from "@/lib/kirtan/kind"
import type { RecordingKind } from "@/lib/kirtan/types"
import { moodForText, pickFromList } from "@/lib/photos/pick"
import type { PhotoMood, StockPhotoMeta } from "@/lib/photos/photoData"

/**
 * The photo of an uploaded recording (Dada, 10 Nov 2026): nobody uploads a picture. The SYSTEM gives every recording one from
 * our own library (docs/photo-system.md), chosen by two things only:
 *  - the SEED, the recording's id: the same id always gets the same photo, on the row, the recording page, the player, the mini
 *    player and the share card (they all read it from here, through `KiirtanCover`), and different ids spread over the library;
 *  - the MOOD: one the title or the length tells (morning, night, festival, long ...), else the one that belongs to the KIND.
 * Pure rules, no images: the list is passed in, so this runs in tests. The default rules of `photoForSeed` hold (no close or
 * children photo, no low-resolution picture, never Baba).
 */

/**
 * The mood a kind leans to when its title says none. Kiirtan, Bhajan and Prabhat Samgiita take any warm photo (the widest pool),
 * a spiritual song, a talk and the other mantras a calm one, Dance music a festival one.
 */
export const KIND_MOOD: Readonly<Record<RecordingKind, PhotoMood | undefined>> = {
  kiirtan: undefined,
  bhajan: undefined,
  prabhat_samgiita: undefined,
  spiritual_song: "calm",
  dance_song: "festival",
  baba_audio: "calm",
  other_mantra: "calm",
}

/**
 * The seed of a recording's photo: its id on the server once it is up (so the uploader, the listener and every device see the
 * same photo), else the phone's own id. A recording that was never sent keeps its local id.
 */
export function recordingSeed(recording: { id: string; serverId?: string | null }): string {
  return recording.serverId || recording.id
}

/** The mood that fits a recording: its title and length first (a night Kiirtan), then its kind. Undefined = any warm photo. */
export function recordingMood(kind: unknown, title?: string | null, durationSec?: number | null): PhotoMood | undefined {
  return moodForText(title ?? "", durationSec) ?? KIND_MOOD[normalizeKind(kind)]
}

/** The photo of a recording from a list of photos: stable for an id, varying across ids. */
export function pickRecordingPhoto<T extends Pick<StockPhotoMeta, "tone" | "moods"> & Partial<Pick<StockPhotoMeta, "people" | "lowRes" | "subject">>>(
  list: readonly T[],
  recording: { id: string; kind?: unknown; title?: string | null; durationSec?: number | null },
): T | undefined {
  return pickFromList(list, recording.id, recordingMood(recording.kind, recording.title, recording.durationSec))
}
