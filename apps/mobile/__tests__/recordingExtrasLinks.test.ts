import { describe, expect, it } from "vitest"

import { buildActionRows } from "@/lib/playerV2/playerActions"
import { apiIdOf, chordsFormHref, recordingPageHref } from "@/lib/recordingExtras/links"
import { recordingExtraRows, withRecordingExtras } from "@/lib/recordingExtras/playerRows"

const base = buildActionRows({ saved: false, inQueue: false, collectionName: null, sourceName: "All songs", speedText: "1×", sleepText: "Off" })

describe("recording links", () => {
  it("names a recording by the server's id once it has one", () => {
    expect(apiIdOf({ id: "k1", serverId: "uuid-1" })).toBe("uuid-1")
    expect(apiIdOf({ id: "k1" })).toBe("k1")
  })

  it("encodes the page and the form addresses", () => {
    expect(recordingPageHref("a/b c")).toBe("/recording/a%2Fb%20c")
    expect(chordsFormHref({ recordingId: "r1" })).toBe("/recording-chords?recording=r1")
    expect(chordsFormHref({ recordingId: "r1", title: "Baba & Nam", edit: "s9" })).toBe("/recording-chords?recording=r1&title=Baba%20%26%20Nam&edit=s9")
  })

  it("keeps a long title short in the address", () => {
    const href = chordsFormHref({ recordingId: "r1", title: "x".repeat(500) })
    expect(decodeURIComponent(href.split("title=")[1] ?? "").length).toBe(120)
  })
})

describe("the player's More rows for a recording", () => {
  it("puts the two extra rows in front of Report and leaves the others alone", () => {
    const rows = withRecordingExtras(base.filter((r) => ["share", "save", "queue", "goQueue", "playback", "drive", "report"].includes(r.id)))
    const ids = rows.map((r) => r.id)
    expect(ids.at(-1)).toBe("report")
    expect(ids.slice(-3)).toEqual(["recordingChords", "recordingPage", "report"])
    expect(ids.filter((id) => id === "share")).toHaveLength(1)
  })

  it("appends them when there is no Report row", () => {
    expect(withRecordingExtras([]).map((r) => r.id)).toEqual(["recordingChords", "recordingPage"])
  })

  it("never adds them to the rows of a song", () => {
    expect(base.map((r) => r.id)).not.toContain("recordingChords")
    expect(base.map((r) => r.id)).not.toContain("recordingPage")
  })

  it("gives each row a label and an icon", () => {
    for (const row of recordingExtraRows()) {
      expect(row.label.length).toBeGreaterThan(2)
      expect(row.icon).toBeTruthy()
    }
  })
})
