"use client"

import { formatPhonePayload } from "@prabhat/core"
import { useState } from "react"

import { PhoneInput, phoneInputValid } from "@/components/phone-input"
import { readErrorDetail } from "@/lib/read-error-detail"

type CompletePhoneFormProps = {
  next?: string
  onCompleted?: () => void
}

export function CompletePhoneForm({ next = "/", onCompleted }: CompletePhoneFormProps) {
  const [countryCode, setCountryCode] = useState("IN")
  const [nationalNumber, setNationalNumber] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function savePhone(event: React.FormEvent) {
    event.preventDefault()
    if (!phoneInputValid(countryCode, nationalNumber)) return
    setBusy(true)
    setError(null)
    try {
      const response = await fetch("/api/member/phone", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formatPhonePayload(countryCode, nationalNumber)),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(readErrorDetail(body, "Could not save your mobile number."))
      }
      onCompleted?.()
      window.location.replace(next)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not save phone.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-navy-900/10 bg-white p-6 shadow-sm">
      <h1 className="font-serif text-3xl text-navy-950">Add your mobile number</h1>
      <p className="mt-2 text-sm leading-6 text-stone-600">
        A mobile number is required for every member account. Choose your country code and enter
        your number.
      </p>

      <form className="mt-5 grid gap-4" onSubmit={(event) => void savePhone(event)}>
        <PhoneInput
          countryCode={countryCode}
          nationalNumber={nationalNumber}
          onCountryCodeChange={setCountryCode}
          onNationalNumberChange={setNationalNumber}
          disabled={busy}
        />
        <button
          type="submit"
          disabled={busy || !phoneInputValid(countryCode, nationalNumber)}
          className="primary-button"
        >
          {busy ? "Saving…" : "Continue"}
        </button>
      </form>

      {error ? (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
