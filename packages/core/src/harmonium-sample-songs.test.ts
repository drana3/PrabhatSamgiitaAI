import { describe, expect, it } from "vitest"

import { RAGHUPATI_RAGHAV_SONG, sampleSongPlayEvents } from "./harmonium-sample-songs"

describe("harmonium sample songs", () => {
  it("maps Raghupati Raghav onto chromatic keys from Sa", () => {
    const events = sampleSongPlayEvents("C")
    expect(events.length).toBeGreaterThan(20)
    expect(events[0]?.western).toBe("G3")
    expect(events.some((event) => event.western === "C4")).toBe(true)
    expect(RAGHUPATI_RAGHAV_SONG.lines).toHaveLength(4)
  })
})
