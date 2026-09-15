import fs from "node:fs"
import path from "node:path"

import { expect, test, type Page } from "@playwright/test"

const sampleMp3 = fs.readFileSync(path.join(__dirname, "../fixtures/streaming-sample.mp3"))

async function stubArchiveAudio(page: Page) {
  await page.route(/prabhatasamgiita\.net/i, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "audio/mpeg",
      headers: {
        "Accept-Ranges": "bytes",
        "Content-Length": String(sampleMp3.length),
      },
      body: sampleMp3,
    })
  })
}

async function waitForAudioMetadata(page: Page, selector: string) {
  await page.waitForFunction(
    (targetSelector) => {
      const audio = document.querySelector<HTMLAudioElement>(targetSelector)
      return Boolean(audio && Number.isFinite(audio.duration) && audio.duration > 0)
    },
    selector,
    { timeout: 15_000 },
  )
}

async function startPlayback(page: Page, selector: string) {
  return page.evaluate(async (targetSelector) => {
    const audio = document.querySelector<HTMLAudioElement>(targetSelector)
    if (!audio) throw new Error(`Missing audio element: ${targetSelector}`)
    await audio.play()
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error("Playback did not start")), 5000)
      const check = () => {
        if (!audio.paused && audio.currentTime > 0) {
          window.clearTimeout(timeout)
          resolve()
        }
      }
      audio.addEventListener("timeupdate", check)
      check()
    })
    return audio.currentTime
  }, selector)
}

test.describe("song audio streaming", () => {
  test.beforeEach(async ({ page }) => {
    await stubArchiveAudio(page)
    await page.goto("/songs/1")
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  })

  test("warms metadata on the primary player and streams without proxy URLs", async ({ page }) => {
    await expect
      .poll(async () =>
        page.evaluate(() =>
          Array.from(document.head.querySelectorAll("link")).some(
            (link) => link.rel === "preconnect" && link.href === "https://prabhatasamgiita.net/",
          ),
        ),
      )
      .toBe(true)

    const primary = page.locator("#listen audio").first()
    await expect(primary).toBeVisible()
    await expect(primary).toHaveAttribute("preload", "metadata")

    const src = await primary.getAttribute("src")
    expect(src).toMatch(/prabhatasamgiita\.net/i)
    expect(src).not.toMatch(/media\/stream/i)

    await waitForAudioMetadata(page, "#listen audio")
    const currentTime = await startPlayback(page, "#listen audio")
    expect(currentTime).toBeGreaterThan(0)
  })

  test("mounts one player in the sidebar on desktop", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "mobile-chromium", "Sidebar player is desktop-only")

    await expect.poll(async () => page.locator("audio").count()).toBe(1)
    await expect(page.locator("aside #listen audio")).toHaveCount(1)
    await expect(page.getByRole("heading", { name: "Listen to this song" })).toBeVisible()
    await expect(page.locator("aside #listen audio")).toHaveAttribute("preload", "metadata")

    await waitForAudioMetadata(page, "aside #listen audio")
    const currentTime = await startPlayback(page, "aside #listen audio")
    expect(currentTime).toBeGreaterThan(0)
  })

  test("remounts the primary player when switching recordings", async ({ page }) => {
    const alternate = page.locator("#listen").getByText(/More recordings \(/)
    if (!(await alternate.count())) test.skip()

    await alternate.click()
    await page.locator("#listen").getByRole("button", { name: /Play/i }).last().click()

    const primary = page.locator("#listen audio").first()
    await waitForAudioMetadata(page, "#listen audio")
    const src = await primary.getAttribute("src")
    expect(decodeURIComponent(src ?? "")).toMatch(/old version/i)

    const currentTime = await startPlayback(page, "#listen audio")
    expect(currentTime).toBeGreaterThan(0)
  })
})
