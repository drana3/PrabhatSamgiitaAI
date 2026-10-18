export type IngestionMeaningPreview = {
  existing_meanings: Record<string, string>
}

export function canTranslateMeaningFromEnglish(
  preview: IngestionMeaningPreview | null,
  targetLanguage: string,
): boolean {
  if (!preview || targetLanguage === "en") return false
  const english = preview.existing_meanings.en?.trim()
  const target = preview.existing_meanings[targetLanguage]?.trim()
  return Boolean(english) && !target
}

export function needsEnglishMeaningFirst(
  preview: IngestionMeaningPreview | null,
  targetLanguage: string,
): boolean {
  if (!preview || targetLanguage === "en") return false
  return !preview.existing_meanings.en?.trim()
}
