import { readFileSync } from "node:fs"
import path from "node:path"
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

import {
  AI_CONSENT_VERSION,
  AiConsentRequiredError,
  aiConsentGranted,
  isConsentValid,
  requireAiConsent,
  setAiConsentMirror,
} from "@/lib/aiConsent"
import { aiConsentReady, useAiConsentStore } from "@/stores/aiConsentStore"

describe("consent rule", () => {
  it("needs a time and the current wording version", () => {
    expect(isConsentValid(null)).toBe(false)
    expect(isConsentValid({ agreedAt: null, version: AI_CONSENT_VERSION })).toBe(false)
    expect(isConsentValid({ agreedAt: "not a date", version: AI_CONSENT_VERSION })).toBe(false)
    expect(isConsentValid({ agreedAt: "2026-11-05T10:00:00.000Z", version: AI_CONSENT_VERSION - 1 })).toBe(false)
    expect(isConsentValid({ agreedAt: "2026-11-05T10:00:00.000Z", version: AI_CONSENT_VERSION })).toBe(true)
  })

  it("a send function is not called, and nothing goes out, until consent is given", async () => {
    const send = vi.fn(async (q: string) => q.toUpperCase())
    const gated = requireAiConsent(send)
    setAiConsentMirror(false)
    await expect(gated("hello")).rejects.toBeInstanceOf(AiConsentRequiredError)
    expect(send).not.toHaveBeenCalled()
    setAiConsentMirror(true)
    await expect(gated("hello")).resolves.toBe("HELLO")
    expect(send).toHaveBeenCalledTimes(1)
  })
})

describe("consent store", () => {
  beforeEach(async () => {
    await aiConsentReady()
    useAiConsentStore.getState().revoke()
  })

  it("starts with no consent", () => {
    expect(isConsentValid(useAiConsentStore.getState())).toBe(false)
    expect(aiConsentGranted()).toBe(false)
  })

  it("agree stores the time and opens the gate", () => {
    useAiConsentStore.getState().agree(new Date("2026-11-05T10:00:00.000Z"))
    const state = useAiConsentStore.getState()
    expect(state.agreedAt).toBe("2026-11-05T10:00:00.000Z")
    expect(state.version).toBe(AI_CONSENT_VERSION)
    expect(aiConsentGranted()).toBe(true)
  })

  it("revoking in Profile closes the gate again", () => {
    useAiConsentStore.getState().agree()
    useAiConsentStore.getState().revoke()
    expect(useAiConsentStore.getState().agreedAt).toBeNull()
    expect(aiConsentGranted()).toBe(false)
  })
})

describe("wiring", () => {
  const root = path.resolve(__dirname, "..")
  const read = (file: string) => readFileSync(path.join(root, file), "utf8")

  it("the API client cannot stream a question without consent", () => {
    expect(read("lib/client.ts")).toContain("streamExplanation: requireAiConsent(rawApi.streamExplanation)")
  })

  it("both AI screens ask for consent before they send", () => {
    expect(read("app/assistant.tsx")).toContain("askConsent(")
    expect(read("app/(tabs)/ai.tsx")).toContain("askConsent(() => void sendConsented(trimmed))")
  })

  it("Profile can take the consent back", () => {
    const profile = read("components/profile-v2/ProfileContent.tsx")
    expect(profile).toContain("useAiConsentStore.getState().revoke()")
    expect(profile).toContain('t("profile.aiConsent")')
  })
})
