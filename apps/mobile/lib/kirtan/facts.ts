import { kindHasDance, kindHasDiscourse, kindHasLanguage, kindLabel } from "@/lib/kirtan/kind"
import { languageLabel } from "@/lib/kirtan/languages"
import type { Kirtan } from "@/lib/kirtan/types"

/** The facts line of the recording page: the kind, the language, the year, and for the kinds that have them the dance, the place and the discourse. */
export function recordingFacts(k: Kirtan, t: (key: string, vars?: Record<string, string | number>) => string): string[] {
  const facts = [kindLabel(k.kind)]
  if (kindHasLanguage(k.kind) && k.language) facts.push(languageLabel(k.language, k.languageOther))
  if (k.year) facts.push(String(k.year))
  if (kindHasDance(k.kind) && k.dance) facts.push(t("rec.fact.dance", { dance: t(`rec.dance.${k.dance}`) }))
  if (kindHasDiscourse(k.kind)) {
    if (k.place) facts.push(t("rec.fact.place", { place: k.place }))
    if (k.discourse) facts.push(t("rec.fact.discourse", { discourse: k.discourse }))
  }
  return facts
}
