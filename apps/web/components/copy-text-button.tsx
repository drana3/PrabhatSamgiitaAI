"use client"

import { useState } from "react"

export function CopyTextButton({
  text,
  label = "Copy lyrics",
  compact = false,
}: {
  text: string
  label?: string
  /** Inline chip for chat bubbles — no top margin. */
  compact?: boolean
}) {
  const [copied, setCopied] = useState(false)
  const value = text.trim()
  if (!value) return null

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      className={
        compact
          ? "mt-2 inline-flex items-center gap-1.5 rounded-full border border-navy-900/10 bg-ivory-50 px-3 py-1 text-[11px] font-semibold text-navy-950 transition hover:border-gold-500/40"
          : "outline-button mt-4"
      }
    >
      {copied ? "Copied" : label}
    </button>
  )
}
