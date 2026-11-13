import type { HomeCoverId } from "@/lib/homeShelves"

/**
 * Cover pictures of the shelf-style Home, Search and Library. The app has no per-song art yet, so a
 * song takes one of these (lib/homeShelves coverFor). Text and chips sit over covers (title strips,
 * "PS n" chips), so none of them may show Baba: the six ids come from the prototype, and garland,
 * portrait, seated and guitar (Baba photos, a child) are now sunrise, mist, forest and dunes.
 * Baba's photos live only in components/common/BabaPhoto (lib/photos/baba.ts).
 * TODO(api): real covers and photographs.
 */
export const HOME_COVERS: Record<HomeCoverId, number> = {
  lake: require("../../assets/home/lake.jpg"),
  garland: require("../../assets/home/cover-sunrise.jpg"),
  portrait: require("../../assets/home/cover-mist.jpg"),
  lotus: require("../../assets/home/lotus.jpg"),
  seated: require("../../assets/home/cover-forest.jpg"),
  guitar: require("../../assets/home/cover-dunes.jpg"),
}

/** Where to crop each picture so the face or figure stays in the frame. */
export const HOME_COVER_FOCUS: Record<HomeCoverId, { top: number | `${number}%`; left: number | `${number}%` }> = {
  lake: { top: "50%", left: "30%" },
  garland: { top: "50%", left: "50%" },
  portrait: { top: "50%", left: "50%" },
  lotus: { top: "50%", left: "62%" },
  seated: { top: "50%", left: "50%" },
  guitar: { top: "50%", left: "50%" },
}
