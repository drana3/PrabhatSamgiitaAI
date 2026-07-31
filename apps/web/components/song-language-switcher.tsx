"use client"

import { useRouter, useSearchParams } from "next/navigation"

import { localeOptions } from "@/lib/languages"

export function SongLanguageSwitcher({ selectedLanguage }: { selectedLanguage: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  return (
    <label className="flex items-center gap-3 rounded-full border border-ink-200 bg-white px-4 py-2 text-sm text-ink-700 shadow-sm">
      <span className="text-[11px] uppercase tracking-[0.25em] text-ink-500">Language</span>
      <select
        value={selectedLanguage}
        onChange={(event) => {
          const next = new URLSearchParams(searchParams.toString())
          const value = event.target.value
          if (value === "en") {
            next.delete("language")
          } else {
            next.set("language", value)
          }
          router.replace(`?${next.toString()}`, { scroll: false })
        }}
        className="rounded-full border border-ink-200 bg-ink-50 px-3 py-1 text-sm text-ink-900 outline-none"
      >
        {localeOptions.map((option) => (
          <option key={option.code} value={option.code}>
            {option.nativeLabel} ({option.label})
          </option>
        ))}
      </select>
    </label>
  )
}
