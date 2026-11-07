import { describe, expect, it } from "vitest"

import { legacyRouteTarget } from "@/lib/legacyRoutes"
import { NAV_V2_HOME_ROUTE } from "@/lib/navV2"

describe("legacyRouteTarget", () => {
  it("sends the old tab group to the v2 shell", () => {
    expect(legacyRouteTarget("/(tabs)")).toBe(NAV_V2_HOME_ROUTE)
    expect(legacyRouteTarget("/(tabs)/index")).toBe(NAV_V2_HOME_ROUTE)
    expect(legacyRouteTarget("/(tabs)/songs")).toBe("/v2/songs")
    expect(legacyRouteTarget("/(tabs)/ai?song=5")).toBe("/assistant?song=5")
    expect(legacyRouteTarget("/(tabs)/saved")).toBe("/library-v2")
    expect(legacyRouteTarget("/(tabs)/profile")).toBe(NAV_V2_HOME_ROUTE)
  })

  it("maps the old song, search, player and collection pages", () => {
    expect(legacyRouteTarget("/song/ps-12")).toBe("/song-v2/ps-12")
    expect(legacyRouteTarget("/song/12?from=player")).toBe("/song-v2/ps-12")
    expect(legacyRouteTarget("/songs/662")).toBe("/song-v2/ps-662")
    expect(legacyRouteTarget("/search?focus=1&q=love")).toBe("/search-v2?focus=1&q=love")
    expect(legacyRouteTarget("/search?category=moods")).toBe("/songs-v2-collection?id=moods&title=moods")
    expect(legacyRouteTarget("/collections")).toBe("/collections-v2")
    expect(legacyRouteTarget("/player")).toBe("/player-v2")
  })

  it("maps playlists", () => {
    expect(legacyRouteTarget("/playlist/abc")).toBe("/playlist-v2/abc")
    expect(legacyRouteTarget("/playlist/add?song=9")).toBe("/song-v2/ps-9")
    expect(legacyRouteTarget("/playlist/add")).toBe("/library-v2")
  })

  it("keeps /drive where it is: the Radio screen still lives there (QA-005)", () => {
    expect(legacyRouteTarget("/drive")).toBeNull()
    expect(legacyRouteTarget("/drive?x=1")).toBeNull()
  })

  it("never carries the router's own not-found parameters into the new address (QA-006)", () => {
    expect(legacyRouteTarget("/songs/12?not-found=songs&not-found=12")).toBe("/song-v2/ps-12")
    expect(legacyRouteTarget("/song/12?from=player&not-found=song")).toBe("/song-v2/ps-12")
    expect(legacyRouteTarget("/search?q=love&not-found=search")).toBe("/search-v2?q=love")
    expect(legacyRouteTarget("/songs/12?lang=ru&not-found=12")).toBe("/song-v2/ps-12?lang=ru")
  })

  it("matches the first segment without regard to case (QA-021)", () => {
    expect(legacyRouteTarget("/SONGS")).toBe("/v2/songs")
    expect(legacyRouteTarget("/Songs/12")).toBe("/song-v2/ps-12")
    expect(legacyRouteTarget("/SONG/PS-12")).toBe("/song-v2/PS-12")
    expect(legacyRouteTarget("/Saved")).toBe("/library-v2")
    expect(legacyRouteTarget("/(TABS)/Index")).toBe(NAV_V2_HOME_ROUTE)
    expect(legacyRouteTarget("/Drive")).toBeNull()
  })

  it("sends /profile to Today: there is a profile sheet, not a profile page to open by address (QA-020)", () => {
    expect(legacyRouteTarget("/profile")).toBe(NAV_V2_HOME_ROUTE)
  })

  it("leaves current routes alone", () => {
    for (const path of ["/", "/v2/today", "/song-v2/ps-1", "/songs-v2", "/search-v2", "/playlist-v2/x", "/learn", "/stories/a", "/welcome"]) {
      expect(legacyRouteTarget(path)).toBeNull()
    }
  })
})
