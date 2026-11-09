import { describe, expect, it } from "vitest"

import {
  afterSignIn,
  authErrorMessage,
  checkEmailForm,
  isEmailValid,
  visibleProviders,
  type EmailForm,
} from "@/lib/auth/signInFlow"

const real = { apple: false, google: false, microsoft: false }

describe("visibleProviders", () => {
  it("shows Apple and Google in the preview only as mocks, never Microsoft", () => {
    expect(visibleProviders(real, true)).toEqual({ apple: true, google: true, microsoft: false })
  })
  it("hides Microsoft in the preview even when it is configured", () => {
    expect(visibleProviders({ ...real, microsoft: true }, true).microsoft).toBe(false)
    expect(visibleProviders({ ...real, microsoft: true }, false).microsoft).toBe(true)
  })
  it("follows the real config outside the preview", () => {
    expect(visibleProviders(real, false)).toEqual(real)
    expect(visibleProviders({ ...real, apple: true }, false)).toEqual({ apple: true, google: false, microsoft: false })
  })
})

describe("isEmailValid", () => {
  it("wants something@domain.tld", () => {
    expect(isEmailValid(" a@b.co ")).toBe(true)
    expect(isEmailValid("a@b")).toBe(false)
    expect(isEmailValid("a b@c.de")).toBe(false)
    expect(isEmailValid("")).toBe(false)
  })
})

describe("checkEmailForm", () => {
  const form: EmailForm = { mode: "signin", email: "a@b.co", password: "x", name: "" }
  it("sign-in needs an email and a password", () => {
    expect(checkEmailForm(form)).toEqual({ ok: true })
    expect(checkEmailForm({ ...form, email: "nope" })).toMatchObject({ ok: false, field: "email" })
    expect(checkEmailForm({ ...form, password: "" })).toMatchObject({ ok: false, field: "password" })
  })
  it("sign-up needs a name, an email and 8 characters of password, and no mobile number", () => {
    const up: EmailForm = { ...form, mode: "signup", password: "longenough", name: "Dada" }
    expect(checkEmailForm(up)).toEqual({ ok: true })
    expect(checkEmailForm({ ...up, name: "D" })).toMatchObject({ ok: false, field: "name" })
    expect(checkEmailForm({ ...up, password: "short" })).toMatchObject({ ok: false, field: "password" })
  })
})

describe("authErrorMessage", () => {
  it("says nothing when the person cancelled", () => {
    expect(authErrorMessage(new Error("Sign-in was cancelled."))).toBeNull()
  })
  it("turns network failures into one calm line", () => {
    expect(authErrorMessage(new TypeError("Network request failed"))).toBe("Can't reach the server. Check your connection and try again.")
  })
  it("hides developer setup text", () => {
    expect(authErrorMessage(new Error("Google sign-in needs EXPO_PUBLIC_GOOGLE_CLIENT_ID (Web OAuth client from Google Cloud)."))).toBe("Sign-in didn't finish. Try again.")
    expect(authErrorMessage(undefined)).toBe("Sign-in didn't finish. Try again.")
  })
  it("passes on a server message such as a wrong password", () => {
    expect(authErrorMessage(new Error("Incorrect email or password."))).toBe("Incorrect email or password.")
  })
})

describe("afterSignIn", () => {
  it("asks for what is missing, once", () => {
    expect(afterSignIn({ needsName: true }, false)).toEqual({ to: "complete-profile", path: "/complete-profile?name=1" })
    expect(afterSignIn({ needsPhone: true }, false)).toEqual({ to: "complete-profile", path: "/complete-profile?phone=1" })
    expect(afterSignIn({ needsName: true, needsPhone: true }, true)).toEqual({ to: "complete-profile", path: "/complete-profile?name=1&phone=1" })
  })
  it("goes back, or to the app when it was opened from welcome", () => {
    expect(afterSignIn({}, false)).toEqual({ to: "back" })
    expect(afterSignIn({}, true)).toEqual({ to: "tabs" })
  })
})
