"use client"

import { useEffect, useRef, useState } from "react"

import { LoadingIndicator } from "@/components/loading-indicator"
import { CopyTextButton } from "@/components/copy-text-button"
import { SongLanguageSwitcher } from "@/components/song-language-switcher"
import { fetchSongLocalization } from "@/lib/api"
import { localeLabel } from "@/lib/languages"
import { scrollToSectionId, stickyHeaderOffset } from "@/lib/scroll-to-section"
import {
  hasStoredMeaningForLanguage,
  storedMeaningForLanguage,
  storedExplanationForLanguage,
  englishMeaningText,
  centralIdeaText,
  isNearDuplicateProse,
  normalizeProseBlock,
  type SongMeaningSource,
} from "@/lib/song-meanings"

/** Prefer #lyrics in the URL without forcing a scroll jump. */
function ensureLyricsHash() {
  if (typeof window === "undefined") return
  if (window.location.hash === "#lyrics") return
  const { pathname, search } = window.location
  window.history.replaceState(window.history.state, "", `${pathname}${search}#lyrics`)
}

/**
 * Stay on lyrics after a meaning language switch — but only scroll when lyrics
 * have actually left the viewport. Blind scrollTo + rAF was bouncing the page
 * to Listen and back while “Central idea generation in progress” reflowed.
 */
function keepLyricsInView() {
  if (typeof window === "undefined") return
  ensureLyricsHash()
  const lyrics = document.getElementById("lyrics")
  if (!lyrics) return
  const top = lyrics.getBoundingClientRect().top
  const header = stickyHeaderOffset()
  // Already near the lyrics band — leave scroll alone.
  if (top >= header - 16 && top <= header + 160) return
  scrollToSectionId("lyrics", { behavior: "auto" })
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

/** Hide "In simple words" when it is just the meaning restated (content, not length). */
function isMeaningMirror(explanation: string | null | undefined, ...meanings: Array<string | null | undefined>) {
  if (!explanation?.trim()) return false
  for (const meaning of meanings) {
    if (isNearDuplicateProse(explanation, meaning)) return true
  }
  return false
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

function centralIdeaLabel(language: string, kind: "official" | "generated" | null) {
  const lang = localeLabel(language)
  if (kind === "generated") {
    return language === "en" ? "Central idea · In simple words" : `${lang} · In simple words`
  }
  return language === "en" ? "Central idea" : `${lang} · Central idea`
}

function applyExplanationResult(
  explanation: string | null,
  kindRaw: string | null | undefined,
  officialCentralIdea: string,
  setLocalizedExplanation: (value: string | null) => void,
  setExplanationKind: (value: "official" | "generated" | null) => void,
) {
  const kind =
    kindRaw === "official" || kindRaw === "generated"
      ? kindRaw
      : explanation
        ? officialCentralIdea
          ? "official"
          : "generated"
        : null
  if (explanation && !sameText(explanation, officialCentralIdea || null)) {
    setLocalizedExplanation(explanation)
    setExplanationKind(kind)
  } else if (explanation && officialCentralIdea && sameText(explanation, officialCentralIdea)) {
    setLocalizedExplanation(null)
    setExplanationKind("official")
  } else if (!explanation) {
    setLocalizedExplanation(null)
    setExplanationKind(null)
  }
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
  const [explanationKind, setExplanationKind] = useState<"official" | "generated" | null>(null)
  const [loadingMeaning, setLoadingMeaning] = useState(false)
  /** True while LLM Central idea runs — show progress; meaning stays usable. */
  const [centralIdeaPending, setCentralIdeaPending] = useState(false)
  const [centralIdeaUnavailable, setCentralIdeaUnavailable] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)
  /** Re-pin lyrics once after meaning paints — never after Central idea (that jumped to Listen). */
  const pinLyricsAfterMeaning = useRef(false)

  useEffect(() => {
    setLanguage(initialLanguage)
  }, [initialLanguage])

  const officialCentralIdea = centralIdeaText(song)

  const handleLanguageChange = (nextLanguage: string) => {
    const needsMeaning = nextLanguage !== "en" && !hasStoredMeaningForLanguage(song, nextLanguage)
    const storedExpl = storedExplanationForLanguage(song, nextLanguage)
    const needsExplanation =
      !storedExpl && !(nextLanguage === "en" && Boolean(officialCentralIdea))
    // Only re-pin after meaning paint — never for CI-only generate (that caused Listen flash).
    pinLyricsAfterMeaning.current = needsMeaning
    setLanguage(nextLanguage)
    setLocalizedMeaning(null)
    setLocalizedExplanation(storedExpl)
    setExplanationKind(
      storedExpl ? (officialCentralIdea ? "official" : "generated") : null,
    )
    setError(null)
    setCentralIdeaUnavailable(false)
    setLoadingMeaning(needsMeaning || (needsExplanation && Boolean(officialCentralIdea)))
    setCentralIdeaPending(needsExplanation && !officialCentralIdea)
    ensureLyricsHash()
    if (needsMeaning) keepLyricsInView()
  }

  useEffect(() => {
    if (loadingMeaning || !pinLyricsAfterMeaning.current) return
    pinLyricsAfterMeaning.current = false
    // Meaning just painted — gentle pin only (skip if already on lyrics).
    keepLyricsInView()
  }, [loadingMeaning, language, localizedMeaning])

  useEffect(() => {
    const storedExpl = storedExplanationForLanguage(song, language)
    setLocalizedExplanation(storedExpl)
    setExplanationKind(
      storedExpl ? (officialCentralIdea ? "official" : "generated") : null,
    )

    const needsMeaning = language !== "en" && !hasStoredMeaningForLanguage(song, language)
    const needsExplanation =
      !storedExpl && !(language === "en" && Boolean(officialCentralIdea))
    if (!needsMeaning && !needsExplanation) {
      if (language === "en") setLocalizedMeaning(null)
      setLoadingMeaning(false)
      setCentralIdeaPending(false)
      setError(null)
      return
    }

    const currentRequest = ++requestId.current
    setError(null)
    setCentralIdeaUnavailable(false)
    if (needsMeaning) setLocalizedMeaning(null)

    // Fast path: meaning (+ official Central idea translate). Never wait on LLM generate.
    const needsFastFetch = needsMeaning || (needsExplanation && Boolean(officialCentralIdea))
    const needsGeneratedIdea = needsExplanation && !officialCentralIdea

    setLoadingMeaning(needsFastFetch)
    setCentralIdeaPending(needsGeneratedIdea)

    const label = localeLabel(language)

    const run = async () => {
      if (needsFastFetch) {
        try {
          const result = await fetchSongLocalization(songNumber, label)
          if (currentRequest !== requestId.current) return
          const meaning = result?.localized_meaning?.trim() || null
          const english = englishMeaningText(song)
          const usable = meaning && meaning !== english ? meaning : null
          if (needsMeaning) {
            setLocalizedMeaning(usable)
            if (!usable) setError(meaningUnavailableMessage(language))
          }
          applyExplanationResult(
            result?.localized_explanation?.trim() || null,
            result?.explanation_kind,
            officialCentralIdea,
            setLocalizedExplanation,
            setExplanationKind,
          )
        } catch {
          if (currentRequest !== requestId.current) return
          if (needsMeaning) setError(meaningUnavailableMessage(language))
        } finally {
          if (currentRequest === requestId.current) setLoadingMeaning(false)
        }
      } else {
        setLoadingMeaning(false)
      }

      if (!needsGeneratedIdea) {
        if (currentRequest === requestId.current) setCentralIdeaPending(false)
        return
      }

      // LLM "In simple words" — progress only; never touch scroll (restoreScrollY
      // bounced the page to Listen then back to Lyrics when the status line reflowed).
      try {
        const idea = await fetchSongLocalization(songNumber, label, {
          generateCentralIdea: true,
        })
        if (currentRequest !== requestId.current) return
        const explanation = idea?.localized_explanation?.trim() || null
        applyExplanationResult(
          explanation,
          idea?.explanation_kind ?? "generated",
          officialCentralIdea,
          setLocalizedExplanation,
          setExplanationKind,
        )
        const mirrorsMeaning = isMeaningMirror(
          explanation,
          selectedMeaningForLanguage(song, language, localizedMeaning),
          englishMeaningText(song),
          song.hindi_meaning,
        )
        if (!explanation || mirrorsMeaning) {
          setCentralIdeaUnavailable(true)
          setLocalizedExplanation(null)
        }
      } catch {
        if (currentRequest === requestId.current) setCentralIdeaUnavailable(true)
      } finally {
        if (currentRequest === requestId.current) setCentralIdeaPending(false)
      }
    }

    void run()
  }, [language, song, songNumber, officialCentralIdea])

  const selectedMeaning = selectedMeaningForLanguage(song, language, localizedMeaning)
  const english = englishMeaningText(song)
  const showLocalizedCentralIdea = Boolean(
    localizedExplanation &&
      (!officialCentralIdea || !sameText(localizedExplanation, officialCentralIdea)) &&
      !isMeaningMirror(
        localizedExplanation,
        selectedMeaning,
        english,
        song.hindi_meaning,
      ),
  )
  const hasMeaning = Boolean(
    selectedMeaning || english || song.hindi_meaning || officialCentralIdea || showLocalizedCentralIdea,
  )

  if (!hasMeaning) return null

  const meaningLabel = language === "en" ? "English" : `${localeLabel(language)} meaning`
  const copyText =
    [
      selectedMeaning || english || song.hindi_meaning?.trim(),
      showLocalizedCentralIdea ? localizedExplanation : null,
      officialCentralIdea,
    ]
      .filter(Boolean)
      .join("\n\n") || ""

  return (
    <section
      id="meaning"
      className="scroll-mt-28 rounded-2xl border border-navy-900/10 bg-white p-5 [overflow-anchor:none] sm:p-7"
    >
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
      {loadingMeaning ? (
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
      {showLocalizedCentralIdea ? (
        <MeaningBlock
          label={centralIdeaLabel(language, explanationKind)}
          value={localizedExplanation}
        />
      ) : null}
      {/* Reserved slot — avoids Listen flashing into view when progress ↔ empty-state swaps. */}
      {(centralIdeaPending || centralIdeaUnavailable) && !showLocalizedCentralIdea ? (
        <div className="mt-4 flex min-h-[2rem] items-center justify-center [overflow-anchor:none]">
          {centralIdeaPending ? (
            <div className="text-gold-800">
              <LoadingIndicator label="Central idea generation in progress" compact />
            </div>
          ) : (
            <p className="text-sm text-stone-500">
              A short Central idea isn’t available in {localeLabel(language)} yet — the meaning
              above is still complete.
            </p>
          )}
        </div>
      ) : null}
      {officialCentralIdea ? (
        <MeaningBlock
          label={
            showLocalizedCentralIdea && explanationKind === "official"
              ? "Central idea (English)"
              : "Central idea"
          }
          value={officialCentralIdea}
        />
      ) : null}
      {!loadingMeaning ? <CopyTextButton text={copyText} label="Copy meaning" /> : null}
    </section>
  )
}
