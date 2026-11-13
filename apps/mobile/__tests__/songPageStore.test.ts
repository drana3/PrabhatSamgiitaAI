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

import { useSongPageStore } from "@/stores/songPageStore"

const KEY = "prabhat-song-page-v2"
const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

describe("what the song page remembers on the device", () => {
  it("starts with no translation under the lines, Official on the Translation page and the language of the app for word meanings", () => {
    const s = useSongPageStore.getState()
    expect(s.lineTranslation).toBe("off")
    expect(s.translationKind).toBe("official")
    expect(s.wordLanguage).toBe("auto")
  })

  it("writes the translation mode, the kind and the word language to the device", async () => {
    useSongPageStore.getState().setLineTranslation("literal")
    useSongPageStore.getState().setTranslationKind("poetic")
    useSongPageStore.getState().setWordLanguage("ru")
    await tick()
    const stored = JSON.parse((await AsyncStorage.getItem(KEY)) as string)
    expect(stored.version).toBe(3)
    expect(stored.state).toMatchObject({ lineTranslation: "literal", translationKind: "poetic", wordLanguage: "ru" })
  })

  it("reads them back after a restart", async () => {
    await AsyncStorage.setItem(KEY, JSON.stringify({ state: { lineTranslation: "poetic", translationKind: "literal", wordLanguage: "es", textSize: 2 }, version: 3 }))
    await useSongPageStore.persist.rehydrate()
    expect(useSongPageStore.getState()).toMatchObject({ lineTranslation: "poetic", translationKind: "literal", wordLanguage: "es", textSize: 2 })
  })

  it("an older payload keeps what is still valid and gets the new defaults", async () => {
    await AsyncStorage.setItem(KEY, JSON.stringify({ state: { translationOn: true, stripExpanded: true, textSize: 0, script: "devanagari", translations: ["ru"] }, version: 2 }))
    await useSongPageStore.persist.rehydrate()
    const s = useSongPageStore.getState()
    expect(s).toMatchObject({ lineTranslation: "off", translationKind: "official", textSize: 0, script: "devanagari" })
    expect(s.translations).toEqual(["ru"])
  })

  it("a damaged payload falls back to the defaults", async () => {
    await AsyncStorage.setItem(KEY, JSON.stringify({ state: { lineTranslation: "official", translationKind: "machine", wordLanguage: "off" }, version: 3 }))
    await useSongPageStore.persist.rehydrate()
    expect(useSongPageStore.getState()).toMatchObject({ lineTranslation: "off", translationKind: "official", wordLanguage: "auto" })
  })
})
