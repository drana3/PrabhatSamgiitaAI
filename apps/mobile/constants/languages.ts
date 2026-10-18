export type LocaleOption = {
  code: string
  label: string
  nativeLabel: string
  group: "Indian languages" | "World languages"
}

/** Same labels as the website language switcher (API expects English labels). */
/** Aligned with the website language switcher (API expects English labels). */
export const localeOptions: LocaleOption[] = [
  { code: "en", label: "English", nativeLabel: "English", group: "World languages" },
  { code: "hi", label: "Hindi", nativeLabel: "हिन्दी", group: "Indian languages" },
  { code: "bn", label: "Bengali", nativeLabel: "বাংলা", group: "Indian languages" },
  { code: "ta", label: "Tamil", nativeLabel: "தமிழ்", group: "Indian languages" },
  { code: "ur", label: "Urdu", nativeLabel: "اردو", group: "Indian languages" },
  { code: "mai", label: "Maithili", nativeLabel: "मैथिली", group: "Indian languages" },
  { code: "mag", label: "Magahi", nativeLabel: "मगही", group: "Indian languages" },
  { code: "as", label: "Assamese", nativeLabel: "অসমীয়া", group: "Indian languages" },
  { code: "gu", label: "Gujarati", nativeLabel: "ગુજરાતી", group: "Indian languages" },
  { code: "kn", label: "Kannada", nativeLabel: "ಕನ್ನಡ", group: "Indian languages" },
  { code: "ml", label: "Malayalam", nativeLabel: "മലയാളം", group: "Indian languages" },
  { code: "mr", label: "Marathi", nativeLabel: "मराठी", group: "Indian languages" },
  { code: "ne", label: "Nepali", nativeLabel: "नेपाली", group: "Indian languages" },
  { code: "or", label: "Odia", nativeLabel: "ଓଡ଼ିଆ", group: "Indian languages" },
  { code: "pa", label: "Punjabi", nativeLabel: "ਪੰਜਾਬੀ", group: "Indian languages" },
  { code: "sa", label: "Sanskrit", nativeLabel: "संस्कृतम्", group: "Indian languages" },
  { code: "te", label: "Telugu", nativeLabel: "తెలుగు", group: "Indian languages" },
  { code: "ar", label: "Arabic", nativeLabel: "العربية", group: "World languages" },
  { code: "zh", label: "Chinese", nativeLabel: "中文", group: "World languages" },
  { code: "nl", label: "Dutch", nativeLabel: "Nederlands", group: "World languages" },
  { code: "fr", label: "French", nativeLabel: "Français", group: "World languages" },
  { code: "de", label: "German", nativeLabel: "Deutsch", group: "World languages" },
  { code: "id", label: "Indonesian", nativeLabel: "Bahasa Indonesia", group: "World languages" },
  { code: "it", label: "Italian", nativeLabel: "Italiano", group: "World languages" },
  { code: "ja", label: "Japanese", nativeLabel: "日本語", group: "World languages" },
  { code: "ko", label: "Korean", nativeLabel: "한국어", group: "World languages" },
  { code: "fa", label: "Persian", nativeLabel: "فارسی", group: "World languages" },
  { code: "pl", label: "Polish", nativeLabel: "Polski", group: "World languages" },
  { code: "pt", label: "Portuguese", nativeLabel: "Português", group: "World languages" },
  { code: "ru", label: "Russian", nativeLabel: "Русский", group: "World languages" },
  { code: "si", label: "Sinhala", nativeLabel: "සිංහල", group: "World languages" },
  { code: "es", label: "Spanish", nativeLabel: "Español", group: "World languages" },
  { code: "sw", label: "Swahili", nativeLabel: "Kiswahili", group: "World languages" },
  { code: "th", label: "Thai", nativeLabel: "ไทย", group: "World languages" },
  { code: "tr", label: "Turkish", nativeLabel: "Türkçe", group: "World languages" },
  { code: "vi", label: "Vietnamese", nativeLabel: "Tiếng Việt", group: "World languages" },
]

export const quickLocaleCodes = ["en", "hi", "bn", "ta", "fr", "es"] as const

export function localeNativeLabel(code: string) {
  return localeOptions.find((option) => option.code === code)?.nativeLabel ?? code
}

export function localeLabel(code: string) {
  return localeOptions.find((option) => option.code === code)?.label ?? code
}
