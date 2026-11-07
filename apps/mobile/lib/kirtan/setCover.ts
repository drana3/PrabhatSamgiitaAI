/**
 * The cover picture of an event playlist, the pure rules. The picture is made small on the phone (re-encoding drops the
 * camera's metadata, GPS included) and must end up at most 300 KB, the same cap as an author's photo
 * (apps/api app/services/image_clean.py is the truth and checks again). The expo parts live in setCoverPick.ts.
 */

export const COVER_MAX_BYTES = 300 * 1024

/** Tried in order until the picture fits: a width in pixels and a JPEG quality. */
export const COVER_STEPS: readonly { width: number; quality: number }[] = [
  { width: 1080, quality: 0.8 },
  { width: 900, quality: 0.7 },
  { width: 720, quality: 0.6 },
  { width: 600, quality: 0.5 },
  { width: 480, quality: 0.4 },
]

export type CoverMade = { status: "ok"; uri: string; bytes: number } | { status: "tooBig" } | { status: "error" }

/** Walks the steps until one result is small enough. `render` makes a JPEG at a step; `sizeOf` reads its size. Never throws. */
export async function shrinkCover(render: (step: { width: number; quality: number }) => Promise<string>, sizeOf: (uri: string) => Promise<number>): Promise<CoverMade> {
  try {
    for (const step of COVER_STEPS) {
      const uri = await render(step)
      const bytes = await sizeOf(uri)
      if (bytes > 0 && bytes <= COVER_MAX_BYTES) return { status: "ok", uri, bytes }
    }
    return { status: "tooBig" }
  } catch {
    return { status: "error" }
  }
}

/** The address the app shows: the server hands out a path on its own API, or an https link the team set. */
export function coverSrc(url: string | null | undefined, apiBase: string): string | null {
  if (!url) return null
  return /^(https?:|data:|file:|blob:)/i.test(url) ? url : `${apiBase.replace(/\/+$/, "")}${url}`
}
