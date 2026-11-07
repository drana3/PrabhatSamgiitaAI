import { describe, expect, it } from "vitest"

import { blockedByWifiRule, mayAutoResume, networkKindFrom } from "@/lib/offline/networkRule"
import { failureMessageKey } from "@/lib/offline/downloadVerify"
import { freshPending, parsePending, PENDING_MAX_AGE_MS, withoutPending, withPending } from "@/lib/offline/pendingDownloads"
import { FRESH_FILE_MS, FRESH_PART_MS, orphanBytes, pickOrphans } from "@/lib/offline/orphanRules"

describe("Download on Wi-Fi only", () => {
  it("reads the kind of network from expo-network", () => {
    expect(networkKindFrom({ type: "WIFI", isConnected: true })).toBe("wifi")
    expect(networkKindFrom({ type: "CELLULAR", isConnected: true })).toBe("cellular")
    expect(networkKindFrom({ type: "ETHERNET", isConnected: true })).toBe("other")
    expect(networkKindFrom({ type: "VPN", isConnected: true })).toBe("other")
    expect(networkKindFrom({ type: "WIFI", isConnected: false })).toBe("none")
    expect(networkKindFrom({ type: "NONE" })).toBe("none")
    expect(networkKindFrom({ type: "UNKNOWN" })).toBe("unknown")
    expect(networkKindFrom(null)).toBe("unknown")
  })

  it("blocks only mobile data, only while the switch is on, and not after Download anyway", () => {
    expect(blockedByWifiRule({ wifiOnly: true, kind: "cellular" })).toBe(true)
    expect(blockedByWifiRule({ wifiOnly: true, kind: "cellular", allowCellular: true })).toBe(false)
    expect(blockedByWifiRule({ wifiOnly: false, kind: "cellular" })).toBe(false)
    expect(blockedByWifiRule({ wifiOnly: true, kind: "wifi" })).toBe(false)
    expect(blockedByWifiRule({ wifiOnly: true, kind: "unknown" })).toBe(false)
    expect(blockedByWifiRule({ wifiOnly: true, kind: "none" })).toBe(false)
  })

  it("continues interrupted downloads by itself only where it is allowed", () => {
    expect(mayAutoResume({ wifiOnly: true, kind: "wifi" })).toBe(true)
    expect(mayAutoResume({ wifiOnly: true, kind: "cellular" })).toBe(false)
    expect(mayAutoResume({ wifiOnly: true, kind: "unknown" })).toBe(false)
    expect(mayAutoResume({ wifiOnly: false, kind: "cellular" })).toBe(true)
    expect(mayAutoResume({ wifiOnly: false, kind: "none" })).toBe(false)
  })

  it("has its own toast", () => {
    expect(failureMessageKey("wifi")).toBe("dl.toast.wifi")
  })
})

describe("interrupted downloads list", () => {
  it("adds, refreshes and removes a download", () => {
    const a = { url: "https://x/a.mp3", songNumber: 3, startedAt: 1 }
    const b = { url: "", songNumber: 4, startedAt: 2 }
    let list = withPending([], a)
    list = withPending(list, b)
    list = withPending(list, { ...a, startedAt: 9 })
    expect(list).toEqual([b, { ...a, startedAt: 9 }])
    expect(withoutPending(list, { url: "https://x/a.mp3", songNumber: 3 })).toEqual([b])
    // a cancel by song (no link) removes every recording of the song
    expect(withoutPending(list, { url: "", songNumber: 3 })).toEqual([b])
  })

  it("drops entries older than three days and reads bad data as empty", () => {
    const now = 10 * PENDING_MAX_AGE_MS
    expect(freshPending([{ url: "", songNumber: 1, startedAt: now - PENDING_MAX_AGE_MS - 1 }, { url: "", songNumber: 2, startedAt: now - 1000 }], now).map((p) => p.songNumber)).toEqual([2])
    expect(parsePending(null)).toEqual([])
    expect(parsePending("not json")).toEqual([])
    expect(parsePending(JSON.stringify([{ songNumber: 5, startedAt: 1, url: "u" }, { bad: true }]))).toEqual([{ url: "u", songNumber: 5, startedAt: 1 }])
  })
})

describe("leftover files in the download folder", () => {
  const now = 1_000_000_000_000
  const old = now - 10 * FRESH_PART_MS
  const entry = (name: string, modifiedMs = old, bytes = 100) => ({ name, bytes, modifiedMs })

  it("lists audio files nobody records and keeps the recorded ones", () => {
    const out = pickOrphans([entry("3-aa.mp3"), entry("4-bb.mp3"), entry("notes.txt")], { indexedNames: new Set(["3-aa.mp3"]), pending: [], now })
    expect(out.map((o) => o.name)).toEqual(["4-bb.mp3"])
  })

  it("does not touch a file that was just written", () => {
    const out = pickOrphans([entry("4-bb.mp3", now - FRESH_FILE_MS + 1000)], { indexedNames: new Set(), pending: [], now })
    expect(out).toEqual([])
  })

  it("keeps half files that are young or wait to be continued, lists the abandoned ones", () => {
    const out = pickOrphans(
      [entry("5-cc.mp3.part", now - 1000), entry("6-dd.mp3.part"), entry("7-ee.mp3.part")],
      { indexedNames: new Set(), pending: [{ songNumber: 6 }], now },
    )
    expect(out.map((o) => o.name)).toEqual(["7-ee.mp3.part"])
  })

  it("sums the bytes", () => {
    expect(orphanBytes([{ bytes: 10 }, { bytes: 0 }, { bytes: 5 }])).toBe(15)
  })
})
