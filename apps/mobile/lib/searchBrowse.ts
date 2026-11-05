import type { BrowseTile } from "@/lib/fixtures/home"
import { MOCKUP_DATA } from "@/lib/mockupMode"

/**
 * The "Browse all" tiles of Search. Only tiles that open a list that really is what its label says
 * stay in a real build: Moods, Festivals, Languages and Stories each open a real category,
 * collection or the stories list. The rest are prototype tiles with no list behind them
 * (Ragas, Themes and Instruments open a list that is not sorted that way; Made for you, New this
 * month and Most played would need listening statistics the app does not have), so they show in the
 * demo preview only.
 */
export const REAL_BROWSE_IDS: readonly string[] = ["moods", "festivals", "languages", "stories"]

export function browseAllTiles(all: readonly BrowseTile[], demo: boolean = MOCKUP_DATA): readonly BrowseTile[] {
  return demo ? all : all.filter((tile) => REAL_BROWSE_IDS.includes(tile.id))
}
