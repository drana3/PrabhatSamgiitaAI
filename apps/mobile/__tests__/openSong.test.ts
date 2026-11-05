import { afterEach, describe, expect, it, vi } from "vitest"

const platformState = vi.hoisted(() => ({ os: "ios" as "ios" | "android" }))

vi.mock("react-native", () => ({
  Platform: {
    get OS() {
      return platformState.os
    },
  },
}))

import { openSongScreen, songPath } from "@/lib/openSong"

describe("songPath", () => {
  it("normalizes ids to /song-v2/ps-N", () => {
    expect(songPath("1")).toBe("/song-v2/ps-1")
    expect(songPath("ps-27")).toBe("/song-v2/ps-27")
    expect(songPath(2, "tab=watch")).toBe("/song-v2/ps-2?tab=watch")
  })
})

describe("openSongScreen", () => {
  afterEach(() => {
    platformState.os = "ios"
  })

  it("pushes immediately when there is no modal to dismiss", () => {
    const router = { canDismiss: () => false, dismiss: vi.fn(), push: vi.fn() }
    openSongScreen(router, "ps-1")
    expect(router.dismiss).not.toHaveBeenCalled()
    expect(router.push).toHaveBeenCalledWith("/song-v2/ps-1")
  })

  it("dismisses then pushes on iOS in the same turn", () => {
    platformState.os = "ios"
    const router = { canDismiss: () => true, dismiss: vi.fn(), push: vi.fn() }
    openSongScreen(router, "ps-1")
    expect(router.dismiss).toHaveBeenCalledTimes(1)
    expect(router.push).toHaveBeenCalledWith("/song-v2/ps-1")
  })

  it("pushes immediately on Android even if a modal flag is set", () => {
    platformState.os = "android"
    const router = { canDismiss: () => true, dismiss: vi.fn(), push: vi.fn() }
    openSongScreen(router, "ps-1")
    expect(router.dismiss).not.toHaveBeenCalled()
    expect(router.push).toHaveBeenCalledWith("/song-v2/ps-1")
  })
})
