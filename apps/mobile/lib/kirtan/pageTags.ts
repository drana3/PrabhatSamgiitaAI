import { t } from "@/lib/i18n"
import { kindHasCycle } from "@/lib/recordingChords/kinds"

import { infoTags } from "./recordingInfo"
import { isAvarta } from "./practice"
import { kindHasInstrument } from "./instruments"
import { styleLabel } from "./styles"
import type { Kirtan } from "./types"

/**
 * The tag row under the title of a recording's page (docs/kiirtan-cycle.md "The page"): style, how it was recorded, the tempo,
 * solo or group, the lead instrument and the Avarta mark, in that order. Only what the recording states: nothing is guessed,
 * and a recording that says none of it has no row. `ai` marks the AI-made recording, which also gets its plain sentence.
 * The style is a Kiirtan's only. `infoTags` (lib/kirtan/recordingInfo.ts) already carries type, tempo, solo/group and instrument.
 */
export type PageTag = { id: string; label: string; tone: "plain" | "ai" | "practice" }

export function pageTags(k: Pick<Kirtan, "kind" | "style" | "styleOther" | "practice" | "recordingType" | "tempo" | "performance" | "leadInstrument" | "leadInstrumentOther">): PageTag[] {
  const out: PageTag[] = []
  const style = kindHasCycle(k.kind) ? styleLabel(k.style, k.styleOther) : ""
  if (style && k.style) out.push({ id: `style-${k.style}`, label: t("recTag.style", { style }), tone: "plain" })
  for (const tag of infoTags(k)) {
    if (tag.id.startsWith("instrument-") && !kindHasInstrument(k.kind)) continue
    out.push({ id: tag.id, label: tag.label, tone: tag.ai ? "ai" : "plain" })
  }
  if (isAvarta(k)) out.push({ id: "practice-avarta", label: t("practice.tag"), tone: "practice" })
  return out
}
