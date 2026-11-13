import { NetworkError, RemoteError, type RemoteConfig } from "@/lib/kirtan/remote"

/**
 * Which Prabhat Samgiita songs have chords: the numbers of the songs with a published chart, any instrument
 * (apps/api `GET /api/v1/song-chords/with-chords`, public). One small read serves "With chords first" on the Songs list and the
 * chords rank in Search (lib/songsV2/chordsFirst.ts). Plain `fetch`, no React; the config is passed in so tests use a fake server.
 */

/** `SongsWithChords` of the API. */
export type WireSongsWithChords = { songs: number[] }

/** The answer as a set; anything that is not a whole positive song number is dropped, never guessed. */
export function songSetFromWire(wire: Partial<WireSongsWithChords> | null | undefined): Set<number> {
  const numbers = Array.isArray(wire?.songs) ? wire.songs : []
  return new Set(numbers.filter((n): n is number => Number.isInteger(n) && n > 0))
}

export async function fetchSongsWithChords(cfg: RemoteConfig): Promise<Set<number>> {
  let response: Response
  try {
    response = await (cfg.fetch ?? fetch)(`${cfg.baseUrl.replace(/\/+$/, "")}/api/v1/song-chords/with-chords`, { headers: { Accept: "application/json" } })
  } catch (error) {
    throw new NetworkError(error instanceof Error ? error.message : undefined)
  }
  if (!response.ok) throw new RemoteError(response.status, `Request failed (${response.status})`)
  return songSetFromWire((await response.json()) as WireSongsWithChords)
}
