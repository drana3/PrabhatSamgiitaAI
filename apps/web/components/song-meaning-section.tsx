"use client"

import { useEffect, useRef, useState } from "react"

import { LoadingIndicator } from "@/components/loading-indicator"
import { CopyTextButton } from "@/components/copy-text-button"
import { SongLanguageSwitcher } from "@/components/song-language-switcher"
import { fetchSongLocalization } from "@/lib/api"
import { localeLabel } from "@/lib/languages"
import { scrollToSectionId } from "@/lib/scroll-to-section"
import {
  hasStoredMeaningForLanguage,
  storedMeaningForLanguage,
  storedExplanationForLanguage,
  englishMeaningText,
  centralIdeaText,
  normalizeProseBlock,
  type SongMeaningSource,
} from "@/lib/song-meanings"

function keepMeaningInView() {
  if (typeof window === "undefined") return
  if (window.location.hash !== "#meaning") {
    const { pathname, search } = window.location
    window.history.replaceState(window.history.state, "", `${pathname}${search}#meaning`)
  }
  scrollToSectionId("meaning", { behavior: "auto" })
  // Re-pin after layout settles (translated blocks + fonts can shift the page).
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => scrollToSectionId("meaning", { behavior: "auto" }))
  })
  window.setTimeout(() => scrollToSectionId("meaning", { behavior: "auto" }), 120)
  window.setTimeout(() => scrollToSectionId("meaning", { behavior: "auto" }), 360)
  window.setTimeout(() => scrollToSectionId("meaning", { behavior: "auto" }), 800)
}

function MeaningBlock({ label, value }: { label: string; value?: string | null }) {
  const prose = value?.trim() ? normalizeProseBlock(value) : ""
  if (!prose) return null
  return (
    <article className="mt-4 rounded-2xl border border-navy-900/10 bg-ivory-50 p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold-700">{label}</p>
      <p dir="auto" className="mt-3 whitespace-pre-wrap text-sm leading-7 text-stone-700 select-text">{prose}</p>
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
  const [localizedExplanation, setLocalizedExplanation] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)
  const pinMeaningAfterLoad = useRef(false)

  useEffect(() => {
    setLanguage(initialLanguage)
  }, [initialLanguage])

  const englishCentralIdea = centralIdeaText(song)

  const handleLanguageChange = (nextLanguage: string) => {
    pinMeaningAfterLoad.current = true
    setLanguage(nextLanguage)
    setLocalizedMeaning(null)
    setLocalizedExplanation(storedExplanationForLanguage(song, nextLanguage))
    setError(null)
    const needsMeaning = nextLanguage !== "en" && !hasStoredMeaningForLanguage(song, nextLanguage)
    const needsExplanation =
      nextLanguage !== "en" &&
      Boolean(englishCentralIdea) &&
      !storedExplanationForLanguage(song, nextLanguage)
    setLoading(needsMeaning || needsExplanation)
    keepMeaningInView()
  }

  useEffect(() => {
    if (loading || !pinMeaningAfterLoad.current) return
    pinMeaningAfterLoad.current = false
    keepMeaningInView()
  }, [loading, language, localizedMeaning, localizedExplanation])

  useEffect(() => {
    if (language === "en") {
      setLocalizedMeaning(null)
      setLocalizedExplanation(null)
      setLoading(false)
      setError(null)
      return
    }

    const storedExpl = storedExplanationForLanguage(song, language)
    setLocalizedExplanation(storedExpl)

    const needsMeaning = !hasStoredMeaningForLanguage(song, language)
    const needsExplanation = Boolean(englishCentralIdea) && !storedExpl
    if (!needsMeaning && !needsExplanation) {
      setLocalizedMeaning(null)
      setLoading(false)
      setError(null)
      return
    }

    const currentRequest = ++requestId.current
    setLoading(true)
    setError(null)
    if (needsMeaning) setLocalizedMeaning(null)

    void fetchSongLocalization(songNumber, localeLabel(language))
      .then((result) => {
        if (currentRequest !== requestId.current) return
        const meaning = result?.localized_meaning?.trim() || null
        const english = englishMeaningText(song)
        const usable = meaning && meaning !== english ? meaning : null
        if (needsMeaning) {
          setLocalizedMeaning(usable)
          if (!usable) setError(meaningUnavailableMessage(language))
        }
        const explanation = result?.localized_explanation?.trim() || null
        if (explanation && !sameText(explanation, englishCentralIdea)) {
          setLocalizedExplanation(explanation)
        }
      })
      .catch(() => {
        if (currentRequest !== requestId.current) return
        if (needsMeaning) setError(meaningUnavailableMessage(language))
      })
      .finally(() => {
        if (currentRequest === requestId.current) {
          setLoading(false)
        }
      })
  }, [language, song, songNumber, englishCentralIdea])

  const selectedMeaning = selectedMeaningForLanguage(song, language, localizedMeaning)
  const english = englishMeaningText(song)
  const translatedCentralIdea =
    language !== "en" && localizedExplanation && !sameText(localizedExplanation, englishCentralIdea)
      ? localizedExplanation
      : null
  const hasMeaning = Boolean(
    selectedMeaning || english || song.hindi_meaning || englishCentralIdea,
  )

  if (!hasMeaning) return null

  const meaningLabel = language === "en" ? "English" : `${localeLabel(language)} meaning`
  const copyText =
    [
      selectedMeaning || english || song.hindi_meaning?.trim(),
      translatedCentralIdea,
      englishCentralIdea,
    ]
      .filter(Boolean)
      .join("\n\n") || ""

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
      {translatedCentralIdea ? (
        <MeaningBlock
          label={`${localeLabel(language)} · Central idea`}
          value={translatedCentralIdea}
        />
      ) : null}
      <MeaningBlock
        label={translatedCentralIdea ? "Central idea (English)" : "Central idea"}
        value={englishCentralIdea || null}
      />
      {!loading ? <CopyTextButton text={copyText} label="Copy meaning" /> : null}
    </section>
  )
}
