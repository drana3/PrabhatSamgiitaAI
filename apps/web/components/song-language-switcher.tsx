"use client"

import { useRouter, useSearchParams } from "next/navigation"

import { localeOptions } from "@/lib/languages"

export function SongLanguageSwitcher({ selectedLanguage }: { selectedLanguage: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  return (
    <label className="grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-2xl border border-navy-900/15 bg-white px-3 py-2 text-sm text-navy-800 shadow-sm sm:w-auto sm:min-w-[17rem] sm:rounded-full">
      <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.16em] text-navy-600">Language</span>
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
        aria-label="Reading language"
        className="min-w-0 w-full rounded-full border border-navy-900/15 bg-navy-50 px-3 py-1.5 text-sm text-navy-950 outline-none focus:border-gold-500"
      >
        {["Indian languages", "World languages"].map((group) => (
          <optgroup key={group} label={group}>
            {localeOptions.filter((option) => option.group === group).map((option) => (
              <option key={option.code} value={option.code}>
                {option.nativeLabel} ({option.label})
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  )
}
