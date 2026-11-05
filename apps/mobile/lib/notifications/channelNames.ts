import type { Language } from "@/lib/i18n/core"

/**
 * Name of the Android notification channel as it shows in system settings. Kept out of the message
 * dictionaries because it is read outside React, when the channel is (re)created.
 */
const CHANNEL_NAMES: Record<Language, string> = {
  en: "Reminders",
  ru: "Напоминания",
  es: "Recordatorios",
}

export function remindersChannelName(language: Language): string {
  return CHANNEL_NAMES[language] ?? CHANNEL_NAMES.en
}
