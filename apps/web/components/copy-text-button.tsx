"use client"

import { useState } from "react"

export function CopyTextButton({
  text,
  label = "Copy lyrics",
}: {
  text: string
  label?: string
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
    <button type="button" onClick={() => void copy()} className="outline-button mt-4">
      {copied ? "Copied" : label}
    </button>
  )
}
