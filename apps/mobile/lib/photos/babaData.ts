/**
 * Photographs of Shrii Shrii Anandamurti (Baba): metadata and geometry only (no image requires), so tests can
 * use it. The pictures are bound in lib/photos/baba.ts and shown only by components/common/BabaPhoto.
 *
 * Rule: nothing is ever drawn over a photo of Baba, no text, scrim, chip, button or badge, and the crop never
 * runs through the face. Everywhere else the app uses stock photos (lib/photos/catalog.ts), which never include
 * Baba (docs/photo-system.md, "Baba photos").
 */

export type BabaPhotoId = "today" | "quote"

export type BabaPhotoGeometry = {
  /** real pixel size of the file */
  width: number
  height: number
  /** the face (and garland), as fractions of the picture: the crop must keep all of it */
  face: { x0: number; x1: number; y0: number; y1: number }
  /** where the crop is anchored, in percent (expo-image contentPosition) */
  anchor: { top: `${number}%`; left: `${number}%` }
  /** `cover` crops to the frame; `contain` shows the whole picture (the quote art has its text baked in beside the face) */
  fit: "cover" | "contain"
  alt: string
}

export const BABA_GEOMETRY: Record<BabaPhotoId, BabaPhotoGeometry> = {
  today: {
    width: 900,
    height: 1184,
    face: { x0: 0.44, x1: 0.71, y0: 0.14, y1: 0.4 },
    anchor: { top: "0%", left: "50%" },
    fit: "cover",
    alt: "Shrii Shrii Anandamurti",
  },
  quote: {
    width: 1536,
    height: 1024,
    face: { x0: 0, x1: 1, y0: 0, y1: 1 },
    anchor: { top: "50%", left: "50%" },
    fit: "contain",
    alt: "Shrii Shrii Anandamurti",
  },
}

/**
 * Every file in assets/ that shows Baba, including the ones nothing uses at the moment. A test fails when
 * a source file requires one of these anywhere but lib/photos/baba.ts, or the OS-drawn places on the allowlist (__tests__/babaPhoto.test.ts).
 */
export const BABA_ASSET_FILES: readonly string[] = [
  "today-hero.jpg",
  "guru-quote.webp",
  "guru-quote.png",
  "guru-quote-hero.png",
  "guru-avatar.png",
  "guru-avatar-studio.png",
  "guru-portrait.png",
  "guru-portrait.jpeg",
  "guru.jpg",
  "player-baba.jpg",
  "song-v2-poster.jpg",
  "dawn-hero.webp",
  "dawn-hero.png",
]

/**
 * Where a crop of the picture into a frame of `ratio` (width / height), anchored at `anchor`, still shows the
 * whole face box. Pure geometry; `cover` crops, `contain` never crops.
 */
export function cropFits(meta: Pick<BabaPhotoGeometry, "width" | "height" | "face" | "anchor" | "fit">, ratio: number): boolean {
  if (meta.fit === "contain") return true
  const natural = meta.width / meta.height
  // the visible fraction of each axis when the frame is filled
  const visX = ratio >= natural ? 1 : ratio / natural
  const visY = ratio >= natural ? natural / ratio : 1
  const pct = (v: string) => parseFloat(v) / 100
  const startX = (1 - visX) * pct(meta.anchor.left)
  const startY = (1 - visY) * pct(meta.anchor.top)
  const f = meta.face
  const eps = 1e-6
  return f.x0 >= startX - eps && f.x1 <= startX + visX + eps && f.y0 >= startY - eps && f.y1 <= startY + visY + eps
}
