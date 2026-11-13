import { t } from "@/lib/i18n"

import { infoTags } from "./recordingInfo"
import { isAvarta } from "./practice"
import { kindHasInstrument } from "./instruments"
import { moodLabel } from "./moods"
import { kindHasStyle, styleLabel, stylesOfRecord } from "./styles"
import { isMantraType, OTHER_MANTRA } from "./mantra"
import { kirtanTypeLabel, type Kirtan } from "./types"

/**
 * The tag row under the title of a recording's page (docs/kiirtan-cycle.md "The page"): style, how it was recorded, the tempo,
 * solo or group, the lead instrument and the Avarta mark, in that order. Only what the recording states: nothing is guessed,
 * and a recording that says none of it has no row. `ai` marks the AI-made recording, which also gets its plain sentence.
 * For Others the first tag is what it is (docs/others-category.md). The style is a Kiirtan's only. `infoTags` (lib/kirtan/recordingInfo.ts) already carries type, tempo, solo/group and instrument.
 */
export type PageTag = { id: string; label: string; tone: "plain" | "ai" | "practice" }

export function pageTags(k: Pick<Kirtan, "kind" | "type" | "typeOther" | "style" | "styleOther" | "styles" | "stylesOther" | "moods" | "moodsOther" | "practice" | "recordingType" | "tempo" | "performance" | "leadInstrument" | "leadInstrumentOther">): PageTag[] {
  const out: PageTag[] = []
  // Others: what it is comes first (Guru Puja, Shlokas ...); under "Something else" the name the author wrote, which strangers get once the team accepted it
  if (k.kind === "other_mantra" && isMantraType(k.type)) {
    if (k.type !== OTHER_MANTRA) out.push({ id: `mantra-${k.type}`, label: kirtanTypeLabel(k.type, "other_mantra"), tone: "plain" })
    else if (k.typeOther?.trim()) out.push({ id: "mantra-other", label: k.typeOther.trim(), tone: "plain" })
  }
  // every style it carries, then every mood: the lists, or the one old `style` as a list of one
  if (kindHasStyle(k.kind)) {
    const carried = stylesOfRecord(k)
    for (const id of carried.styles) out.push({ id: `style-${id}`, label: t("recTag.style", { style: styleLabel(id) }), tone: "plain" })
    for (const word of carried.stylesOther) out.push({ id: `style-own-${word}`, label: t("recTag.style", { style: word }), tone: "plain" })
    for (const id of k.moods ?? []) out.push({ id: `mood-${id}`, label: moodLabel(id), tone: "plain" })
    for (const word of k.moodsOther ?? []) out.push({ id: `mood-own-${word}`, label: word, tone: "plain" })
  }
  for (const tag of infoTags(k)) {
    if (tag.id.startsWith("instrument-") && !kindHasInstrument(k.kind)) continue
    out.push({ id: tag.id, label: tag.label, tone: tag.ai ? "ai" : "plain" })
  }
  if (isAvarta(k)) out.push({ id: "practice-avarta", label: t("practice.tag"), tone: "practice" })
  return out
}
