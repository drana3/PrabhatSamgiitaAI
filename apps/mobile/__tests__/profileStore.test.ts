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

import { localProfileSink } from "@/lib/profile/localSink"
import { saveProfile } from "@/lib/profile/saveProfile"
import { useAuthStore } from "@/stores/authStore"
import { pickAvatarPhoto, profileOwnerKey, reconcileProfileOwner, useProfileStore } from "@/stores/profileStore"

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

  describe("owner of the saved profile", () => {
    const signInAs = (memberId: string, email: string) =>
      useAuthStore.getState().applyMemberSession({ displayName: "Someone", email, memberId })

    it("keys a guest as guest and an account by id, else by email", () => {
      expect(profileOwnerKey({ mode: "guest", memberId: "x", email: "x@y.z" })).toBe("guest")
      expect(profileOwnerKey({ mode: "signed_in", memberId: "A1", email: "a@y.z" })).toBe("member:A1")
      expect(profileOwnerKey({ mode: "signed_in", memberId: null, email: "A@Y.z" })).toBe("member:a@y.z")
    })

    it("stamps the saved profile with its owner", async () => {
      signInAs("A", "a@x.co")
      await saveProfile({ name: "Alice" }, localProfileSink)
      expect(useProfileStore.getState().owner).toBe("member:A")
    })

    it("switching from account A to account B drops A's profile", async () => {
      signInAs("A", "a@x.co")
      await saveProfile({ name: "Alice", photoUri: "data:image/jpeg;base64,AAAA" }, localProfileSink)
      signInAs("B", "b@x.co")
      expect(useProfileStore.getState()).toMatchObject({ name: null, photoUri: null, owner: "member:B" })
    })

    it("a different email on the same session replaces the profile too", async () => {
      useAuthStore.getState().applyMemberSession({ displayName: "Someone", email: "a@x.co", memberId: null })
      await saveProfile({ name: "Alice" }, localProfileSink)
      useAuthStore.getState().applyMemberSession({ displayName: "Someone", email: "other@x.co", memberId: null })
      expect(useProfileStore.getState().name).toBeNull()
    })

    it("sign-out then sign-in as another person shows nothing of the first", async () => {
      signInAs("A", "a@x.co")
      await saveProfile({ name: "Alice" }, localProfileSink)
      useAuthStore.getState().signOut()
      signInAs("B", "b@x.co")
      expect(useProfileStore.getState().name).toBeNull()
    })

    it("the same account keeps its profile across session refreshes", async () => {
      signInAs("A", "a@x.co")
      await saveProfile({ name: "Alice" }, localProfileSink)
      signInAs("A", "a@x.co")
      expect(useProfileStore.getState().name).toBe("Alice")
    })

    it("a guest's profile is kept under guest and dropped on sign-in", async () => {
      await saveProfile({ name: "Guesty" }, localProfileSink)
      expect(useProfileStore.getState()).toMatchObject({ name: "Guesty", owner: "guest" })
      signInAs("A", "a@x.co")
      expect(useProfileStore.getState().name).toBeNull()
    })

    it("a new save never inherits another owner's picture", () => {
      useProfileStore.setState({ owner: "member:A", name: "Alice", photoUri: "data:image/jpeg;base64,AAAA", providerPhotoUrl: null })
      signInAs("B", "b@x.co") // reconcile has already cleared it
      useProfileStore.setState({ owner: "member:A", photoUri: "data:image/jpeg;base64,AAAA" }) // stale write
      useProfileStore.getState().setProfile({ name: "Bob" })
      expect(useProfileStore.getState()).toMatchObject({ owner: "member:B", name: "Bob", photoUri: null })
    })

    it("cold start with a stale profile of another account clears it", async () => {
      await AsyncStorage.setItem(
        "prabhat-profile",
        JSON.stringify({ state: { owner: "member:A", name: "Alice", photoUri: "data:image/jpeg;base64,AAAA", providerPhotoUrl: null }, version: 0 }),
      )
      await AsyncStorage.setItem(
        "prabhat-auth",
        JSON.stringify({ state: { mode: "signed_in", displayName: "Bob", displayNameOverridden: false, email: "b@x.co", memberId: "B", isAdmin: false, memberBackend: false, identityProvider: "google", hasCompletedWelcome: true }, version: 0 }),
      )
      await useAuthStore.persist.rehydrate()
      await useProfileStore.persist.rehydrate()
      reconcileProfileOwner()
      expect(useProfileStore.getState()).toMatchObject({ name: null, photoUri: null, owner: "member:B" })
    })

    it("cold start keeps the profile of the same signed-in account", async () => {
      await AsyncStorage.setItem(
        "prabhat-profile",
        JSON.stringify({ state: { owner: "member:A", name: "Alice", photoUri: null, providerPhotoUrl: null }, version: 0 }),
      )
      await AsyncStorage.setItem(
        "prabhat-auth",
        JSON.stringify({ state: { mode: "signed_in", displayName: "Alice", displayNameOverridden: false, email: "a@x.co", memberId: "A", isAdmin: false, memberBackend: false, identityProvider: "google", hasCompletedWelcome: true }, version: 0 }),
      )
      // profile loads first, while the auth store still holds its guest default: nothing is wiped yet
      const authLoading = useAuthStore.persist.rehydrate()
      await useProfileStore.persist.rehydrate()
      expect(useProfileStore.getState().name).toBe("Alice")
      await authLoading
      expect(useProfileStore.getState()).toMatchObject({ name: "Alice", owner: "member:A" })
    })

    it("cold start with no owner (older build) drops the data", async () => {
      await AsyncStorage.setItem(
        "prabhat-profile",
        JSON.stringify({ state: { name: "Old", photoUri: null, providerPhotoUrl: null }, version: 0 }),
      )
      await AsyncStorage.setItem("prabhat-auth", JSON.stringify({ state: { mode: "guest" }, version: 0 }))
      await useAuthStore.persist.rehydrate()
      await useProfileStore.persist.rehydrate()
      expect(useProfileStore.getState().name).toBeNull()
    })
  })
})
