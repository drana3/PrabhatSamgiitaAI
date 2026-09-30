/** Catalog strings are often NFD (base + U+0301). NFC keeps accents in our latin-ext webfonts. */
export function normalizeTransliterationText(value: string) {
  if (!value) return value
  return value.normalize("NFC")
}

export function titleCaseTransliteration(value: string) {
  const normalized = normalizeTransliterationText(value)
  return normalized
    .toLocaleLowerCase()
    .replace(/(^|[\s''-])\p{L}/gu, (letter) => letter.toLocaleUpperCase())
}

export function formatLyricLineTransliteration(value: string) {
  const normalized = normalizeTransliterationText(value)
  if (normalized.includes("…") || normalized === normalized.toLocaleLowerCase()) {
    return titleCaseTransliteration(normalized)
  }
  return normalized
}
