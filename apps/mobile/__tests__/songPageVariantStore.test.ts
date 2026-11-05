import { beforeEach, describe, expect, it, vi } from "vitest"

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
    },
  }
})

import AsyncStorage from "@react-native-async-storage/async-storage"

import { SONG_PAGE_VARIANT_KEY, useSongPageVariantStore } from "@/stores/songPageVariantStore"

describe("song page variant store", () => {
  beforeEach(() => {
    useSongPageVariantStore.setState({ variant: "b" })
  })

  it("starts on B, the recommended variant", () => {
    expect(useSongPageVariantStore.getState().variant).toBe("b")
  })

  it("remembers a choice under the key song-page-variant", async () => {
    expect(SONG_PAGE_VARIANT_KEY).toBe("song-page-variant")
    useSongPageVariantStore.getState().setVariant("c")
    expect(useSongPageVariantStore.getState().variant).toBe("c")
    await new Promise((resolve) => setTimeout(resolve, 0))
    const saved = JSON.parse((await AsyncStorage.getItem("song-page-variant")) as string)
    expect(saved.state).toEqual({ variant: "c" })
  })

  it("accepts Current", () => {
    useSongPageVariantStore.getState().setVariant("current")
    expect(useSongPageVariantStore.getState().variant).toBe("current")
  })

  it("falls back to B for a value that is not a variant", () => {
    useSongPageVariantStore.getState().setVariant("zzz" as never)
    expect(useSongPageVariantStore.getState().variant).toBe("b")
  })

  it("loads a saved choice, and ignores a broken one", async () => {
    await AsyncStorage.setItem("song-page-variant", JSON.stringify({ state: { variant: "a" }, version: 1 }))
    await useSongPageVariantStore.persist.rehydrate()
    expect(useSongPageVariantStore.getState().variant).toBe("a")
    await AsyncStorage.setItem("song-page-variant", JSON.stringify({ state: { variant: "q" }, version: 1 }))
    await useSongPageVariantStore.persist.rehydrate()
    expect(useSongPageVariantStore.getState().variant).toBe("b")
  })
})
