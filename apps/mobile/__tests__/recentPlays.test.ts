import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("expo-constants", () => ({
  default: { expoConfig: { extra: {} } },
}))

vi.mock("@react-native-async-storage/async-storage", () => {
  const store = new Map<string, string>()
  return {
    default: {
      getItem: vi.fn(async (key: string) => store.get(key) ?? null),
      setItem: vi.fn(async (key: string, value: string) => {
        store.set(key, value)
      }),
      removeItem: vi.fn(async (key: string) => {
        store.delete(key)
      }),
      clear: vi.fn(async () => {
        store.clear()
      }),
    },
  }
})

vi.mock("@/lib/client", () => ({
  api: {
    fetchMemberFavorites: vi.fn(),
    addMemberFavorite: vi.fn(),
    removeMemberFavorite: vi.fn(),
  },
}))

vi.mock("@/lib/memberAuth", () => ({
  memberAuthAvailable: () => false,
  memberProxyKey: () => undefined,
  buildMemberAuthHeaders: () => ({}),
}))

import { usePreferencesStore } from "@/stores/preferencesStore"

describe("recent play history", () => {
  beforeEach(() => {
    usePreferencesStore.setState({
      language: "English",
      savedSongIds: [],
      recentPlays: [],
      searchRecents: [],
      songNotes: {},
      preferredAudioBySong: {},
      syncingFavorites: false,
    })
  })

  it("records plays most-recent first and dedupes", () => {
    const { recordRecentPlay } = usePreferencesStore.getState()
    recordRecentPlay({
      id: "ps-1",
      number: 1,
      title: "One",
      thumbnailUrl: "https://example.com/1.jpg",
      themes: ["dawn"],
    })
    recordRecentPlay({
      id: "ps-2",
      number: 2,
      title: "Two",
      thumbnailUrl: "https://example.com/2.jpg",
      themes: ["peace"],
    })
    recordRecentPlay({
      id: "ps-1",
      number: 1,
      title: "One",
      thumbnailUrl: "https://example.com/1.jpg",
      themes: ["dawn"],
    })
    expect(usePreferencesStore.getState().recentPlays.map((item) => item.number)).toEqual([1, 2])
  })

  it("persists search recents most-recent first", () => {
    const { addSearchRecent, clearSearchRecents } = usePreferencesStore.getState()
    addSearchRecent("peace")
    addSearchRecent("morning")
    addSearchRecent("peace")
    expect(usePreferencesStore.getState().searchRecents).toEqual(["peace", "morning"])
    clearSearchRecents()
    expect(usePreferencesStore.getState().searchRecents).toEqual([])
  })

  it("stores and clears personal song notes", () => {
    const { setSongNote } = usePreferencesStore.getState()
    setSongNote("ps-1", "  Keep this for dawn practice  ")
    expect(usePreferencesStore.getState().songNotes["ps-1"]).toContain("dawn practice")
    setSongNote("ps-1", "   ")
    expect(usePreferencesStore.getState().songNotes["ps-1"]).toBeUndefined()
  })

  it("remembers a non-latest recording pick per song", () => {
    const { setPreferredAudioUrl } = usePreferencesStore.getState()
    setPreferredAudioUrl("ps-8", "https://example.test/old.mp3")
    expect(usePreferencesStore.getState().preferredAudioBySong["ps-8"]).toBe(
      "https://example.test/old.mp3",
    )
    setPreferredAudioUrl("ps-8", null)
    expect(usePreferencesStore.getState().preferredAudioBySong["ps-8"]).toBeUndefined()
  })
})
