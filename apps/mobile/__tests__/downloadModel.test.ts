import { describe, expect, it } from "vitest"

import {
  demoDownloadBytes,
  demoDownloadState,
  downloadLabel,
  downloadMenuLabel,
  downloadPillLabel,
  downloadView,
  listDownloadLabel,
  listDownloadSub,
  listDownloadTitle,
  listDownloadView,
  listRemoveConfirmCopy,
  listStoppedToast,
  nextToStart,
  removeConfirmCopy,
} from "@/lib/offline/downloadModel"

const MB = 1024 * 1024

describe("one download control: states", () => {
  it("idle, downloading and done", () => {
    expect(downloadView({ hasAudio: true, downloaded: false, downloading: false })).toMatchObject({ visible: true, status: "idle", percent: 0 })
    expect(downloadView({ hasAudio: true, downloaded: false, downloading: true, progress: 0.424 })).toMatchObject({
      visible: true,
      status: "downloading",
      percent: 42,
    })
    expect(downloadView({ hasAudio: true, downloaded: true, downloading: false })).toMatchObject({ visible: true, status: "done", percent: 100 })
  })

  it("done wins over a leftover running flag, and progress is clamped", () => {
    expect(downloadView({ hasAudio: true, downloaded: true, downloading: true, progress: 0.3 }).status).toBe("done")
    expect(downloadView({ hasAudio: true, downloaded: false, downloading: true, progress: 7 }).percent).toBe(100)
    expect(downloadView({ hasAudio: true, downloaded: false, downloading: true, progress: -1 }).percent).toBe(0)
    expect(downloadView({ hasAudio: true, downloaded: false, downloading: true, progress: null }).percent).toBe(0)
  })

  it("a song without playable audio shows no control at all", () => {
    expect(downloadView({ hasAudio: false, downloaded: false, downloading: false }).visible).toBe(false)
    expect(downloadView({ hasAudio: false, downloaded: false, downloading: true, progress: 0.5 }).visible).toBe(false)
  })

  it("but a copy already on the phone can always be removed", () => {
    expect(downloadView({ hasAudio: false, downloaded: true, downloading: false }).visible).toBe(true)
  })
})

describe("one download control: words", () => {
  it("accessibility labels", () => {
    expect(downloadLabel(downloadView({ hasAudio: true, downloaded: false, downloading: false }))).toBe("Download to this phone")
    expect(downloadLabel(downloadView({ hasAudio: true, downloaded: false, downloading: true, progress: 0.42 }))).toBe(
      "Downloading 42 percent, tap to cancel",
    )
    expect(downloadLabel(downloadView({ hasAudio: true, downloaded: true, downloading: false }))).toBe("Downloaded to this phone, tap to remove")
  })

  it("menu rows", () => {
    expect(downloadMenuLabel("idle")).toBe("Download")
    expect(downloadMenuLabel("downloading")).toBe("Cancel download")
    expect(downloadMenuLabel("done")).toBe("Remove download")
  })

  it("the Versions pill keeps 'Sign in to download' for a signed-out listener", () => {
    const idle = downloadView({ hasAudio: true, downloaded: false, downloading: false })
    expect(downloadPillLabel(idle, { signedIn: false })).toBe("Sign in to download")
    expect(downloadPillLabel(idle, { signedIn: true, sizeText: "3.7 MB" })).toBe("Download · 3.7 MB")
    expect(downloadPillLabel(idle, { signedIn: true })).toBe("Download")
    expect(downloadPillLabel(downloadView({ hasAudio: true, downloaded: false, downloading: true, progress: 0.5 }), { signedIn: true })).toBe(
      "Downloading 50% · tap to cancel",
    )
    expect(downloadPillLabel(downloadView({ hasAudio: true, downloaded: true, downloading: false }), { signedIn: true })).toBe("Downloaded · tap to remove")
  })
})

describe("confirm text shows the size", () => {
  it("one song", () => {
    const copy = removeConfirmCopy({ title: "Bandhu He Niye Calo", bytes: 4.2 * MB })
    expect(copy.name).toBe("Bandhu He Niye Calo")
    expect(copy.body).toBe("Frees 4.2 MB on this phone. You can download it again any time.")
    expect(copy.confirm).toBe("Remove")
    expect(copy.keep).toBe("Keep")
  })

  it("an unknown size says nothing wrong", () => {
    expect(removeConfirmCopy({ title: "x", bytes: null }).body).toBe("Removes the audio from this phone. You can download it again any time.")
    expect(removeConfirmCopy({ title: "x", bytes: 0 }).body).not.toMatch(/Frees/)
  })

  it("a list says how many songs and how much", () => {
    expect(listRemoveConfirmCopy({ name: "Morning", count: 12, bytes: 48 * MB }).body).toBe(
      "Removes 12 songs from this phone and frees 48.0 MB. You can download them again any time.",
    )
    expect(listRemoveConfirmCopy({ name: "Morning", count: 1, bytes: null }).body).toBe(
      "Removes 1 song from this phone. You can download them again any time.",
    )
  })
})

describe("list level counts", () => {
  const audio = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  const hasAudio = (n: number) => audio.has(n)
  const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 99, 100]

  it("songs without audio are not counted", () => {
    const view = listDownloadView(numbers, new Set(), new Map(), hasAudio)
    expect(view).toMatchObject({ visible: true, status: "idle", total: 12, done: 0, active: 0, pending: 12 })
  })

  it("'Downloading 3 of 12'", () => {
    const done = new Set([1, 2, 3])
    const running = new Map([
      [4, 0.5],
      [5, 0],
      [6, 0],
    ])
    const view = listDownloadView(numbers, done, running, hasAudio)
    expect(view).toMatchObject({ status: "downloading", total: 12, done: 3, active: 3, pending: 6 })
    expect(listDownloadTitle(view)).toBe("Downloading 3 of 12")
    expect(view.progress).toBeCloseTo((3 + 0.5) / 12, 5)
    expect(listDownloadLabel(view)).toBe("Downloading 3 of 12, tap to stop")
  })

  it("done when every playable song is on the phone, whatever the silent ones do", () => {
    const view = listDownloadView(numbers, new Set(audio), new Map(), hasAudio)
    expect(view.status).toBe("done")
    expect(listDownloadTitle(view)).toBe("Downloaded")
    expect(listDownloadSub(view)).toBe("12 songs on this phone")
    expect(listDownloadSub(view, "48.0 MB")).toBe("12 songs on this phone · 48.0 MB")
    expect(listDownloadLabel(view)).toBe("Downloaded, 12 songs, tap to remove")
  })

  it("partly downloaded and idle says how many are there", () => {
    const view = listDownloadView(numbers, new Set([1, 2]), new Map(), hasAudio)
    expect(view.status).toBe("idle")
    expect(listDownloadSub(view)).toBe("2 of 12 on this phone")
    expect(listDownloadLabel(view)).toBe("Download 12 songs")
  })

  it("no toggle when nothing in the list has audio", () => {
    expect(listDownloadView([99, 100], new Set(), new Map(), hasAudio).visible).toBe(false)
    expect(listDownloadView([], new Set(), new Map(), hasAudio).visible).toBe(false)
  })

  it("repeated numbers count once", () => {
    expect(listDownloadView([1, 1, 2, 2], new Set(), new Map(), hasAudio).total).toBe(2)
  })

  it("stop toast", () => {
    expect(listStoppedToast(3, 12)).toBe("Stopped. 3 of 12 stay on this phone")
    expect(listStoppedToast(0, 12)).toBe("Download stopped")
  })
})

describe("preview downloads", () => {
  const done = { "1-0": true, "3-0": true, "3-1": true } as Record<string, true>
  const progress = { "6-2": 0.4 }

  it("a control with a version looks at that version only", () => {
    expect(demoDownloadState(3, 1, done, progress)).toMatchObject({ downloaded: true, downloading: false })
    expect(demoDownloadState(3, 2, done, progress)).toMatchObject({ downloaded: false, downloading: false })
    expect(demoDownloadState(6, 2, done, progress)).toMatchObject({ downloaded: false, downloading: true, progress: 0.4 })
  })

  it("a control without a version looks at every version", () => {
    expect(demoDownloadState(3, undefined, done, progress).downloaded).toBe(true)
    expect(demoDownloadState(6, undefined, done, progress).downloading).toBe(true)
    expect(demoDownloadState(7, undefined, done, progress)).toMatchObject({ downloaded: false, downloading: false })
  })

  it("estimates the size from the length", () => {
    expect(demoDownloadBytes(240)).toBeGreaterThan(3.5 * MB)
    expect(demoDownloadBytes(240)).toBeLessThan(4 * MB)
    expect(demoDownloadBytes(-5)).toBe(0)
  })
})

describe("batching", () => {
  it("starts only what the limit allows", () => {
    expect(nextToStart([1, 2, 3, 4, 5], 0)).toEqual([1, 2, 3])
    expect(nextToStart([1, 2, 3, 4, 5], 2)).toEqual([1])
    expect(nextToStart([1, 2, 3], 3)).toEqual([])
    expect(nextToStart([1, 2, 3], 9)).toEqual([])
    expect(nextToStart([], 0)).toEqual([])
  })
})

describe("download look: never confused with save", () => {
  it("the done disc is green, not the orange of Save, and its glyph is not a check", async () => {
    const look = await import("@/lib/offline/downloadLook")
    expect(look.DOWNLOADED_FILL).toBe("#3C5535")
    expect(look.DOWNLOADED_FILL).not.toBe(look.SAVED_FILL)
    expect(look.DOWNLOADED_GLYPH).not.toBe(look.SAVED_CHECK_PATH)
    expect(look.DOWNLOADED_GLYPH).not.toBe(look.DOWNLOAD_ARROW_PATH)
  })
})
