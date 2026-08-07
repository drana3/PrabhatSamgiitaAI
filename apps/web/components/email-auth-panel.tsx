"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import { signInReturnPath } from "@/lib/sign-in"

type Mode = "signin" | "signup"

export function EmailAuthPanel({ next }: { next: string }) {
  const router = useRouter()
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
        throw new Error(payload?.detail || "Could not complete sign-in.")
      }
      router.replace(signInReturnPath(next))
      router.refresh()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not complete sign-in.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-8 rounded-2xl border border-navy-900/10 bg-ivory-50/70 p-5">
      <div className="flex gap-2 rounded-full bg-white p-1">
        <button
          type="button"
          onClick={() => setMode("signin")}
          className={`flex-1 rounded-full px-3 py-2 text-sm font-semibold transition ${
            mode === "signin" ? "bg-navy-950 text-white" : "text-stone-600"
          }`}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => setMode("signup")}
          className={`flex-1 rounded-full px-3 py-2 text-sm font-semibold transition ${
            mode === "signup" ? "bg-navy-950 text-white" : "text-stone-600"
          }`}
        >
          Sign up
        </button>
      </div>

      <form className="mt-5 grid gap-3" onSubmit={(event) => void submit(event)}>
        {mode === "signup" ? (
          <label className="grid gap-1 text-sm">
            <span className="font-semibold text-navy-950">Name</span>
            <input
              type="text"
              autoComplete="name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              className="rounded-xl border border-navy-900/10 bg-white px-3 py-2.5"
              placeholder="Your name"
            />
          </label>
        ) : null}
        <label className="grid gap-1 text-sm">
          <span className="font-semibold text-navy-950">Email</span>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="rounded-xl border border-navy-900/10 bg-white px-3 py-2.5"
            placeholder="you@example.com"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-semibold text-navy-950">Password</span>
          <input
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="rounded-xl border border-navy-900/10 bg-white px-3 py-2.5"
            placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
          />
        </label>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <button type="submit" disabled={busy} className="primary-button justify-center py-3">
          {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in with email"}
        </button>
      </form>
    </div>
  )
}
