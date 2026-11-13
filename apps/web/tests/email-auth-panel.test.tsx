import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { EmailAuthPanel } from "@/components/email-auth-panel"

describe("EmailAuthPanel sign-up", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("does not ask for a phone number and lets a name, an e-mail and a password create the account", async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ detail: "stop here" }) })
    vi.stubGlobal("fetch", fetchMock)
    render(<EmailAuthPanel next="/" />)

    await user.click(screen.getByRole("tab", { name: "Create account" }))
    expect(screen.queryByText(/phone|mobile/i)).toBeNull()
    expect(screen.queryByRole("textbox", { name: /phone/i })).toBeNull()

    await user.type(screen.getByPlaceholderText("Your name"), "Asha")
    await user.type(screen.getByPlaceholderText("you@example.com"), "asha@example.com")
    await user.type(document.querySelector('input[type="password"]') as HTMLInputElement, "correct horse battery")
    await user.click(screen.getByRole("checkbox", { name: /16 or older/i }))
    const submit = screen.getByRole("button", { name: "Create account" })
    expect(submit).toBeEnabled()
    await user.click(submit)

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const [endpoint, init] = fetchMock.mock.calls[0]!
    expect(endpoint).toBe("/api/auth/register")
    const body = JSON.parse((init as { body: string }).body) as Record<string, unknown>
    expect(body).toEqual({ email: "asha@example.com", password: "correct horse battery", display_name: "Asha", age_confirmed: true })
    expect(Object.keys(body).some((key) => /phone/i.test(key))).toBe(false)
  })

  it("asks for the age tick, starts unticked, and does not call the server until it is ticked", async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ detail: "stop here" }) })
    vi.stubGlobal("fetch", fetchMock)
    render(<EmailAuthPanel next="/" />)

    await user.click(screen.getByRole("tab", { name: "Create account" }))
    const tick = screen.getByRole("checkbox", { name: /16 or older/i })
    expect(tick).not.toBeChecked()
    expect(screen.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms")
    expect(screen.getByRole("link", { name: "Privacy policy" })).toHaveAttribute("href", "/privacy")

    await user.type(screen.getByPlaceholderText("you@example.com"), "asha@example.com")
    await user.type(document.querySelector('input[type="password"]') as HTMLInputElement, "correct horse battery")
    await user.click(screen.getByRole("button", { name: "Create account" }))

    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.getByRole("alert")).toHaveTextContent(/16 or older/)
  })

  it("has no age tick on the sign-in tab and sends no age field when signing in", async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ detail: "stop here" }) })
    vi.stubGlobal("fetch", fetchMock)
    render(<EmailAuthPanel next="/" />)

    expect(screen.queryByRole("checkbox")).toBeNull()
    await user.type(screen.getByPlaceholderText("you@example.com"), "asha@example.com")
    await user.type(document.querySelector('input[type="password"]') as HTMLInputElement, "correct horse battery")
    await user.click(screen.getByRole("button", { name: "Sign in with email" }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const [endpoint, init] = fetchMock.mock.calls[0]!
    expect(endpoint).toBe("/api/auth/login")
    expect(JSON.parse((init as { body: string }).body)).toEqual({
      email: "asha@example.com",
      password: "correct horse battery",
    })
  })
})
