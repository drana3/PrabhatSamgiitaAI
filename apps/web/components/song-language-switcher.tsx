"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { localeOptions } from "@/lib/languages"

export function SongLanguageSwitcher({ selectedLanguage }: { selectedLanguage: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [targetLanguage, setTargetLanguage] = useState<string | null>(null)
  const translating = targetLanguage !== null && targetLanguage !== selectedLanguage

  useEffect(() => {
    const savedPosition = window.sessionStorage.getItem("song-translation-scroll")
    if (!savedPosition) return
    const frame = window.requestAnimationFrame(() => {
      window.scrollTo({ top: Number(savedPosition), behavior: "auto" })
      window.sessionStorage.removeItem("song-translation-scroll")
    })
    return () => window.cancelAnimationFrame(frame)
  }, [selectedLanguage])

  useEffect(() => {
    if (!translating) return
    const timeout = window.setTimeout(() => setTargetLanguage(null), 20000)
    return () => window.clearTimeout(timeout)
  }, [translating])

  return (
    <div className="w-full min-w-0 sm:w-auto sm:min-w-[17rem]" aria-busy={translating}>
      <label className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-2xl border border-navy-900/15 bg-white px-3 py-2 text-sm text-navy-800 shadow-sm sm:rounded-full">
        <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.16em] text-navy-600">AI translate</span>
        <select
          value={targetLanguage || selectedLanguage}
          disabled={translating}
          onChange={(event) => {
            const next = new URLSearchParams(searchParams.toString())
            const value = event.target.value
            if (value === selectedLanguage) return
            window.sessionStorage.setItem("song-translation-scroll", String(window.scrollY))
            setTargetLanguage(value)
            if (value === "en") {
              next.delete("language")
            } else {
              next.set("language", value)
            }
            const query = next.toString()
            router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false })
          }}
          aria-label="Reading language"
          className="min-w-0 w-full rounded-full border border-navy-900/15 bg-navy-50 px-3 py-1.5 text-sm text-navy-950 outline-none focus:border-gold-500 disabled:cursor-wait disabled:opacity-70"
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
      {translating ? <div role="status" aria-live="polite" className="mt-2 overflow-hidden rounded-full bg-gold-100"><span className="block h-1 w-2/3 animate-pulse rounded-full bg-gold-600" /><span className="sr-only">Translation in progress</span></div> : null}
    </div>
  )
}
