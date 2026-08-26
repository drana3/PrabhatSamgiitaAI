"use client"

import { useEffect, useRef, useState } from "react"

import { LoadingIndicator } from "@/components/loading-indicator"
import { CopyTextButton } from "@/components/copy-text-button"
import { SongLanguageSwitcher } from "@/components/song-language-switcher"
import { fetchSongLocalization } from "@/lib/api"
import { localeLabel } from "@/lib/languages"
import {
  hasStoredMeaningForLanguage,
  storedMeaningForLanguage,
  englishMeaningText,
  type SongMeaningSource,
} from "@/lib/song-meanings"

function MeaningBlock({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <article className="mt-4 rounded-2xl border border-navy-900/10 bg-ivory-50 p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold-700">{label}</p>
      <p dir="auto" className="mt-3 whitespace-pre-wrap text-sm leading-7 text-stone-700 select-text">{value}</p>
    </article>
  )
}

function sameText(left: string | null | undefined, right: string | null | undefined) {
  const a = left?.trim()
  const b = right?.trim()
  return Boolean(a && b && a === b)
}

function selectedMeaningForLanguage(
  song: SongMeaningSource,
  language: string,
  localizedMeaning: string | null,
): string | null {
  const english = englishMeaningText(song)
  if (language === "en") return english || null

  const stored = storedMeaningForLanguage(song, language)?.trim()
  if (stored && !sameText(stored, english)) return stored

  const translated = localizedMeaning?.trim() || null
  if (translated && !sameText(translated, english)) return translated
  return null
}

function meaningUnavailableMessage(language: string) {
  const label = localeLabel(language)
  if (language === "en") return "English meaning is not available for this song yet."
  if (language === "hi") return "Hindi meaning is not available for this song yet."
  return `${label} translation isn’t available for this song yet. English meaning is shown below — try again later, or pick another language.`
}

export function SongMeaningSection({
  songNumber,
  song,
  initialLanguage,
}: {
  songNumber: number
  song: SongMeaningSource
  initialLanguage: string
}) {
  const [language, setLanguage] = useState(initialLanguage)
  const [localizedMeaning, setLocalizedMeaning] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)

  useEffect(() => {
    setLanguage(initialLanguage)
  }, [initialLanguage])

  const handleLanguageChange = (nextLanguage: string) => {
    setLanguage(nextLanguage)
    setLocalizedMeaning(null)
    setError(null)
    setLoading(nextLanguage !== "en" && !hasStoredMeaningForLanguage(song, nextLanguage))
  }

  useEffect(() => {
    if (language === "en" || hasStoredMeaningForLanguage(song, language)) {
      setLocalizedMeaning(null)
      setLoading(false)
      setError(null)
      return
    }

    const currentRequest = ++requestId.current
    setLoading(true)
    setError(null)
    setLocalizedMeaning(null)

    void fetchSongLocalization(songNumber, localeLabel(language))
      .then((result) => {
        if (currentRequest !== requestId.current) return
        const meaning = result?.localized_meaning?.trim() || null
        const english = englishMeaningText(song)
        const usable = meaning && meaning !== english ? meaning : null
        setLocalizedMeaning(usable)
        if (!usable) {
          setError(meaningUnavailableMessage(language))
        }
      })
      .catch(() => {
        if (currentRequest !== requestId.current) return
        setError(meaningUnavailableMessage(language))
      })
      .finally(() => {
        if (currentRequest === requestId.current) {
          setLoading(false)
        }
      })
  }, [language, song, songNumber])

  const selectedMeaning = selectedMeaningForLanguage(song, language, localizedMeaning)
  const english = englishMeaningText(song)
  const hasMeaning = Boolean(selectedMeaning || english || song.hindi_meaning)

  if (!hasMeaning) return null

  const meaningLabel = language === "en" ? "English" : `${localeLabel(language)} meaning`
  const copyText = selectedMeaning || english || song.hindi_meaning?.trim() || ""

  return (
    <section id="meaning" className="scroll-mt-28 rounded-2xl border border-navy-900/10 bg-white p-5 sm:p-7">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="w-full sm:w-auto">
          <p className="eyebrow">Meaning</p>
          <h2 className="mt-2 font-serif text-3xl text-navy-950">Understand the song</h2>
        </div>
        <SongLanguageSwitcher
          selectedLanguage={language}
          onLanguageChange={handleLanguageChange}
        />
      </div>
      {loading ? (
        <div className="mt-4 flex justify-center text-gold-800">
          <LoadingIndicator label="Translating meaning" />
        </div>
      ) : null}
      {error ? <p role="alert" className="mt-4 text-sm text-amber-800">{error}</p> : null}
      {language !== "en" && selectedMeaning ? (
        <MeaningBlock label={meaningLabel} value={selectedMeaning} />
      ) : null}
      <MeaningBlock label="English" value={english} />
      {language !== "hi" && !english ? (
        <MeaningBlock label="हिन्दी" value={song.hindi_meaning} />
      ) : null}
      {!loading ? <CopyTextButton text={copyText} label="Copy meaning" /> : null}
    </section>
  )
}
