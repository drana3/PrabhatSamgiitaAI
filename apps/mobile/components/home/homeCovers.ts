import type { HomeCoverId } from "@/lib/homeShelves"

/**
 * Cover pictures of the shelf-style Home, Search and Library. The app has no per-song art yet, so a
 * song takes one of these (lib/homeShelves coverFor). Copied from the design prototype's image set.
 * TODO(api): real covers and photographs.
 */
export const HOME_COVERS: Record<HomeCoverId, number> = {
  lake: require("../../assets/home/lake.jpg"),
  garland: require("../../assets/home/garland.jpg"),
  portrait: require("../../assets/home/portrait.jpg"),
  lotus: require("../../assets/home/lotus.jpg"),
  seated: require("../../assets/home/seated.jpg"),
  guitar: require("../../assets/home/guitar.jpg"),
}

/** Where to crop each picture so the face or figure stays in the frame. */
export const HOME_COVER_FOCUS: Record<HomeCoverId, { top: number | `${number}%`; left: number | `${number}%` }> = {
  lake: { top: "50%", left: "30%" },
  garland: { top: "18%", left: "50%" },
  portrait: { top: "30%", left: "50%" },
  lotus: { top: "50%", left: "62%" },
  seated: { top: "14%", left: "50%" },
  guitar: { top: "50%", left: "70%" },
}
