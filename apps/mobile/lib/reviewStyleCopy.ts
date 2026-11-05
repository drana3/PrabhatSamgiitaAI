import type { ReviewStyle } from "@/lib/appearance"
import { t } from "@/lib/i18n"

/**
 * Copy of the three word-review rhythms (prototype `SRS`, Main.dc.html around line 3180). The texts are
 * dictionary strings (`reviewStyle.*`), read when asked, so they follow the interface language.
 */
export type ReviewStyleOption = {
  id: ReviewStyle
  name: string
  tag: string
  desc: string
  line: string
}

export const REVIEW_STYLE_OPTIONS: readonly ReviewStyleOption[] = [
  {
    id: "simple",
    get name() { return t("reviewStyle.simple") },
    get tag() { return t("reviewStyle.simple.tag") },
    get desc() { return t("reviewStyle.simple.desc") },
    get line() { return t("reviewStyle.simple.line") },
  },
  {
    id: "adaptive",
    get name() { return t("reviewStyle.adaptive") },
    get tag() { return t("reviewStyle.adaptive.tag") },
    get desc() { return t("reviewStyle.adaptive.desc") },
    get line() { return t("reviewStyle.adaptive.line") },
  },
  {
    id: "daily",
    get name() { return t("reviewStyle.daily") },
    get tag() { return t("reviewStyle.daily.tag") },
    get desc() { return t("reviewStyle.daily.desc") },
    get line() { return t("reviewStyle.daily.line") },
  },
]
