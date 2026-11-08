import { describe, expect, it, vi } from "vitest"

import { exitToOrigin, exitToPage, exitToTab, MY_UPLOADS_HREF, runExit, UPLOAD_FALLBACK_HREF } from "@/lib/kirtan/uploadExit"
import { kindHasChords } from "@/lib/kirtan/kind"

describe("leaving the upload screens", () => {
  it("Done closes every page above the shell, so the tab the person came from shows", () => {
    expect(exitToOrigin(true)).toEqual([{ op: "dismissAll" }])
  })

  it("with no shell below (opened by a link) it opens the Kiirtan tab instead", () => {
    expect(exitToOrigin(false)).toEqual([{ op: "replace", href: UPLOAD_FALLBACK_HREF }])
    expect(exitToTab(MY_UPLOADS_HREF, false)).toEqual([{ op: "replace", href: MY_UPLOADS_HREF }])
    expect(exitToPage("/recording-set/s1", false)).toEqual([{ op: "replace", href: "/recording-set/s1" }])
  })

  it("the list of my uploads is a tab: the upload pages close and the tab is selected in one step, nothing replaced under it", () => {
    expect(exitToTab(MY_UPLOADS_HREF, true)).toEqual([{ op: "dismissTo", href: MY_UPLOADS_HREF }])
  })

  it("a playlist page opens straight on the shell: Back leads to the tab, never to the Upload hub", () => {
    expect(exitToPage("/recording-set/s1", true)).toEqual([{ op: "dismissAll" }, { op: "push", href: "/recording-set/s1" }])
  })

  it("runs a plan on a router in order", () => {
    const calls: string[] = []
    const router = {
      dismissAll: vi.fn(() => calls.push("dismissAll")),
      dismissTo: vi.fn((h: string) => calls.push(`dismissTo ${h}`)),
      push: vi.fn((h: string) => calls.push(`push ${h}`)),
      replace: vi.fn((h: string) => calls.push(`replace ${h}`)),
    }
    runExit(router as never, exitToPage("/recording-set/s1", true), (v) => v as never)
    expect(calls).toEqual(["dismissAll", "push /recording-set/s1"])
  })
})

describe("the chords block per kind", () => {
  it("is offered for Kiirtan, Bhajan, Prabhat Samgiita and Spiritual song", () => {
    for (const kind of ["kiirtan", "bhajan", "prabhat_samgiita", "spiritual_song"] as const) expect(kindHasChords(kind)).toBe(true)
  })

  it("is not offered for Dance music or for Baba's Audio Discourses", () => {
    expect(kindHasChords("dance_song")).toBe(false)
    expect(kindHasChords("baba_audio")).toBe(false)
  })

  it("an old or unknown kind reads as a Kiirtan", () => {
    expect(kindHasChords(undefined)).toBe(true)
    expect(kindHasChords(null)).toBe(true)
  })
})
