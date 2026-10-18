"use client"

import { useState } from "react"

export function ShareMenu({ title }: { title: string }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const url = typeof window === "undefined" ? "" : window.location.href
  const encodedUrl = encodeURIComponent(url)
  const encodedText = encodeURIComponent(`${title} · Prabhat Samgiita AI`)

  async function nativeShare() {
    if (navigator.share) { await navigator.share({ title, text: `${title} · Prabhat Samgiita`, url }); return }
    setOpen((value) => !value)
  }

  async function copy() {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  return <div className="relative shrink-0"><button type="button" onClick={() => void nativeShare()} data-feature="share_song" className="outline-button whitespace-nowrap">↗ Share</button>{open ? <div className="absolute right-0 top-12 z-30 w-56 rounded-2xl border border-navy-900/10 bg-white p-2 text-sm text-navy-950 shadow-xl"><ShareLink href={`https://wa.me/?text=${encodedText}%20${encodedUrl}`} label="WhatsApp" /><ShareLink href={`https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`} label="X" /><ShareLink href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`} label="Facebook" /><ShareLink href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`} label="LinkedIn" /><button type="button" onClick={() => void copy()} className="w-full rounded-xl px-3 py-2 text-left hover:bg-gold-50">{copied ? "Link copied" : "Copy for Instagram or anywhere"}</button></div> : null}</div>
}

function ShareLink({ href, label }: { href: string; label: string }) {
  return <a href={href} target="_blank" rel="noreferrer" className="block rounded-xl px-3 py-2 hover:bg-gold-50">{label}</a>
}
