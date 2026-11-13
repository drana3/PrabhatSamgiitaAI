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

/**
 * Names the system shows (Android channels and channel groups in system settings, the iOS lock-screen
 * placeholder). Out of the message dictionaries for the same reason as above: read outside React.
 * `reminders` is the channel the app has always had.
 */
const NAMES: Record<"reminders" | "festivals" | "team" | "notices" | "replies", Record<Language, string>> = {
  reminders: CHANNEL_NAMES,
  festivals: { en: "Festivals", ru: "Праздники", es: "Festividades" },
  team: { en: "From the team", ru: "От команды", es: "Del equipo" },
  notices: { en: "About your uploads", ru: "О ваших загрузках", es: "Sobre tus subidas" },
  replies: { en: "Replies to you", ru: "Ответы вам", es: "Respuestas para ti" },
}

const GROUP_NAMES: Record<"reminders" | "messages", Record<Language, string>> = {
  reminders: { en: "Reminders", ru: "Напоминания", es: "Recordatorios" },
  messages: { en: "Messages", ru: "Сообщения", es: "Mensajes" },
}

/** What the lock screen shows instead of the text when the person hides previews, for notices about their own content. */
const PRIVATE_PREVIEW: Record<Language, string> = {
  en: "You have a notice about your upload.",
  ru: "У вас уведомление о вашей загрузке.",
  es: "Tienes un aviso sobre tu subida.",
}

export function channelName(id: keyof typeof NAMES, language: Language): string {
  return NAMES[id][language] ?? NAMES[id].en
}

export function channelGroupName(id: keyof typeof GROUP_NAMES, language: Language): string {
  return GROUP_NAMES[id][language] ?? GROUP_NAMES[id].en
}

export function privatePreviewText(language: Language): string {
  return PRIVATE_PREVIEW[language] ?? PRIVATE_PREVIEW.en
}
