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

import { localProfileSink } from "@/lib/profile/localSink"
import { saveProfile } from "@/lib/profile/saveProfile"
import { useAuthStore } from "@/stores/authStore"
import { pickAvatarPhoto, useProfileStore } from "@/stores/profileStore"

describe("profile store and the local sink", () => {
  beforeEach(() => {
    useProfileStore.getState().reset()
    useAuthStore.getState().signOut()
  })

  it("prefers the chosen picture over the provider's", () => {
    useProfileStore.getState().setProviderPhoto("https://lh3.example.com/a.jpg")
    expect(pickAvatarPhoto(useProfileStore.getState())).toBe("https://lh3.example.com/a.jpg")
    useProfileStore.getState().setProfile({ photoUri: "data:image/jpeg;base64,AAAA" })
    expect(pickAvatarPhoto(useProfileStore.getState())).toBe("data:image/jpeg;base64,AAAA")
  })

  it("takes only https picture URLs from a provider", () => {
    useProfileStore.getState().setProviderPhoto("javascript:alert(1)")
    expect(useProfileStore.getState().providerPhotoUrl).toBeNull()
    useProfileStore.getState().setProviderPhoto("http://insecure.example.com/a.jpg")
    expect(useProfileStore.getState().providerPhotoUrl).toBeNull()
  })

  it("saves a guest's name on the phone only", async () => {
    await saveProfile({ name: "Dada" }, localProfileSink)
    expect(useProfileStore.getState().name).toBe("Dada")
    expect(useAuthStore.getState().displayName).toBe("Guest")
  })

  it("also sets the account name when signed in", async () => {
    useAuthStore.getState().applyMemberSession({ displayName: "Old Name", email: "a@b.co", memberId: "1" })
    await saveProfile({ name: "New Name" }, localProfileSink)
    expect(useAuthStore.getState().displayName).toBe("New Name")
    expect(useProfileStore.getState().name).toBe("New Name")
  })

  it("Remove photo also drops the provider picture", async () => {
    useProfileStore.getState().setProviderPhoto("https://lh3.example.com/a.jpg")
    await saveProfile({ photoUri: null }, localProfileSink)
    expect(pickAvatarPhoto(useProfileStore.getState())).toBeNull()
  })

  it("signing out takes the name and picture off the phone", () => {
    useAuthStore.getState().applyMemberSession({ displayName: "Dada", email: "a@b.co", memberId: "1" })
    useProfileStore.getState().setProfile({ name: "Dada", photoUri: "data:image/jpeg;base64,AAAA" })
    useAuthStore.getState().signOut()
    expect(useProfileStore.getState()).toMatchObject({ name: null, photoUri: null })
  })

  it("reset forgets everything", () => {
    useProfileStore.getState().setProfile({ name: "Dada", photoUri: "data:image/jpeg;base64,AAAA" })
    useProfileStore.getState().reset()
    expect(useProfileStore.getState()).toMatchObject({ name: null, photoUri: null, providerPhotoUrl: null })
  })
})
