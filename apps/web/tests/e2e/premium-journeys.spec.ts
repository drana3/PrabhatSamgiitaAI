import { expect, test } from "@playwright/test"

const songResult = {
  number: 111,
  title: "Tomar Katha Bhavi",
  first_line: "TOMAR KATHA BHAVI",
  theme: "devotion",
  mood: "peaceful",
  language: "Bengali",
  is_verified: true,
}

test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/songs", async (route) => route.fulfill({ json: [songResult] }))
  await page.route("**/api/v1/recommendations/today**", async (route) => route.fulfill({ status: 503, body: "offline" }))
})

test("home delivers a complete, nonblank spiritual journey", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByRole("heading", { name: /Music for the inner dawn/i })).toBeVisible()
  await expect(page.getByRole("heading", { name: /Songs composed for a new human dawn/i })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Music for this moment" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Upcoming observances", exact: true })).toBeVisible()
  await expect(page.getByRole("heading", { name: /Listen, read, and reflect/i })).toBeVisible()
  await expect(page.getByRole("heading", { name: /Meaning and guidance, grounded in the songs/i })).toBeVisible()
  await expect(page.getByText(/written with the ink of the heart/i)).toBeVisible()
  await expect(page.getByText("5,018", { exact: false }).first()).toBeVisible()
  await expect(page.getByText(/Finding songs/i)).toHaveCount(0, { timeout: 20_000 })

  const emptySections = await page.locator("main section").evaluateAll((sections) => sections.filter((section) => {
    const text = section.textContent?.replace(/\s+/g, " ").trim() ?? ""
    const hasMedia = Boolean(section.querySelector("img, audio, video, iframe, canvas, svg"))
    return text.length < 20 && !hasMedia
  }).length)
  expect(emptySections).toBe(0)

  const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
  expect(hasOverflow).toBe(false)
  const shadowedText = await page.locator("main *").evaluateAll((elements) => elements.filter((element) => {
    const style = getComputedStyle(element)
    const text = element.childNodes.length === 1 && element.firstChild?.nodeType === Node.TEXT_NODE ? element.textContent?.trim() : ""
    return text && style.visibility !== "hidden" && style.display !== "none" && style.textShadow !== "none"
  }).length)
  expect(shadowedText).toBe(0)
})

test("brand artwork is crisp and accessible", async ({ page }) => {
  await page.goto("/")
  const logo = page.getByRole("img", { name: "Prabhat Samgiita" })
  await expect(logo).toBeVisible()
  const imageQuality = await logo.evaluate((node: HTMLImageElement) => ({ naturalWidth: node.naturalWidth, naturalHeight: node.naturalHeight, renderedWidth: node.getBoundingClientRect().width, renderedHeight: node.getBoundingClientRect().height, alt: node.alt }))
  expect(imageQuality.naturalWidth / imageQuality.renderedWidth).toBeGreaterThan(1.25)
  expect(imageQuality.naturalHeight / imageQuality.renderedHeight).toBeGreaterThan(1.25)
  expect(imageQuality.alt).toBe("Prabhat Samgiita")
  expect(imageQuality.renderedHeight).toBeGreaterThanOrEqual(56)
  const iconHref = await page.locator("link[rel='icon']").first().getAttribute("href")
  expect(iconHref).toBeTruthy()
  expect((await page.request.get(iconHref!)).ok()).toBe(true)
})

test("About navigation lands below the sticky header", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("link", { name: "About", exact: true }).click()
  await expect(page).toHaveURL(/#about$/)
  await expect.poll(async () => page.locator("#about").evaluate((node) => Math.round(node.getBoundingClientRect().top))).toBeLessThan(150)
  const positions = await page.evaluate(() => {
    const header = document.querySelector("header")
    const about = document.querySelector("#about")
    return {
      headerBottom: header?.getBoundingClientRect().bottom ?? 0,
      aboutTop: about?.getBoundingClientRect().top ?? 0,
    }
  })
  expect(positions.aboutTop).toBeGreaterThanOrEqual(positions.headerBottom + 8)
  expect(positions.aboutTop).toBeLessThan(positions.headerBottom + 60)
})

test("all special collections are organized and lead to catalog search", async ({ page }) => {
  await page.goto("/explore")
  await expect(page.getByRole("heading", { name: "Find the songs that meet your moment" })).toBeVisible()
  await expect(page.getByText("69 collections", { exact: true })).toBeVisible()
  await expect(page.getByText("Languages", { exact: true })).toBeVisible()
  await expect(page.getByText("Musical traditions and rarities", { exact: true })).toBeVisible()
  const collectionLinks = page.locator("#collections a[href^='/explore?q=']")
  await expect(collectionLinks).toHaveCount(69)
  await page.getByRole("link", { name: /Hindi 12/ }).click()
  await expect(page).toHaveURL(/q=Hindi/)
  await expect(page.locator("#results")).toBeVisible()
})

test("song actions, parallel reading, translation, and harmonium remain responsive", async ({ page }, testInfo) => {
  await page.goto("/songs/1")
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  const language = page.getByLabel("Reading language")
  await expect(language).toBeVisible()
  await expect(language.locator("option")).toHaveCount(36)
  await expect(language.locator("optgroup")).toHaveCount(2)
  const languageBounds = await language.boundingBox()
  const viewport = page.viewportSize()
  expect(languageBounds).not.toBeNull()
  expect(viewport).not.toBeNull()
  expect(languageBounds!.x).toBeGreaterThanOrEqual(0)
  expect(languageBounds!.x + languageBounds!.width).toBeLessThanOrEqual(viewport!.width)

  await expect(page.locator("#lyrics")).toBeVisible()
  await expect(page.locator("#meaning")).toBeVisible()
  const songActions = page.getByRole("navigation", { name: "Song actions" })
  for (const [action, targetId] of [["Harmonium", "notation"], ["Listen", "listen"], ["Know more with AI", "ask"], ["Watch", "watch"]] as const) {
    await expect(songActions.getByRole("link", { name: new RegExp(action), exact: false })).toHaveAttribute("href", `#${targetId}`)
    await expect(page.locator(`#${targetId}`)).toHaveCount(1)
  }
  const lyrics = await page.locator("#lyrics").boundingBox()
  const meaning = await page.locator("#meaning").boundingBox()
  expect(lyrics).not.toBeNull()
  expect(meaning).not.toBeNull()
  if (testInfo.project.name === "desktop-chromium") {
    expect(Math.abs(lyrics!.y - meaning!.y)).toBeLessThan(8)
    expect(meaning!.x).toBeGreaterThan(lyrics!.x + lyrics!.width - 8)
  } else if (testInfo.project.name === "mobile-chromium") {
    expect(meaning!.y).toBeGreaterThan(lyrics!.y + lyrics!.height - 8)
  }
  await songActions.getByRole("link", { name: /Harmonium/ }).click()
  await expect(page.locator("#notation")).toBeInViewport()
  await page.getByRole("heading", { name: "Practise on harmonium" }).click()
  await page.getByRole("button", { name: "Sargam guide" }).click()
  await expect(page.getByRole("heading", { name: "Sargam at a glance" })).toBeVisible()
  await expect(page.getByText("Aroha · ascending")).toBeVisible()
  await expect(page.getByText("Avaroha · descending")).toBeVisible()
  await expect(page.getByText("सा", { exact: true }).first()).toBeVisible()
  await expect(page.getByRole("img", { name: /Harmonium key guide/i })).toBeVisible()
  await expect(page.getByText(/Beginner alankar · ascending/i)).toBeVisible()
  await expect(page.getByLabel(/Listen to/i).first()).toBeVisible()
  await expect(page.getByRole("heading", { name: "Listen to this song" })).toBeVisible()
  const alternateRecordings = page.getByText(/More recordings \(/)
  if (await alternateRecordings.count()) await expect(alternateRecordings).toBeVisible()
})

test("garbage and hostile hero queries never reach search or AI", async ({ page }) => {
  let protectedCalls = 0
  await page.route("**/api/v1/{search,ai}/**", async (route) => { protectedCalls += 1; await route.abort() })
  await page.goto("/")
  const input = page.getByLabel(/Ask by song, feeling/i)
  await input.fill("<script>alert(1)</script>")
  await page.getByRole("button", { name: "Search" }).click()
  await expect(page.getByRole("alert").filter({ hasText: "Please ask something specific" })).toBeAttached()
  expect(protectedCalls).toBe(0)
  await expect(page).toHaveURL(/\/$/)
})

test("a meaningful query moves naturally into exploration", async ({ page }) => {
  await page.goto("/")
  await page.getByLabel(/Ask by song, feeling/i).fill("morning meditation")
  await page.getByRole("button", { name: "Search" }).click()
  await expect(page).toHaveURL(/\/explore\?q=morning%20meditation/)
  await expect(page.getByRole("heading", { name: "Explore Prabhat Samgiita" })).toBeVisible()
})

test("home and Explore resolve natural-language song number intent before RAG", async ({ page }) => {
  await page.goto("/")
  await page.getByLabel(/Ask by song, feeling/i).fill("explain about prabhat sagiat 223")
  await page.getByRole("button", { name: "Search" }).click()
  await expect(page).toHaveURL(/\/songs\/223#ask$/)
  await expect(page.locator("#ask")).toBeVisible()

  await page.goto("/explore")
  await page.getByLabel(/Search by number/i).fill("harmonium notation for song 1")
  await page.getByRole("button", { name: "Search" }).click()
  await expect(page).toHaveURL(/\/songs\/1#notation$/)
  await expect(page.locator("#notation")).toBeVisible()
})

test("search renders verified results and a deliberate no-match state", async ({ page }) => {
  await page.route("**/api/v1/search", async (route) => {
    const payload = route.request().postDataJSON() as { query: string }
    await route.fulfill({ json: payload.query.includes("unmatched theme") ? [] : payload.query === "2256" ? [{ ...songResult, number: 2256, title: "Ásár Kathá Chilo Anek Áge", first_line: "ÁSÁR KATHÁ CHILO ANEK ÁGE" }] : [songResult] })
  })
  await page.goto("/explore")
  const input = page.getByLabel(/Search by number/i)
  await input.fill("Tomar Katha")
  await page.getByRole("button", { name: "Search" }).click()
  await expect(page.getByRole("heading", { name: /Tomar Katha Bhavi/i })).toBeVisible()
  await input.fill("unmatched theme")
  await page.getByRole("button", { name: "Search" }).click()
  await expect(page.getByRole("heading", { name: "No exact match found" })).toBeVisible()
  await expect(page.getByText(/Try a song number, opening words/i)).toBeVisible()
})

test("song pages omit unavailable information and use clear recording language", async ({ page }) => {
  await page.goto("/songs/2256")
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  await expect(page.getByText(/No verified video match/i)).toHaveCount(0)
  await expect(page.getByText("Not listed", { exact: true })).toHaveCount(0)
  await expect(page.getByRole("heading", { name: "Audio renditions" })).toHaveCount(0)
})

test("catalog titles and source-only content never render fabricated blank sections", async ({ page }) => {
  await page.goto("/explore?q=song%20about%20rain")
  await expect(page.locator("#results")).toBeVisible()
  const resultTitles = await page.locator("#results ~ div h3").allTextContents()
  expect(resultTitles.some((title) => /^Song\s+\d+$/i.test(title.trim()))).toBe(false)

  await page.goto("/songs/68")
  await expect(page.getByRole("heading", { name: "Understand the song" })).toBeVisible()
  await expect(page.locator("#lyrics")).toHaveCount(0)
  await expect(page.locator("#meaning")).toBeVisible()
})

test("practice coach always reports microphone and audio-analysis outcomes", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: () => Promise.reject(new DOMException("Denied", "NotAllowedError")) },
    })
  })
  await page.goto("/songs/1#notation")
  await page.getByRole("heading", { name: "Practise on harmonium" }).click()
  await page.getByRole("button", { name: /Record practice/ }).click()
  await expect(page.getByText(/Microphone access was not available/i)).toBeVisible()

  const fileInput = page.locator("input[type=file]")
  await fileInput.setInputFiles({ name: "practice.wav", mimeType: "audio/wav", buffer: Buffer.from("not-a-valid-wave") })
  await expect(page.getByText("Analysis complete", { exact: true })).toBeVisible()
  await expect(page.getByText(/could not be analysed/i)).toBeVisible()
})

test("search failure is recoverable and never becomes a blank results panel", async ({ page }) => {
  await page.route("**/api/v1/search", async (route) => route.fulfill({ status: 503, json: { detail: "Search is reconnecting. Please try again." } }))
  await page.goto("/explore")
  await page.getByLabel(/Search by number/i).fill("peace")
  await page.getByRole("button", { name: "Search" }).click()
  await expect(page.getByRole("alert").filter({ hasText: "Search is reconnecting" })).toBeVisible()
  await expect(page.getByText(/shown$/)).not.toHaveText("0 shown")
})

test("feedback validates input and confirms successful delivery", async ({ page }) => {
  await page.route("**/api/v1/feedback", async (route) => route.fulfill({ status: 201, json: { message: "Thank you. Your feedback was received." } }))
  await page.goto("/")
  await page.getByRole("button", { name: "Feedback" }).click()
  await page.getByRole("button", { name: "Send feedback" }).click()
  await expect(page.getByRole("status").filter({ hasText: "at least a few words" })).toBeVisible()
  await page.getByLabel("Your feedback").fill("The experience feels calm and clear")
  await page.getByRole("button", { name: "4 stars" }).click()
  await page.getByRole("button", { name: "Send feedback" }).click()
  await expect(page.getByRole("status").filter({ hasText: "feedback was received" })).toBeVisible()
})

test("keyboard and assistive users can reach search and primary actions", async ({ page }, testInfo) => {
  await page.goto("/")
  const search = page.getByLabel(/Ask by song, feeling/i)
  await expect(search).toBeVisible()
  if (testInfo.project.name.includes("mobile")) {
    expect(await search.evaluate((node: HTMLInputElement) => !node.disabled && node.tabIndex >= 0 && Boolean(node.labels?.length))).toBe(true)
    await expect(page.getByRole("button", { name: "Search" })).toBeEnabled()
    return
  }
  let foundSearch = false
  for (let count = 0; count < 40; count += 1) {
    if (await search.evaluate((node) => node === document.activeElement)) {
      foundSearch = true
      break
    }
    await page.keyboard.press("Tab")
    if (await search.evaluate((node) => node === document.activeElement)) {
      foundSearch = true
      break
    }
  }
  expect(foundSearch).toBe(true)
})

test("404 is branded, informative, and actionable", async ({ page }) => {
  await page.goto("/this-page-does-not-exist")
  await expect(page.getByRole("heading", { name: /not found/i })).toBeVisible()
  await expect(page.getByRole("link", { name: "Explore songs" })).toBeVisible()
  await expect(page.getByRole("link", { name: "Return home" })).toBeVisible()
})
