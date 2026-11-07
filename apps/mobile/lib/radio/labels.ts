import { t } from "@/lib/i18n"
import { historyKindLabel } from "@/lib/listening/labels"
import { summaryLine, type RadioCategory, type RadioCounts } from "@/lib/radio/categories"

/** The visible name of a category: the app's own kind names (Kiirtan, Bhajan, Spiritual song, Baba's Audio Discourses ...). */
export function categoryName(category: RadioCategory): string {
  return historyKindLabel(category)
}

function listText(selected: readonly RadioCategory[], counts: RadioCounts): { all: boolean; text: string } {
  const line = summaryLine(selected, counts)
  if (line.type === "all") return { all: true, text: "" }
  const names = line.shown.map(categoryName).join(", ")
  return { all: false, text: line.more > 0 ? t("radio.summary.more", { list: names, count: line.more }) : names }
}

/** "Playing: Kiirtan, Bhajan" / "Playing all categories": the line under the chips on the Radio screen. */
export function summaryText(selected: readonly RadioCategory[], counts: RadioCounts): string {
  const { all, text } = listText(selected, counts)
  return all ? t("radio.summary.all") : t("radio.summary.list", { list: text })
}

/** "Radio · Kiirtan, Bhajan": the second line of the mini-player while the Radio runs. */
export function miniRadioLine(selected: readonly RadioCategory[], counts: RadioCounts): string {
  const { all, text } = listText(selected, counts)
  return all ? t("radio.mini.all") : t("radio.mini.list", { list: text })
}
