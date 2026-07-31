export type LocaleOption = {
  code: string
  label: string
  nativeLabel: string
}

export const localeOptions: LocaleOption[] = [
  { code: "en", label: "English", nativeLabel: "English" },
  { code: "hi", label: "Hindi", nativeLabel: "हिन्दी" },
  { code: "bn", label: "Bengali", nativeLabel: "বাংলা" },
  { code: "ta", label: "Tamil", nativeLabel: "தமிழ்" },
  { code: "ur", label: "Urdu", nativeLabel: "اردو" },
  { code: "mai", label: "Maithili", nativeLabel: "मैथिली" },
  { code: "mag", label: "Magahi", nativeLabel: "मगही" },
]

export function localeLabel(code: string) {
  return localeOptions.find((option) => option.code === code)?.label ?? code
}
