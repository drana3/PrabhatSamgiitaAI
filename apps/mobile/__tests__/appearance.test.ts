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

import AsyncStorage from "@react-native-async-storage/async-storage"

import { amDark, amLight } from "@/constants/tokens/amColors"
import {
  DEFAULT_APPEARANCE,
  DEFAULT_REVIEW_STYLE,
  LEGACY_APPEARANCE,
  migrateAppearanceState,
  normalizeAppearance,
  normalizeReviewStyle,
  resolveAmTheme,
  resolveAppearance,
  settleAppearance,
  statusBarStyleFor,
  themeFor,
} from "@/lib/appearance"
import { useAppearanceStore } from "@/stores/appearanceStore"

describe("appearance: theme resolution", () => {
  it("Light and Dark ignore the system", () => {
    for (const system of ["light", "dark", null, undefined] as const) {
      expect(resolveAppearance("light", system)).toBe("light")
      expect(resolveAppearance("dark", system)).toBe("dark")
    }
  })

  it("Auto follows the system and falls back to light", () => {
    expect(resolveAppearance("auto", "dark")).toBe("dark")
    expect(resolveAppearance("auto", "light")).toBe("light")
    expect(resolveAppearance("auto", null)).toBe("light")
    expect(resolveAppearance("auto", undefined)).toBe("light")
  })

  it("returns the amLight and amDark token sets", () => {
    expect(themeFor("light")).toBe(amLight)
    expect(themeFor("dark")).toBe(amDark)
    expect(resolveAmTheme("dark", "light")).toBe(amDark)
    expect(resolveAmTheme("auto", "dark")).toBe(amDark)
    expect(resolveAmTheme("auto", "light")).toBe(amLight)
    expect(resolveAmTheme("light", "dark")).toBe(amLight)
  })

  it("picks a status bar that reads on the theme", () => {
    expect(statusBarStyleFor("dark")).toBe("light")
    expect(statusBarStyleFor("light")).toBe("dark")
  })

  it("a new install defaults to Auto (follows the phone); an existing one is pinned to Light", () => {
    expect(DEFAULT_APPEARANCE).toBe("auto")
    expect(LEGACY_APPEARANCE).toBe("light")
    expect(DEFAULT_REVIEW_STYLE).toBe("simple")
  })
})

describe("appearance: normalising stored values", () => {
  it("keeps valid values and replaces anything else with the default", () => {
    expect(normalizeAppearance("dark")).toBe("dark")
    expect(normalizeAppearance("auto")).toBe("auto")
    expect(normalizeAppearance("sepia")).toBe("auto")
    expect(normalizeAppearance(undefined)).toBe("auto")
    expect(normalizeAppearance(3)).toBe("auto")
    expect(normalizeAppearance(3, "light")).toBe("light")
    expect(normalizeReviewStyle("adaptive")).toBe("adaptive")
    expect(normalizeReviewStyle("fast")).toBe("simple")
  })
})

describe("appearance: persistence migration", () => {
  it("migrates nothing and junk to the new-install defaults: Auto, not settled", () => {
    const fresh = { appearance: "auto", reviewStyle: "simple", appearanceSettled: false }
    expect(migrateAppearanceState(undefined, 0)).toEqual(fresh)
    expect(migrateAppearanceState(null)).toEqual(fresh)
    expect(migrateAppearanceState("junk", 0)).toEqual(fresh)
  })

  it("an existing payload with a missing or damaged theme means Light (what that install was showing)", () => {
    const legacy = { appearance: "light", reviewStyle: "simple", appearanceSettled: true }
    expect(migrateAppearanceState({}, 0)).toEqual(legacy)
    expect(migrateAppearanceState({ appearance: 7, reviewStyle: {} }, 1)).toEqual(legacy)
  })

  it("keeps saved choices and ignores unrelated keys", () => {
    expect(
      migrateAppearanceState({ appearance: "dark", reviewStyle: "daily", savedSongIds: ["ps-1"] }, 1),
    ).toEqual({ appearance: "dark", reviewStyle: "daily", appearanceSettled: true })
  })
})

describe("appearance: the default is settled once", () => {
  it("a new install (welcome not finished) keeps Auto", () => {
    expect(settleAppearance({ appearance: "auto", appearanceSettled: false }, false)).toBe("auto")
  })

  it("an install that finished the old welcome and never chose a theme keeps Light", () => {
    expect(settleAppearance({ appearance: "auto", appearanceSettled: false }, true)).toBe("light")
  })

  it("an install that already settled, or whose person chose a theme, is never touched", () => {
    expect(settleAppearance({ appearance: "dark", appearanceSettled: true }, true)).toBeNull()
    expect(settleAppearance({ appearance: "auto", appearanceSettled: true }, true)).toBeNull()
  })

  it("the store applies it once and Profile > Appearance can still change it", async () => {
    useAppearanceStore.setState({ appearance: "auto", appearanceSettled: false })
    useAppearanceStore.getState().settleAppearance(true)
    expect(useAppearanceStore.getState().appearance).toBe("light")
    expect(useAppearanceStore.getState().appearanceSettled).toBe(true)
    useAppearanceStore.getState().setAppearance("auto")
    useAppearanceStore.getState().settleAppearance(true)
    expect(useAppearanceStore.getState().appearance).toBe("auto")

    useAppearanceStore.setState({ appearance: "auto", appearanceSettled: false })
    useAppearanceStore.getState().settleAppearance(false)
    expect(useAppearanceStore.getState().appearance).toBe("auto")
    expect(useAppearanceStore.getState().appearanceSettled).toBe(true)
  })
})

describe("appearance: store persistence", () => {
  it("writes the choice under its own key and leaves the preferences payload alone", async () => {
    await AsyncStorage.setItem(
      "prabhat-preferences",
      JSON.stringify({ state: { savedSongIds: ["ps-7"] }, version: 2 }),
    )
    useAppearanceStore.getState().setAppearance("dark")
    useAppearanceStore.getState().setReviewStyle("adaptive")
    await new Promise((resolve) => setTimeout(resolve, 0))

    const stored = JSON.parse((await AsyncStorage.getItem("prabhat-appearance")) as string)
    expect(stored.state).toEqual({ appearance: "dark", reviewStyle: "adaptive", appearanceSettled: true })
    expect(stored.version).toBe(2)
    expect(JSON.parse((await AsyncStorage.getItem("prabhat-preferences")) as string).state.savedSongIds).toEqual([
      "ps-7",
    ])
  })

  it("rehydrates a saved choice and survives a damaged one", async () => {
    await AsyncStorage.setItem(
      "prabhat-appearance",
      JSON.stringify({ state: { appearance: "auto", reviewStyle: "daily" }, version: 1 }),
    )
    await useAppearanceStore.persist.rehydrate()
    expect(useAppearanceStore.getState().appearance).toBe("auto")
    expect(useAppearanceStore.getState().reviewStyle).toBe("daily")

    // An existing install: a version 1 payload that chose Dark keeps it, and counts as settled.
    await AsyncStorage.setItem(
      "prabhat-appearance",
      JSON.stringify({ state: { appearance: "dark", reviewStyle: "simple" }, version: 1 }),
    )
    await useAppearanceStore.persist.rehydrate()
    expect(useAppearanceStore.getState().appearance).toBe("dark")
    expect(useAppearanceStore.getState().appearanceSettled).toBe(true)

    // An older payload (version 0) with a value this build does not know: that install showed Light.
    await AsyncStorage.setItem(
      "prabhat-appearance",
      JSON.stringify({ state: { appearance: "sepia" }, version: 0 }),
    )
    await useAppearanceStore.persist.rehydrate()
    expect(useAppearanceStore.getState().appearance).toBe("light")
    expect(useAppearanceStore.getState().reviewStyle).toBe("simple")
  })

  it("ignores an invalid value passed to the setter", () => {
    useAppearanceStore.getState().setAppearance("neon" as never)
    expect(useAppearanceStore.getState().appearance).toBe("auto")
  })
})

import { nativeColorSchemeFor } from "@/lib/appearance"

describe("nativeColorSchemeFor", () => {
  it("pins the OS for Light and Dark, and hands control back for Auto", () => {
    expect(nativeColorSchemeFor("light")).toBe("light")
    expect(nativeColorSchemeFor("dark")).toBe("dark")
    expect(nativeColorSchemeFor("auto")).toBeNull()
  })
})
