import { expect, test, type Page } from "@playwright/test"

async function stubSignedInMember(page: Page) {
  await page.route("**/api/member/session", async (route) =>
    route.fulfill({
      status: 200,
      json: {
        authenticated: true,
        id: "aad:e2e-user",
        display_name: "E2E Member",
        email: "e2e@example.com",
        identity_provider: "aad",
        personalization_enabled: true,
        favorite_song_numbers: [],
        is_admin: false,
        is_super_admin: false,
        member_backend: true,
      },
    }),
  )
}

async function enableHarmoniumPractice(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("prabhat-harmonium-practice", "1")
  })
}

async function setDetailsOpen(page: Page, selector: string, open: boolean) {
  const details = page.locator(selector).first()
  await details.scrollIntoViewIfNeeded()
  const isOpen = await details.evaluate((node) => (node as HTMLDetailsElement).open)
  if (isOpen === open) return
  await details.locator(":scope > summary").focus()
  await page.keyboard.press("Enter")
  await expect.poll(async () => details.evaluate((node) => (node as HTMLDetailsElement).open)).toBe(open)
}

async function clickSearchButton(page: Page) {
  const heroInput = page.getByLabel(/Search by song number/i).first()
  if (await heroInput.count()) {
    await heroInput.press("Enter")
    return
  }
  await page.getByRole("button", { name: "Search", exact: true }).click()
}

async function clickCollectionLink(page: Page, name: RegExp | string) {
  const link = page.getByRole("link", { name })
  // Centre the link so the sticky header cannot sit over it on small viewports.
  await link.evaluate((node) => node.scrollIntoView({ block: "center" }))
  await link.click()
}

/** Mobile song pages should open at the hero, not auto-jump to #ask. */
async function expectMobileSongLanding(page: Page, heading?: RegExp | string) {
  await expect.poll(() => new URL(page.url()).hash).toBe("")
  const hero = heading
    ? page.getByRole("heading", { name: heading })
    : page.locator("h1").first()
  await expect(hero).toBeInViewport()
  await expect.poll(async () => {
    const top = await hero.evaluate((element) => element.getBoundingClientRect().top)
    return top >= 0 && top <= 240
  }).toBe(true)
}

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
  await page.addStyleTag({
    content: "[data-feature='feedback_open']{display:none!important;pointer-events:none!important}",
  })
  await page.route("**/api/member/session", async (route) =>
    route.fulfill({ json: { authenticated: false, display_name: null, email: null } }),
  )
  await page.route("**/api/v1/songs", async (route) => route.fulfill({ json: [songResult] }))
  await page.route("**/api/v1/recommendations/today**", async (route) => route.fulfill({ status: 503, body: "offline" }))
  await page.route("**/api/v1/recommendations", async (route) => route.fulfill({ json: [songResult] }))
  await page.route("**/api/v1/reflections/today**", async (route) => route.fulfill({ json: {
    quote_text: "As one thinks, so one becomes.",
    attribution: "Shrii Shrii Anandamurti ji",
    source_title: "Ánanda Sútram",
    source_url: "https://www.anandamarga.org/articles/meditation/",
    context_label: "Daily spiritual reflection",
    verification_status: "source_verified",
  } }))
  await page.route("**/api/v1/testimonials**", async (route) => route.fulfill({ json: [] }))
})

test("home delivers a complete, nonblank spiritual journey", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByRole("heading", { name: /Music for the inner dawn/i })).toBeVisible()
  await expect(page.getByRole("heading", { name: /Songs composed for a new human dawn/i })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Music for this moment" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Upcoming observances", exact: true })).toBeVisible()
  await expect(page.getByText("Refine these suggestions", { exact: true })).toHaveCount(0)
  await expect(page.getByRole("heading", { name: /Listen, read, and reflect/i })).toBeVisible()
  await expect(page.getByRole("heading", { name: /Meaning and guidance, grounded in the songs/i })).toBeVisible()
  await expect(page.getByText(/written with the ink of the heart/i).first()).toBeVisible()
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

test("general song links settle on the AI Companion after layout", async ({ page }, testInfo) => {
  await page.goto("/")
  await page.getByRole("link", { name: "Start with Song 1" }).click()
  if (testInfo.project.name === "mobile-chromium") {
    await expect(page).toHaveURL(/\/songs\/1\/?$/)
    await expectMobileSongLanding(page, /Bandhu He Niye Calo/i)
    return
  }
  await expect(page).toHaveURL(/\/songs\/1#ask$/)
  await expect(page.locator("#ask")).toBeInViewport()
  await expect(page.getByRole("heading", { name: "Know more about this song" })).toBeVisible()
  const maximumLandingTop = (page.viewportSize()?.height ?? 800) * 0.25
  await expect.poll(
    () => page.locator("#ask").evaluate((element) => element.getBoundingClientRect().top),
  ).toBeLessThanOrEqual(maximumLandingTop)
  const landing = await page.evaluate(() => ({
    askTop: document.querySelector("#ask")?.getBoundingClientRect().top ?? null,
    notationTop: document.querySelector("#notation")?.getBoundingClientRect().top ?? null,
  }))
  expect(landing.askTop).not.toBeNull()
  expect(landing.notationTop).not.toBeNull()
  expect(landing.askTop!).toBeGreaterThanOrEqual(0)
  expect(landing.askTop!).toBeLessThanOrEqual(maximumLandingTop)
  expect(landing.notationTop!).toBeGreaterThan(landing.askTop!)
})

test("Guru portrait and reflection remain aligned without overlap", async ({ page }, testInfo) => {
  await page.goto("/")

  const heading = page.getByRole("heading", { name: /Music for the inner dawn/i })
  const heroPortrait = page.getByRole("img", { name: "Shrii Shrii Anandamurti ji", exact: true }).first()
  await expect(heroPortrait).toBeVisible()
  await expect(page.getByText("Shri Prabhat Ranjan Sarkar", { exact: true }).first()).toBeVisible()
  await expect(page.getByText("Shrii Shrii Anandamurti ji", { exact: true }).first()).toBeVisible()

  const headingBounds = await heading.boundingBox()
  const heroBounds = await heroPortrait.boundingBox()
  expect(headingBounds).not.toBeNull()
  expect(heroBounds).not.toBeNull()
  if (testInfo.project.name === "desktop-chromium") {
    expect(heroBounds!.x + heroBounds!.width).toBeLessThan(headingBounds!.x)
    expect(heroBounds!.width).toBeGreaterThan(400)
  } else {
    expect(heroBounds!.y).toBeGreaterThan(headingBounds!.y + headingBounds!.height)
  }

  const guidancePortrait = page.getByRole("img", { name: "Shrii Shrii Anandamurti ji at dawn" })
  const quote = page.locator("blockquote").filter({ hasText: "written with the ink of the heart" }).first()
  const guidanceBounds = await guidancePortrait.boundingBox()
  const quoteBounds = await quote.boundingBox()
  expect(guidanceBounds).not.toBeNull()
  expect(quoteBounds).not.toBeNull()
  expect(quoteBounds!.y).toBeGreaterThanOrEqual(guidanceBounds!.y + guidanceBounds!.height - 1)
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
  await page.evaluate(() => document.fonts.ready)
  await page.getByRole("link", { name: "About", exact: true }).click()
  await expect(page).toHaveURL(/#about$/)
  await expect.poll(async () => page.evaluate(() => {
    const sticky = document.querySelector(".sticky.top-0")
    const about = document.querySelector("#about")
    return (about?.getBoundingClientRect().top ?? 0) - (sticky?.getBoundingClientRect().bottom ?? 0)
  })).toBeGreaterThanOrEqual(4)
  await expect.poll(async () => page.evaluate(() => {
    const sticky = document.querySelector(".sticky.top-0")
    const about = document.querySelector("#about")
    return (about?.getBoundingClientRect().top ?? 1000) - (sticky?.getBoundingClientRect().bottom ?? 0)
  })).toBeLessThan(120)
  const positions = await page.evaluate(() => {
    const sticky = document.querySelector(".sticky.top-0")
    const about = document.querySelector("#about")
    return {
      headerBottom: sticky?.getBoundingClientRect().bottom ?? 0,
      aboutTop: about?.getBoundingClientRect().top ?? 0,
    }
  })
  expect(positions.aboutTop).toBeGreaterThanOrEqual(positions.headerBottom + 4)
  expect(positions.aboutTop).toBeLessThan(positions.headerBottom + 120)
})

test("all special collections are organized and lead to catalog search", async ({ page }) => {
  await page.goto("/explore")
  await expect(page.getByRole("heading", { name: "Browse 68 collections" })).toBeVisible()
  const collectionBrowser = page.locator("#collections").first()
  const languages = collectionBrowser.getByText("Languages", { exact: true })
  await expect(collectionBrowser.getByRole("heading", { name: "Browse 68 collections" })).toBeVisible()
  await expect(languages).toBeHidden()
  await setDetailsOpen(page, "#collections", true)
  await expect(languages).toBeVisible()
  await expect(collectionBrowser.getByText("Musical traditions and rarities", { exact: true })).toBeVisible()
  await setDetailsOpen(page, "#collections", false)
  await expect(languages).toBeHidden()
  await setDetailsOpen(page, "#collections", true)
  await expect(languages).toBeVisible()
  const collectionLinks = collectionBrowser.locator("a[href^='/explore?q=']")
  await expect(collectionLinks).toHaveCount(68)
  await collectionBrowser.locator("a[href^='/explore?q=']").first().scrollIntoViewIfNeeded()
  await clickCollectionLink(page, /Hindi\s+12/)
  await expect(page).toHaveURL(/q=Search(\+|%20)Prabhat(\+|%20)Samgiita(\+|%20)for(\+|%20)Hindi(\+|%20)Songs.*kind=catalog/)
  await expect(page.locator("#results").first()).toBeVisible()
})

test("results sit just above search and English returns only its three canonical songs", async ({ page }) => {
  const englishSongs = [
    { ...songResult, number: 68, title: "I love this tiny green island", language: "English" },
    { ...songResult, number: 5008, title: "WE LOVE THAT GREAT ENTITY", language: "English" },
    { ...songResult, number: 5009, title: "THIS LIFE IS FOR HIM", language: "English" },
  ]
  await page.route("**/api/v1/search", async (route) => {
    const payload = route.request().postDataJSON() as { query: string }
    await new Promise((resolve) => setTimeout(resolve, 250))
    await route.fulfill({ json: payload.query.includes("English Songs") ? englishSongs : [] })
  })
  await page.goto("/explore")
  await expect(page.getByRole("heading", { name: "Browse 68 collections" })).toBeVisible()
  await setDetailsOpen(page, "#collections", true)
  const results = page.locator("#results").first()
  const search = page.locator("#catalog-search").first()
  const resultBounds = await results.boundingBox()
  const searchBounds = await search.boundingBox()
  expect(resultBounds).not.toBeNull()
  expect(searchBounds).not.toBeNull()
  expect(resultBounds!.y).toBeLessThan(searchBounds!.y)

  await clickCollectionLink(page, /English 3/)
  await expect(page.getByText("Showing songs for:", { exact: false })).toBeVisible()
  await expect(page.locator("#results").first()).toBeInViewport()
  const searchAfterBounds = await page.locator("#catalog-search").first().boundingBox()
  const resultsAfterBounds = await page.locator("#results").first().boundingBox()
  expect(resultsAfterBounds!.y + resultsAfterBounds!.height).toBeLessThan(searchAfterBounds!.y)
  await expect(page.locator("#collections").first().locator("a[aria-current='true']")).toHaveCount(1)
  await setDetailsOpen(page, "#collections", true)
  await expect(page.getByRole("link", { name: /English 3/ })).toHaveAttribute("href", "/explore#catalog-search")
  await expect(page.getByRole("heading", { name: "I love this tiny green island" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "WE LOVE THAT GREAT ENTITY" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "THIS LIFE IS FOR HIM" })).toBeVisible()
})

test("song actions, parallel reading, translation, and harmonium remain responsive", async ({ page }, testInfo) => {
  await stubSignedInMember(page)
  await enableHarmoniumPractice(page)
  await page.goto("/songs/1")
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  const songHeroPortrait = page.getByRole("img", { name: "Shrii Shrii Anandamurti ji at dawn" })
  await expect(songHeroPortrait).toBeAttached()
  await expect(songHeroPortrait).toHaveCSS("background-position", /82% 0/)
  const language = page.getByLabel("Language")
  await expect(language).toBeVisible()
  await expect(language.locator("option")).toHaveCount(36)
  await expect(language.locator("optgroup")).toHaveCount(2)
  const languageBounds = await language.boundingBox()
  const viewport = page.viewportSize()
  expect(languageBounds).not.toBeNull()
  expect(viewport).not.toBeNull()
  expect(languageBounds!.x).toBeGreaterThanOrEqual(0)
  expect(languageBounds!.x + languageBounds!.width).toBeLessThanOrEqual(viewport!.width)

  await page.locator("#meaning").scrollIntoViewIfNeeded()
  const translationScroll = await page.evaluate(() => window.scrollY)
  await expect(language).toBeEnabled()
  await language.selectOption("hi")
  await expect(page).toHaveURL(/\/songs\/1\?language=hi$/, { timeout: 20000 })
  await expect(page.locator("#meaning").getByLabel("Language").first()).toHaveValue("hi")
  await expect(page.getByRole("status", { name: /translating/i })).toHaveCount(0, { timeout: 20000 })
  const hindiMeaningArticle = page.locator("#meaning article").filter({ hasText: /hindi meaning/i })
  const englishMeaningArticle = page.locator("#meaning article").filter({
    has: page.locator("p").filter({ hasText: /^English$/ }),
  })
  await expect(hindiMeaningArticle).toBeVisible({ timeout: 20000 })
  await expect(englishMeaningArticle).toBeVisible()
  await expect(page.locator("#meaning article")).toHaveCount(2)
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(translationScroll)

  await expect(page.locator("#lyrics")).toBeVisible()
  await expect(page.locator("#meaning")).toBeVisible()
  const songActions = page.getByRole("navigation", { name: "Song actions" })
  for (const [action, targetId] of [["Harmonium", "notation"], ["Listen", "listen"], ["Ask AI", "ask"], ["Watch", "watch"]] as const) {
    await expect(songActions.getByRole("link", { name: new RegExp(action), exact: false })).toHaveAttribute("href", `#${targetId}`)
    await expect(page.locator(`#${targetId}`)).toHaveCount(1)
  }
  const { lyrics, meaning } = await page.evaluate(() => ({
    lyrics: document.querySelector("#lyrics")?.getBoundingClientRect().toJSON() ?? null,
    meaning: document.querySelector("#meaning")?.getBoundingClientRect().toJSON() ?? null,
  }))
  expect(lyrics).not.toBeNull()
  expect(meaning).not.toBeNull()
  if (testInfo.project.name === "desktop-chromium") {
    expect(Math.abs(lyrics!.y - meaning!.y)).toBeLessThan(8)
    expect(meaning!.x).toBeGreaterThan(lyrics!.x + lyrics!.width - 8)
  } else if (testInfo.project.name === "mobile-chromium") {
    expect(meaning!.y).toBeGreaterThan(lyrics!.y + lyrics!.height - 8)
  }
  await songActions.getByRole("link", { name: /Harmonium/ }).click()
  await page.locator("#notation").scrollIntoViewIfNeeded()
  await expect(page.locator("#notation")).toBeVisible()
  await page.getByRole("heading", { name: "Practise on harmonium" }).click()
  await expect(
    page.getByRole("heading", { name: /पंक्ति · हिंदी सारगम · .*Keys|Lyric · Harmonium keys/i }),
  ).toBeVisible()
  await expect(page.locator("#notation").getByText("BANDHU HE NIYE CALO", { exact: true }).first()).toBeVisible()
  await page.getByRole("button", { name: "Warm-up guide" }).click()
  await expect(page.getByRole("heading", { name: "Sargam warm-up guide" })).toBeVisible()
  await expect(page.getByText("Aroha · ascending")).toBeVisible()
  await expect(page.getByText("Avaroha · descending")).toBeVisible()
  await expect(page.getByText("सा", { exact: true }).first()).toBeVisible()
  await expect(page.getByRole("img", { name: /Harmonium key guide/i })).toBeVisible()
  await expect(page.getByText(/Beginner alankar · ascending/i)).toBeVisible()
  await page.getByRole("button", { name: /हिंदी सारगम \+ keys|सारगम \+ keys/ }).click()
  await expect(page.getByRole("button", { name: /▶ Harmonium/i }).first()).toBeVisible()
  await expect(songActions.getByRole("link", { name: /Listen/i })).toHaveAttribute("href", "#listen")
  if (testInfo.project.name === "desktop-chromium") {
    const companionListening = page.getByRole("heading", { name: "Listen to this song" }).locator("..")
    await expect(companionListening).toBeVisible()
    const companionNavigation = page.getByRole("navigation", { name: "Return to song text" })
    await expect(companionNavigation.getByRole("link", { name: "Lyrics", exact: true })).toHaveAttribute("href", "#lyrics")
    await expect(companionNavigation.getByRole("link", { name: "Meaning", exact: true })).toHaveAttribute("href", "#meaning")
  } else if (testInfo.project.name === "mobile-chromium") {
    await expect(page.locator("#listen").getByRole("button", { name: /Play/i })).toBeVisible()
    await expect(page.getByRole("navigation", { name: "Song sections" }).getByRole("link", { name: "Listen", exact: true })).toHaveAttribute("href", "#listen")
  } else {
    await expect(page.locator("#listen").getByRole("button", { name: /Play/i })).toBeVisible()
  }
  const { listenBounds, watchBounds } = await page.evaluate(() => ({
    listenBounds: document.querySelector("#listen")?.getBoundingClientRect().toJSON() ?? null,
    watchBounds: document.querySelector("#watch")?.getBoundingClientRect().toJSON() ?? null,
  }))
  expect(listenBounds).not.toBeNull()
  expect(watchBounds).not.toBeNull()
  expect(watchBounds!.y).toBeGreaterThan(listenBounds!.y + listenBounds!.height - 8)
  const alternateRecordings = page.getByText(/More recordings \(/)
  if (await alternateRecordings.count()) await expect(alternateRecordings).toBeVisible()
})

test("opening a song lands on the AI companion", async ({ page }, testInfo) => {
  await page.goto("/songs/1")
  if (testInfo.project.name === "mobile-chromium") {
    await expectMobileSongLanding(page, /Bandhu He Niye Calo/i)
    return
  }
  await expect.poll(() => new URL(page.url()).hash).toBe("#ask")
  await expect(page.getByRole("status", { name: "AI companion ready to help" })).toBeVisible()
})

test("members can discover the configured sign-in flow", async ({ page }) => {
  await page.goto("/")
  const signIn = page.getByRole("link", { name: "Sign in", exact: true })
  await expect(signIn).toBeVisible()
  await signIn.click()
  await expect(page).toHaveURL(/\/signin$/)
  await expect(page.getByRole("heading", { name: "Namaskar. Continue your journey." })).toBeVisible()
  await expect(page.getByRole("link", { name: "Continue with Microsoft" })).toHaveAttribute(
    "href",
    "/.auth/login/aad?post_login_redirect_uri=%2Fsignin%3Fnext%3D%252F",
  )
})

test("garbage and hostile hero queries never reach search or AI", async ({ page }) => {
  let protectedCalls = 0
  await page.route("**/api/v1/{search,ai}/**", async (route) => { protectedCalls += 1; await route.abort() })
  await page.goto("/")
  const input = page.getByLabel(/Search by song number/i)
  await input.fill("<script>alert(1)</script>")
  await clickSearchButton(page)
  await expect(page.getByRole("alert").filter({ hasText: /Please ask something specific/i })).toBeAttached()
  expect(protectedCalls).toBe(0)
  await expect(page).toHaveURL(/\/$/)
})

test("random numbers and missing song identifiers stop before search", async ({ page }) => {
  let searchCalls = 0
  await page.route("**/api/v1/search", async (route) => { searchCalls += 1; await route.abort() })
  await page.goto("/explore")
  const input = page.getByLabel(/Search by number/i)

  await input.fill("9876543210")
  await clickSearchButton(page)
  await expect(page.getByRole("alert").filter({ hasText: "specific about Prabhat Samgiita" })).toBeVisible()
  expect(searchCalls).toBe(0)

  await input.fill("song 5019")
  await clickSearchButton(page)
  await expect(page.getByRole("alert").filter({ hasText: "1 to 5,018" })).toBeVisible()
  expect(searchCalls).toBe(0)
})

test("a meaningful query moves naturally into exploration", async ({ page }) => {
  await page.goto("/")
  await page.getByLabel(/Search by song number/i).fill("morning meditation")
  await clickSearchButton(page)
  await expect(page).toHaveURL(/\/explore\?q=morning(\+|%20)meditation/)
  await expect(page.getByRole("heading", { name: "Explore Prabhat Samgiita" })).toBeVisible()
})

test("home search lands on explore with Searching before results arrive", async ({ page }) => {
  await page.route("**/api/v1/search", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 700))
    await route.fulfill({ json: [songResult] })
  })
  await page.goto("/")
  await page.getByLabel(/Search by song number/i).fill("Musafir aage badhate hain")
  await clickSearchButton(page)
  await expect(page).toHaveURL(/\/explore\?q=.*Musafir/i)
  await expect(page.getByRole("button", { name: "Searching" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Searching" })).toBeDisabled()
  await expect(page.getByText("Finding the verified songs in this collection")).toBeVisible()
  await expect(page.getByRole("heading", { name: /Tomar Katha Bhavi/i })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole("button", { name: "Search", exact: true })).toBeEnabled()
})

test("explore URL with query shows Searching immediately on landing", async ({ page }) => {
  await page.route("**/api/v1/search", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 600))
    await route.fulfill({ json: [songResult] })
  })
  await page.goto("/explore?q=Musafir%20aage%20badhate%20hain")
  await expect(page.getByRole("button", { name: "Searching" })).toBeVisible()
  await expect(page.getByRole("main").getByText("Finding the verified songs in this collection")).toBeVisible()
  await expect(page.getByText("Showing songs for:", { exact: false })).toBeVisible()
  await expect(page.getByRole("heading", { name: /Tomar Katha Bhavi/i })).toBeVisible({ timeout: 15_000 })
  await expect(page.locator("#results")).toBeInViewport()
})

test("explore semantic search shows Searching immediately and scrolls to results", async ({ page }) => {
  await page.route("**/api/v1/search", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 450))
    await route.fulfill({ json: [songResult] })
  })
  await page.goto("/explore")
  await page.getByLabel(/Search by number/i).fill("peaceful devotion")
  await clickSearchButton(page)
  await expect(page.getByRole("button", { name: "Searching" })).toBeVisible()
  await expect(page.locator("#catalog-search").first()).toBeInViewport()
  await expect(page.getByText("Finding the verified songs in this collection")).toBeVisible()
  await expect(page.getByRole("heading", { name: /Tomar Katha Bhavi/i })).toBeVisible({ timeout: 15_000 })
  await expect(page.locator("#results")).toBeInViewport()
})

test("collection click scrolls to search bar, shows Searching, and uses a friendly heading", async ({ page }) => {
  const rainSongs = [
    { ...songResult, number: 119, title: "Rain Song Example 1" },
    { ...songResult, number: 5011, title: "Rain Song Example 2" },
  ]
  await page.route("**/api/v1/search", async (route) => {
    const payload = route.request().postDataJSON() as { query: string }
    await new Promise((resolve) => setTimeout(resolve, 400))
    if (payload.query.includes("Attract Rain") || payload.query.includes("Farmer")) {
      await route.fulfill({ json: rainSongs })
      return
    }
    await route.fulfill({ json: [songResult] })
  })
  await page.goto("/explore")
  await setDetailsOpen(page, "#collections", true)
  await page.getByText("Seasons, earth, and rain", { exact: true }).first().click()
  await clickCollectionLink(page, /Rain, drought, and farmers\s+\d+/)
  await expect(page.getByRole("button", { name: "Searching" })).toBeVisible()
  await expect(page.locator("#catalog-search").first()).toBeInViewport()
  await expect(page.getByRole("alert").filter({ hasText: "specific about Prabhat Samgiita" })).toHaveCount(0)
  await expect(page.getByText("Finding the verified songs in this collection")).toBeVisible()
  await expect(page.getByText("Showing songs for:", { exact: false })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Rain Song Example 1" })).toBeVisible({ timeout: 15_000 })
  await expect(page.locator("#results")).toBeInViewport()
})

test("Explore search stays aligned and infers spoken language", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "webkitSpeechRecognition", {
      configurable: true,
      value: class {
        lang = ""
        interimResults = false
        maxAlternatives = 1
        onresult = null
        onerror = null
        onend = null
        start() {}
      },
    })
  })
  await page.goto("/explore")
  const input = page.getByLabel(/Search by number/i)
  const mic = page.getByRole("button", { name: "Search by voice" })
  const search = page.getByRole("button", { name: "Search", exact: true })
  await expect(mic).toBeVisible()
  await expect(page.getByRole("combobox", { name: "Spoken language" })).toHaveCount(0)
  const [inputBounds, micBounds, searchBounds] = await Promise.all([
    input.boundingBox(),
    mic.boundingBox(),
    search.boundingBox(),
  ])
  expect(inputBounds).not.toBeNull()
  expect(micBounds).not.toBeNull()
  expect(searchBounds).not.toBeNull()
  if (testInfo.project.name === "mobile-chromium") {
    expect(micBounds!.y).toBeGreaterThan(inputBounds!.y + inputBounds!.height - 2)
    expect(searchBounds!.y).toBeGreaterThan(micBounds!.y + micBounds!.height - 2)
    expect(Math.abs(inputBounds!.width - micBounds!.width)).toBeLessThan(3)
    expect(Math.abs(inputBounds!.width - searchBounds!.width)).toBeLessThan(3)
  } else {
    expect(Math.abs(inputBounds!.y - micBounds!.y)).toBeLessThan(3)
    expect(Math.abs(inputBounds!.y - searchBounds!.y)).toBeLessThan(3)
    expect(Math.abs(inputBounds!.height - micBounds!.height)).toBeLessThan(3)
    expect(Math.abs(inputBounds!.height - searchBounds!.height)).toBeLessThan(3)
  }
})

test("harmonium search lands on notation gate for guests", async ({ page }) => {
  await page.goto("/explore")
  await page.getByLabel(/Search by number/i).fill("harmonium notation for song 1")
  await clickSearchButton(page)
  await expect(page).toHaveURL(/\/songs\/1#notation$/)
  await expect(page.locator("#notation")).toBeVisible()
  await expect(page.getByRole("heading", { name: "Harmonium practice" })).toBeVisible()
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible()
})

test("home and Explore resolve natural-language song number intent before RAG", async ({ page }, testInfo) => {
  await page.goto("/")
  await page.getByLabel(/Search by song number/i).fill("explain about prabhat sagiat 223")
  await clickSearchButton(page)
  if (testInfo.project.name === "mobile-chromium") {
    await expect(page).toHaveURL(/\/songs\/223\/?$/)
    await expectMobileSongLanding(page)
  } else {
    await expect(page).toHaveURL(/\/songs\/223#ask$/)
    await expect(page.locator("#ask")).toBeVisible()
  }

  await stubSignedInMember(page)
  await enableHarmoniumPractice(page)
  await page.goto("/explore")
  await page.getByLabel(/Search by number/i).fill("harmonium notation for song 1")
  await clickSearchButton(page)
  await expect(page).toHaveURL(/\/songs\/1#notation$/)
  await expect(page.locator("#notation").first()).toBeVisible()
})

test("search renders verified results and a deliberate no-match state", async ({ page }) => {
  await page.route("**/api/v1/search", async (route) => {
    const payload = route.request().postDataJSON() as { query: string }
    await route.fulfill({ json: payload.query.includes("unmatched theme") ? [] : payload.query === "2256" ? [{ ...songResult, number: 2256, title: "Ásár Kathá Chilo Anek Áge", first_line: "ÁSÁR KATHÁ CHILO ANEK ÁGE" }] : [songResult] })
  })
  await page.goto("/explore")
  const input = page.getByLabel(/Search by number/i)
  await input.fill("Tomar Katha")
  await clickSearchButton(page)
  await expect(page.getByRole("heading", { name: /Tomar Katha Bhavi/i })).toBeVisible()

  await page.goto("/explore?q=unmatched%20theme&kind=semantic")
  await expect(page).toHaveURL(/q=unmatched(\+|%20)theme.*kind=catalog/)
  await expect(page.getByRole("heading", { name: "No songs matched — try Feeling search" })).toBeVisible()
  await expect(page.getByRole("button", { name: /Sign in for Feeling search/i })).toBeVisible()
  await expect(page.getByText(/Normal search looks up numbers and lyrics/i)).toBeVisible()
  await expect(page.getByRole("heading", { name: "Recommended songs to explore" })).toBeVisible()
  await expect(page.getByText("These are suggestions, not matches for your search.")).toBeVisible()
})

test("explore browse does not dump a large song grid before search", async ({ page }) => {
  await page.goto("/explore")
  await expect(page.getByRole("heading", { name: "Explore Prabhat Samgiita" })).toBeVisible()
  await expect(page.locator("#results .grid a")).toHaveCount(0)
})

test("AI companion remembers context, accepts Romanized Hindi, and blocks nonsense", async ({ page }) => {
  const requests: Array<{ prompt: string; history: Array<{ role: string; content: string }> }> = []
  await page.route("**/api/ai/explain", async (route) => {
    const payload = route.request().postDataJSON() as { prompt: string; history: Array<{ role: string; content: string }> }
    requests.push(payload)
    const answer = requests.length === 1
      ? "Yeh gaana pyar, bhakti aur antarik shanti ko vyakt karta hai. [1]"
      : "Aapka pichhla prashn pyar ke sandarbh mein is gaane ka arth tha."
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: `data: ${answer}\n\n`,
    })
  })
  await page.goto("/songs/452#ask")
  await expect(page.getByRole("status", { name: "AI companion ready to help" })).toBeVisible()
  await expect(page.getByRole("img", { name: "Prabhat Samgiita AI" }).first()).toBeVisible()
  const input = page.getByLabel("Ask about this song")
  await input.fill("is gaane ka arth pyar ke sandarbh mein batao")
  await page.getByRole("button", { name: "Send question" }).click()
  await expect(page.getByText(/Yeh gaana pyar/i)).toBeVisible()
  await expect(page.getByText("Would you like to explore next?").first()).toBeVisible()

  await input.fill("what did I ask last?")
  await page.getByRole("button", { name: "Send question" }).click()
  await expect(page.getByText(/Aapka pichhla prashn/i)).toBeVisible()
  expect(requests).toHaveLength(2)
  expect(requests[1].history.map((turn) => turn.content)).toEqual([
    "is gaane ka arth pyar ke sandarbh mein batao",
    "Yeh gaana pyar, bhakti aur antarik shanti ko vyakt karta hai. [1]",
  ])

  await input.fill("kcwcbiubckebckcvjebfkjcckve")
  await page.getByRole("button", { name: "Send question" }).click()
  await expect(page.getByRole("alert").filter({ hasText: "specific about Prabhat Samgiita" })).toBeVisible()
  expect(requests).toHaveLength(2)
})

test("home today recommendations load without manual mood chips", async ({ page }) => {
  await page.route("**/api/v1/recommendations/today**", async (route) => {
    await route.fulfill({
      json: {
        recommendations: [{
          ...songResult,
          number: 4599,
          title: "PROUTER E CAKR AAGE CALO",
          theme: "PROUT",
          score: 1,
          is_verified: true,
          reasons: ["For service and uplift"],
        }],
        signals: [{
          title: "Today’s selection",
          summary: "Auto-selected for this moment.",
          source_name: "Prabhat Samgiita AI",
          source_url: "https://knowindia.india.gov.in/",
          category: "humanity",
        }],
        context: { recommendation_mode: "contextual" },
        disclaimer: "Recommendations are grounded in reviewed collections.",
      },
    })
  })
  await page.goto("/")
  await expect(page.getByText("Finding songs")).toHaveCount(0, { timeout: 20_000 })
  await expect(page.getByRole("link", { name: "PROUTER E CAKR AAGE CALO" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Morning", exact: true })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Service", exact: true })).toHaveCount(0)
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
  await expect(page.locator("#results").first()).toBeVisible()
  const resultTitles = await page.locator("#results").first().locator("xpath=following-sibling::div[1]//h3").allTextContents()
  expect(resultTitles.some((title) => /^Song\s+\d+$/i.test(title.trim()))).toBe(false)

  await page.goto("/songs/68#meaning")
  const meaningHeading = page.locator("#meaning").getByRole("heading", { name: "Understand the song" })
  await meaningHeading.scrollIntoViewIfNeeded()
  await expect(meaningHeading).toBeVisible()
  await expect(page.locator("#lyrics")).toHaveCount(0)
  await expect(page.locator("#meaning")).toBeVisible()
})

test("practice coach always reports microphone and audio-analysis outcomes", async ({ page }) => {
  await stubSignedInMember(page)
  await enableHarmoniumPractice(page)
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
  await clickSearchButton(page)
  await expect(page.getByRole("alert").filter({ hasText: "Search is reconnecting" })).toBeVisible()
  await expect(page.locator("#results")).toBeVisible()
})

test("feedback requires sign-in, then validates and confirms delivery", async ({ page }) => {
  await page.route("**/api/member/session", async (route) => {
    await route.fulfill({
      status: 200,
      json: {
        authenticated: true,
        id: "aad:e2e-user",
        display_name: "E2E Member",
        email: "e2e@example.com",
        identity_provider: "aad",
        personalization_enabled: true,
        favorite_song_numbers: [],
        is_admin: false,
        member_backend: true,
      },
    })
  })
  await page.route("**/api/feedback", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue()
      return
    }
    await route.fulfill({
      status: 201,
      json: { message: "Thank you. Your feedback was received.", feedback_id: "e2e-feedback" },
    })
  })
  await page.goto("/")
  await page.addStyleTag({
    content: "[data-feature='feedback_open']{display:block!important;pointer-events:auto!important}",
  })
  await page.getByRole("button", { name: "Feedback" }).click()
  await page.getByRole("button", { name: "Send feedback" }).click()
  await expect(page.getByRole("status").filter({ hasText: "at least a few words" })).toBeVisible()
  await page.getByLabel("Your feedback").fill("The experience feels calm and clear")
  await page.getByRole("button", { name: "4 stars" }).click()
  await page.getByRole("button", { name: "Send feedback" }).click()
  await expect(page.getByRole("status").filter({ hasText: "feedback was received" })).toBeVisible()
})

test("guests are prompted to sign in before sending feedback", async ({ page }) => {
  await page.route("**/api/member/session", async (route) => {
    await route.fulfill({ status: 200, json: { authenticated: false } })
  })
  await page.goto("/")
  await page.addStyleTag({
    content: "[data-feature='feedback_open']{display:block!important;pointer-events:auto!important}",
  })
  await page.getByRole("button", { name: "Feedback" }).click()
  await expect(page.getByRole("link", { name: "Sign in to send feedback" })).toBeVisible()
})

test("keyboard and assistive users can reach search and primary actions", async ({ page }, testInfo) => {
  await page.goto("/")
  const search = page.getByLabel(/Search by song number/i)
  await expect(search).toBeVisible()
  if (testInfo.project.name.includes("mobile")) {
    expect(await search.evaluate((node: HTMLInputElement) => !node.disabled && node.tabIndex >= 0 && Boolean(node.labels?.length))).toBe(true)
    await expect(page.getByRole("button", { name: "Search", exact: true })).toBeEnabled()
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
