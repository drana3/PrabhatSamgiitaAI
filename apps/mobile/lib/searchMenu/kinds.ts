/**
 * Baba's Audio Discourses: his own voice. The kind id comes from the upload work (API `baba_audio`); the Search menu and
 * Today only consume the id, so they work before and after the kind lands in `lib/kirtan/types.ts`. Pure.
 */
export const BABA_AUDIO_KIND = "baba_audio"

export function isBabaAudio(recording: { kind?: string | null } | null | undefined): boolean {
  return (recording?.kind as string | undefined) === BABA_AUDIO_KIND
}
