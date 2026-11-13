"use client"

import { useState } from "react"

import { LoadingIndicator } from "@/components/loading-indicator"

type Receipt = { reference: string; message: string }

const field =
  "mt-1 block w-full rounded-xl border border-navy-900/15 bg-white px-3 py-2 text-sm text-navy-950 outline-none focus:border-gold-500"
const label = "block text-sm font-semibold text-navy-950"
const hint = "mt-1 text-xs leading-5 text-stone-500"

/** The public takedown form. Plain English, no sign-in, nothing is hidden until a person reads it. */
export function TakedownForm() {
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")
  const [receipt, setReceipt] = useState<Receipt | null>(null)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const text = (name: string) => String(form.get(name) ?? "").trim()
    const optional = (name: string) => text(name) || undefined
    setSending(true)
    setError("")
    try {
      const response = await fetch("/api/takedown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: text("name"),
          organization: optional("organization"),
          email: text("email"),
          phone: optional("phone"),
          address: optional("address"),
          recording: text("recording"),
          work: text("work"),
          claim: optional("claim"),
          good_faith: form.get("good_faith") === "on",
          accuracy: form.get("accuracy") === "on",
          signature: text("signature"),
          website: text("website") || undefined,
        }),
      })
      const data = (await response.json().catch(() => ({}))) as Partial<Receipt> & { detail?: unknown }
      if (!response.ok) {
        if (response.status === 429) {
          setError("Too many requests from this address today. Please try again tomorrow or write to us by email.")
        } else if (response.status === 422) {
          setError("Some fields are missing or not valid. Please check the form, including both confirmations.")
        } else {
          setError(typeof data.detail === "string" ? data.detail : "The request could not be sent. Please try again later.")
        }
        return
      }
      setReceipt({ reference: data.reference ?? "", message: data.message ?? "" })
    } catch {
      setError("The request could not be sent. Please check your connection and try again.")
    } finally {
      setSending(false)
    }
  }

  if (receipt) {
    return (
      <div role="status" className="rounded-3xl border border-navy-900/10 bg-white p-6 sm:p-8">
        <h2 className="font-serif text-2xl text-navy-950">Request received</h2>
        <p className="mt-3 text-sm leading-6 text-stone-600">{receipt.message}</p>
        {receipt.reference ? (
          <p className="mt-4 text-sm text-stone-600">
            Your reference number: <strong className="font-mono text-navy-950">{receipt.reference}</strong>
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-5 rounded-3xl border border-navy-900/10 bg-white p-6 sm:p-8">
      <div>
        <label htmlFor="td-name" className={label}>Your full name</label>
        <input id="td-name" name="name" required minLength={2} maxLength={200} autoComplete="name" className={field} />
      </div>
      <div>
        <label htmlFor="td-org" className={label}>Organization (optional)</label>
        <input id="td-org" name="organization" maxLength={200} autoComplete="organization" className={field} />
      </div>
      <div>
        <label htmlFor="td-email" className={label}>Email address</label>
        <input id="td-email" name="email" type="email" required maxLength={254} autoComplete="email" className={field} />
        <p className={hint}>We reply to this address. We do not show it to the person who uploaded the recording.</p>
      </div>
      <div>
        <label htmlFor="td-phone" className={label}>Phone (optional)</label>
        <input id="td-phone" name="phone" maxLength={60} autoComplete="tel" className={field} />
      </div>
      <div>
        <label htmlFor="td-address" className={label}>Postal address (optional)</label>
        <input id="td-address" name="address" maxLength={400} autoComplete="street-address" className={field} />
      </div>
      <div>
        <label htmlFor="td-recording" className={label}>Which recording?</label>
        <input id="td-recording" name="recording" required minLength={3} maxLength={500} className={field} />
        <p className={hint}>The web address of the recording page is best. If you do not have it, give the exact title and the name of the person who uploaded it.</p>
      </div>
      <div>
        <label htmlFor="td-work" className={label}>Which work is yours, and what is your right in it?</label>
        <textarea id="td-work" name="work" required minLength={10} maxLength={2000} rows={5} className={field} />
        <p className={hint}>For example: the title of the song or album, the year, and whether you are the author, the performer, the record label, or act for them.</p>
      </div>
      <div>
        <label htmlFor="td-claim" className={label}>Anything else we should know (optional)</label>
        <textarea id="td-claim" name="claim" maxLength={2000} rows={3} className={field} />
        <p className={hint}>A link to the original, or how the recording differs from yours.</p>
      </div>

      {/* A field people never see. A bot that fills it is ignored. */}
      <div className="absolute left-[-9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
        <label htmlFor="td-website">Leave this empty</label>
        <input id="td-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <fieldset className="space-y-3 rounded-2xl bg-ivory-50 p-4">
        <legend className="px-1 text-sm font-semibold text-navy-950">Two statements we need from you</legend>
        <label className="flex items-start gap-3 text-sm leading-6 text-stone-600">
          <input type="checkbox" name="good_faith" required className="mt-1.5 h-4 w-4" />
          <span>I believe in good faith that this use is not allowed by the owner of the right, by its agent, or by law.</span>
        </label>
        <label className="flex items-start gap-3 text-sm leading-6 text-stone-600">
          <input type="checkbox" name="accuracy" required className="mt-1.5 h-4 w-4" />
          <span>The information in this request is accurate, and I am the owner of the right or authorized to act for the owner.</span>
        </label>
      </fieldset>

      <div>
        <label htmlFor="td-signature" className={label}>Electronic signature (type your full name)</label>
        <input id="td-signature" name="signature" required minLength={2} maxLength={200} className={field} />
      </div>

      {error ? (
        <p role="alert" className="text-sm font-semibold text-red-700">{error}</p>
      ) : null}

      <button
        type="submit"
        disabled={sending}
        className="inline-flex items-center gap-2 rounded-full bg-navy-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-navy-900 disabled:opacity-60"
      >
        {sending ? <LoadingIndicator compact label="Sending" live={false} /> : null}
        Send request
      </button>
    </form>
  )
}
