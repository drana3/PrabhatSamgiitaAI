import { readFileSync } from "node:fs"
import path from "node:path"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("react-native", () => ({ Platform: { OS: "ios" } }))
vi.mock("@/lib/client", () => ({ apiBaseUrl: "https://api.example.test" }))

import { ageGateOk, MINIMUM_AGE, needsAgeTick } from "@/lib/auth/ageConfirm"
import { registerWithEmail } from "@/lib/localAuth"
import { __testing, exchangeProviderProof } from "@/lib/memberSession"

const root = path.resolve(__dirname, "..")
const read = (file: string) => readFileSync(path.join(root, file), "utf8")

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
}

const session = {
  client_principal: "p",
  display_name: "A",
  email: "a@example.net",
  identity_provider: "local",
}

describe("age rule", () => {
  it("is 16", () => {
    expect(MINIMUM_AGE).toBe(16)
  })

  it("asks for the tick only when a new account is made", () => {
    expect(needsAgeTick("signup")).toBe(true)
    expect(needsAgeTick("signin")).toBe(false)
  })

  it("lets a sign-up through only when the box is ticked, and never blocks a sign-in", () => {
    expect(ageGateOk("signup", false)).toBe(false)
    expect(ageGateOk("signup", true)).toBe(true)
    expect(ageGateOk("signin", false)).toBe(true)
    expect(ageGateOk("signin", true)).toBe(true)
  })
})

describe("registerWithEmail", () => {
  let fetchMock: ReturnType<typeof vi.fn>
  beforeEach(() => {
    fetchMock = vi.fn().mockImplementation(async () => json(200, session))
    vi.stubGlobal("fetch", fetchMock)
    __testing.reset()
  })

  const bodyOf = () => JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string) as Record<string, unknown>

  it("sends age_confirmed: true when the box was ticked", async () => {
    await registerWithEmail({ email: "a@example.net", password: "password123", displayName: "A", ageConfirmed: true })

    expect(fetchMock.mock.calls[0]![0]).toBe("https://api.example.test/api/v1/auth/register")
    expect(bodyOf()).toEqual({
      email: "a@example.net",
      password: "password123",
      display_name: "A",
      age_confirmed: true,
    })
  })

  it("never sends age_confirmed: false (a caller that has no tick sends nothing)", async () => {
    await registerWithEmail({ email: "a@example.net", password: "password123", displayName: "A" })
    expect(bodyOf()).not.toHaveProperty("age_confirmed")
    fetchMock.mockClear()
    await registerWithEmail({ email: "a@example.net", password: "password123", displayName: "A", ageConfirmed: false })
    expect(bodyOf()).not.toHaveProperty("age_confirmed")
  })
})

describe("Apple authorization code", () => {
  beforeEach(() => __testing.reset())

  async function exchangeBody(proof: Parameters<typeof exchangeProviderProof>[1]) {
    const fetchMock = vi.fn().mockResolvedValue(json(401, {}))
    __testing.useFetch(fetchMock as unknown as typeof fetch)
    await exchangeProviderProof("https://api.example.test", proof)
    return JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string) as Record<string, unknown>
  }

  it("goes to the server with the Apple proof, as authorization_code", async () => {
    const body = await exchangeBody({ provider: "apple", idToken: "id", authorizationCode: "code-1", deviceLabel: "ios app" })
    expect(body).toEqual({ provider: "apple", id_token: "id", authorization_code: "code-1", device_label: "ios app" })
  })

  it("is left out when Apple gave none, and for every other provider", async () => {
    expect(await exchangeBody({ provider: "apple", idToken: "id" })).not.toHaveProperty("authorization_code")
    expect(await exchangeBody({ provider: "google", idToken: "id", authorizationCode: "code-1" })).not.toHaveProperty(
      "authorization_code",
    )
  })
})

describe("the screens", () => {
  it.each(["app/onboarding/email.tsx", "app/signin/index.tsx"])("%s asks for the tick on sign-up and sends it", (file) => {
    const source = read(file)
    expect(source).toContain("AgeCheckbox")
    expect(source).toContain("ageGateOk(")
    expect(source).toContain("ageConfirmed: true")
  })

  it.each(["app/onboarding/signin.tsx", "app/signin/index.tsx", "components/guest/GuestSignInSheet.tsx"])(
    "%s says 'you confirm you are 16 or older' under the Apple and Google buttons",
    (file) => {
      expect(read(file)).toContain("<AgeNotice")
    },
  )

  it("About links the Terms and the Privacy policy", () => {
    const source = read("app/about/index.tsx")
    expect(source).toContain("termsUrl()")
    expect(source).toContain("privacyUrl()")
  })
})
