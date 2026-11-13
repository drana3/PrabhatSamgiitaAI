import { explicitResponseLanguage } from "@prabhat/core"
import { t } from "@/lib/i18n"

/**
 * Answer language (spec 2.2 "language"). The backend reads an explicit request
 * in the prompt ("in Hindi"), so the picker only adds that phrase when the
 * reader has not already asked for a language in the question itself.
 */
export type AssistantLanguage = "auto" | "english" | "hindi" | "bengali"

export const ASSISTANT_LANGUAGES: Array<{
  id: AssistantLanguage
  label: string
  /** Shown under the label in the picker. */
  note: string
}> = [
  {
    id: "auto",
    get label() {
      return t("assistant.lang.auto")
    },
    get note() {
      return t("assistant.lang.autoNote")
    },
  },
  {
    id: "english",
    get label() {
      return t("language.name.en")
    },
    note: "",
  },
  {
    id: "hindi",
    get label() {
      return t("assistant.lang.hindi")
    },
    note: "हिन्दी",
  },
  {
    id: "bengali",
    get label() {
      return t("assistant.lang.bengali")
    },
    note: "বাংলা",
  },
]

const SUFFIX: Record<Exclude<AssistantLanguage, "auto">, string> = {
  english: "Answer in English.",
  hindi: "Answer in Hindi.",
  bengali: "Answer in Bengali.",
}

export function isAssistantLanguage(value: unknown): value is AssistantLanguage {
  return value === "auto" || value === "english" || value === "hindi" || value === "bengali"
}

export function languageLabel(language: AssistantLanguage): string {
  return ASSISTANT_LANGUAGES.find((item) => item.id === language)?.label ?? t("assistant.lang.auto")
}

/** Short form for the pill beside the grounding chip. */
export function languagePillLabel(language: AssistantLanguage): string {
  return language === "auto" ? t("profile.appearance.auto") : languageLabel(language)
}

/** The prompt that goes to the API. The chat keeps showing what the reader typed. */
export function promptWithLanguage(prompt: string, language: AssistantLanguage): string {
  const trimmed = prompt.trim()
  if (language === "auto" || !trimmed) return trimmed
  if (explicitResponseLanguage(trimmed)) return trimmed
  return `${trimmed} ${SUFFIX[language]}`
}
