import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { describe, expect, it, vi } from "vitest"

vi.mock("@react-native-async-storage/async-storage", () => {
  const memory = new Map<string, string>()
  return {
    default: {
      getItem: async (key: string) => memory.get(key) ?? null,
      setItem: async (key: string, value: string) => {
        memory.set(key, value)
      },
      removeItem: async (key: string) => {
        memory.delete(key)
      },
      clear: async () => {
        memory.clear()
      },
    },
  }
})

import { hasAnything, wordsToReview } from "@/lib/onboarding/backSummary"
import {
  ONBOARDING_PREFIX,
  ONBOARDING_ROUTES,
  ONBOARDING_STEPS,
  TOTAL_STEPS,
  afterOnboardingSignIn,
  entryRoute,
  firstNameFor,
  isKiirtanTabPath,
  landingRoute,
  nextStep,
  normalizeStoredStep,
  previousStep,
  shouldShowKiirtanHint,
  stepNumber,
} from "@/lib/onboarding/flow"
import { PLAYER_POLICY } from "@/lib/playerPolicy"
import { useOnboardingStore } from "@/stores/onboardingStore"
import { onboardingEn } from "@/locales/onboarding"

const root = path.resolve(__dirname, "..")
const read = (file: string) => readFileSync(path.join(root, file), "utf8")

describe("onboarding: the path of a new person", () => {
  it("is Welcome, then three numbered steps: Language, Sign in, What is inside", () => {
    expect([...ONBOARDING_STEPS]).toEqual(["welcome", "language", "signin", "inside"])
    expect(TOTAL_STEPS).toBe(3)
    expect(ONBOARDING_STEPS.map(stepNumber)).toEqual([0, 1, 2, 3])
  })

  it("moves forward and back through the steps", () => {
    expect(nextStep("welcome")).toBe("language")
    expect(nextStep("language")).toBe("signin")
    expect(nextStep("signin")).toBe("inside")
    expect(nextStep("inside")).toBeNull()
    expect(previousStep("welcome")).toBeNull()
    expect(previousStep("inside")).toBe("signin")
  })

  it("every step has its route, all under /onboarding except the welcome screen", () => {
    expect(ONBOARDING_ROUTES.welcome).toBe("/welcome")
    for (const step of ["language", "signin", "inside"] as const) expect(ONBOARDING_ROUTES[step].startsWith(`${ONBOARDING_PREFIX}/`)).toBe(true)
  })

  it("ends on the Kiirtan tab, not on Today and not on a notifications step", () => {
    expect(landingRoute()).toBe("/v2/kiirtan")
    expect(isKiirtanTabPath("/v2/kiirtan")).toBe(true)
    expect(isKiirtanTabPath("/v2/songs")).toBe(false)
  })

  it("there is no notifications, usage-data, theme or Start-with-one step, and no Skip", () => {
    expect(ONBOARDING_STEPS.join(" ")).not.toMatch(/notif|usage|theme|start|skip/i)
    const files = readdirSync(path.join(root, "app/onboarding")).join(" ")
    expect(files).not.toMatch(/notif|usage|theme|start|skip/i)
    const copy = JSON.stringify(onboardingEn).toLowerCase()
    expect(copy).not.toContain("skip")
    expect(copy).not.toContain("notification")
    expect(copy).not.toContain("help us improve")
  })
})

describe("onboarding: the returning path", () => {
  it("after a sign-in a new person goes to step 3, a returning one to 'Your songs are back'", () => {
    expect(afterOnboardingSignIn(false)).toEqual({ route: "/onboarding/inside", step: "inside" })
    expect(afterOnboardingSignIn(true)).toEqual({ route: "/onboarding/back", step: "back" })
  })

  it("greets by first name, never a placeholder name or a guest", () => {
    expect(firstNameFor("Dada Maetreya", "signed_in")).toBe("Dada")
    expect(firstNameFor("Guest", "signed_in")).toBeNull()
    expect(firstNameFor("Dada", "guest")).toBeNull()
    expect(firstNameFor("  ", "signed_in")).toBeNull()
  })

  it("counts words to review the way the Learn queue does (not new, due before the end of today)", () => {
    const now = new Date(2026, 10, 10, 9, 0, 0).getTime()
    const tomorrow = new Date(2026, 10, 11, 9, 0, 0).getTime()
    const cards = {
      a: { status: "new", dueAt: now },
      b: { status: "learning", dueAt: now + 60_000 },
      c: { status: "review", dueAt: now - 86_400_000 },
      d: { status: "review", dueAt: tomorrow },
    }
    expect(wordsToReview(cards, now)).toBe(2)
    expect(hasAnything({ saved: 0, playlists: 0, words: 0 })).toBe(false)
    expect(hasAnything({ saved: 0, playlists: 1, words: 0 })).toBe(true)
  })
})

describe("onboarding: who sees it", () => {
  it("a person who finished the welcome before never sees it, whatever step is stored", () => {
    for (const step of ["welcome", "language", "signin", "inside", "done"] as const) {
      expect(entryRoute({ hasCompletedWelcome: true, step })).toEqual({ to: "app" })
    }
  })

  it("a new person starts at the welcome screen", () => {
    expect(entryRoute({ hasCompletedWelcome: false, step: "welcome" })).toEqual({ to: "onboarding", route: "/welcome", step: "welcome" })
  })

  it("an app closed in the middle opens on the step it was closed on", () => {
    expect(entryRoute({ hasCompletedWelcome: false, step: "signin" })).toEqual({ to: "onboarding", route: "/onboarding/signin", step: "signin" })
    expect(entryRoute({ hasCompletedWelcome: false, step: "inside" }).to).toBe("onboarding")
  })

  it("a finished or unknown stored step starts again at the welcome screen (after a sign-out)", () => {
    expect(entryRoute({ hasCompletedWelcome: false, step: "done" })).toMatchObject({ route: "/welcome" })
    expect(normalizeStoredStep("nonsense")).toBe("welcome")
    expect(normalizeStoredStep(undefined)).toBe("welcome")
    expect(normalizeStoredStep("done")).toBe("done")
  })

  it("app/index.tsx decides with entryRoute and waits for the stored step", () => {
    const source = read("app/index.tsx")
    expect(source).toContain("entryRoute(")
    expect(source).toContain("useOnboardingStore.persist")
  })

  it("the onboarding screens stay clear of the mini-player and the tab bar", () => {
    const row = PLAYER_POLICY.find((r) => r.id === "onboarding")!
    expect(row.prefixes).toContain(ONBOARDING_PREFIX)
    expect(row.mini).toBe("hidden")
    expect(row.tabBar).toBe(false)
  })
})

describe("onboarding: the one-time Kiirtan hint", () => {
  it("shows only while pending and only on the Kiirtan tab", () => {
    expect(shouldShowKiirtanHint({ pending: true, pathname: "/v2/kiirtan" })).toBe(true)
    expect(shouldShowKiirtanHint({ pending: true, pathname: "/v2/kiirtan/" })).toBe(true)
    expect(shouldShowKiirtanHint({ pending: true, pathname: "/v2/songs" })).toBe(false)
    expect(shouldShowKiirtanHint({ pending: true, pathname: "/recording/12" })).toBe(false)
    expect(shouldShowKiirtanHint({ pending: false, pathname: "/v2/kiirtan" })).toBe(false)
  })

  it("is armed by the end of the onboarding, closed for good by Got it", () => {
    const store = useOnboardingStore
    store.setState({ step: "inside", returning: true, kiirtanHintPending: false, kiirtanHintSeen: false })
    store.getState().finish()
    expect(store.getState()).toMatchObject({ step: "done", returning: false, kiirtanHintPending: true })
    store.getState().dismissKiirtanHint()
    expect(store.getState()).toMatchObject({ kiirtanHintPending: false, kiirtanHintSeen: true })
    // a second finish (sign out, sign in again) does not bring the hint back
    store.getState().finish()
    expect(store.getState().kiirtanHintPending).toBe(false)
  })

  it("remembers the step and the returning flag", () => {
    const store = useOnboardingStore
    store.setState({ step: "welcome", returning: false })
    store.getState().goTo("signin")
    store.getState().setReturning(true)
    expect(store.getState()).toMatchObject({ step: "signin", returning: true })
  })
})

describe("onboarding: no phone number, no Facebook", () => {
  const screens = readdirSync(path.join(root, "app/onboarding")).map((f) => `app/onboarding/${f}`)
  it("none of the onboarding screens asks for a phone number or offers Facebook", () => {
    expect(screens.length).toBeGreaterThanOrEqual(6)
    for (const file of [...screens, "components/onboarding/useOnboardingSignIn.ts", "app/welcome.tsx"]) {
      const source = read(file)
      expect(source, file).not.toMatch(/PhoneField|needsPhone|phone=1|facebook/i)
    }
    expect(JSON.stringify(onboardingEn)).not.toMatch(/phone number|mobile number|facebook/i)
  })

  it("the welcome screen has no logo, app-name line or web address", () => {
    const source = read("app/welcome.tsx")
    expect(source).not.toMatch(/brandAssets\.(logo|mark|icon)/)
    expect(source).not.toMatch(/https?:\/\/|\.com|\.org/)
  })
})
