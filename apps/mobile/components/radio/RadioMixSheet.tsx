import { Sheet } from "@/components/player-v2/Sheet"
import { CheckRing, SheetGroup, SheetNote, SheetRow } from "@/components/player-v2/Rows"
import type { AmTheme } from "@/constants/tokens/amColors"
import { useRadioPools } from "@/hooks/useRadioPools"
import { formatNumber, useT } from "@/lib/i18n"
import { RADIO_CATEGORIES } from "@/lib/radio/categories"
import { categoryName } from "@/lib/radio/labels"
import { useRadioSelectionStore } from "@/stores/radioSelectionStore"

type Props = { visible: boolean; theme: AmTheme; onClose: () => void }

/**
 * "Mix several categories": the multi-select the old Radio screen had, as a sheet. A tick on each category to include; the
 * last tick stays, an empty category cannot be ticked (lib/radio/categories.ts). The change starts with the next track.
 */
export function RadioMixSheet({ visible, theme, onClose }: Props) {
  const t = useT()
  const { counts, chosen } = useRadioPools()
  const toggle = useRadioSelectionStore((s) => s.toggle)
  const rows = RADIO_CATEGORIES.filter((c) => counts[c] > 0)
  return (
    <Sheet visible={visible} onClose={onClose} title={t("radio.player.mix.title")} theme={theme}>
      <SheetGroup theme={theme}>
        {rows.map((id, index) => {
          const on = chosen.includes(id)
          return (
            <SheetRow
              key={id}
              theme={theme}
              title={categoryName(id)}
              value={formatNumber(counts[id])}
              accessibilityRole="checkbox"
              selected={on}
              trailing={<CheckRing theme={theme} on={on} />}
              onPress={() => void toggle(id, counts)}
              last={index === rows.length - 1}
            />
          )
        })}
      </SheetGroup>
      <SheetNote theme={theme}>{t("radio.player.mix.sub")}</SheetNote>
    </Sheet>
  )
}
