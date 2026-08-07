"use client"

import { useState } from "react"

import { signInReturnPath } from "@/lib/sign-in"

type Mode = "signin" | "signup"

const tabClass = (active: boolean) =>
  `flex-1 rounded-full px-4 py-2.5 text-sm font-semibold transition ${
    active
      ? "bg-navy-950 text-white shadow-sm"
      : "text-stone-600 hover:bg-stone-50 hover:text-navy-950"
  }`

export function EmailAuthPanel({ next }: { next: string }) {
  const [mode, setMode] = useState<Mode>("signin")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const endpoint = mode === "signup" ? "/api/auth/register" : "/api/auth/login"
      const body =
        mode === "signup"
          ? { email, password, display_name: displayName || email.split("@")[0] || "Member" }
          : { email, password }
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const payload = (await response.json().catch(() => null)) as { detail?: string } | null
      if (!response.ok) {
        if (response.status === 409 && mode === "signup") {
          setMode("signin")
        }
        throw new Error(payload?.detail || "Could not complete sign-in.")
      }
      window.location.replace(signInReturnPath(next))
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not complete sign-in.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-2xl border border-navy-900/10 bg-ivory-50/80 p-5 shadow-sm">
      <p className="text-center text-xs font-bold uppercase tracking-[0.18em] text-stone-500">
        Email sign-in
      </p>
      <div
        className="mt-4 flex gap-1 rounded-full border border-navy-900/10 bg-white p-1"
        role="tablist"
        aria-label="Email authentication mode"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === "signin"}
          onClick={() => setMode("signin")}
          className={tabClass(mode === "signin")}
        >
          Sign in
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "signup"}
          onClick={() => setMode("signup")}
          className={tabClass(mode === "signup")}
        >
          Create account
        </button>
      </div>

      <form className="mt-5 grid gap-3" onSubmit={(event) => void submit(event)}>
        {mode === "signup" ? (
          <label className="grid gap-1.5 text-sm">
            <span className="font-semibold text-navy-950">Name</span>
            <input
              type="text"
              autoComplete="name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              className="rounded-xl border border-navy-900/10 bg-white px-3 py-3 shadow-sm outline-none transition focus:border-gold-500"
              placeholder="Your name"
            />
          </label>
        ) : null}
        <label className="grid gap-1.5 text-sm">
          <span className="font-semibold text-navy-950">Email</span>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="rounded-xl border border-navy-900/10 bg-white px-3 py-3 shadow-sm outline-none transition focus:border-gold-500"
            placeholder="you@example.com"
          />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-semibold text-navy-950">Password</span>
          <input
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="rounded-xl border border-navy-900/10 bg-white px-3 py-3 shadow-sm outline-none transition focus:border-gold-500"
            placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
          />
        </label>
        {error ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" disabled={busy} className="primary-button mt-1">
          {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in with email"}
        </button>
      </form>
    </div>
  )
}
