import { Radio, SheetGroup, SheetNote, SheetRow } from "@/components/player-v2/Rows"
import { Sheet } from "@/components/player-v2/Sheet"
import type { AmTheme } from "@/constants/tokens/amColors"
import type { SourceKey, SourceRow } from "@/lib/playerV2/sources"

type Props = {
  visible: boolean
  theme: AmTheme
  rows: SourceRow[]
  activeKey: SourceKey
  onPick: (key: SourceKey) => void
  onClose: () => void
}

/** "Play songs from" (prototype PLAY FROM): choose the list the player walks through. */
export function SourceSheet({ visible, theme, rows, activeKey, onPick, onClose }: Props) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Play songs from" theme={theme}>
      <SheetGroup theme={theme}>
        {rows.map((row, index) => (
          <SheetRow
            key={row.key}
            theme={theme}
            title={row.name}
            meta={row.meta}
            accessibilityRole="radio"
            selected={row.key === activeKey}
            last={index === rows.length - 1}
            trailing={<Radio theme={theme} on={row.key === activeKey} />}
            onPress={() => onPick(row.key)}
          />
        ))}
      </SheetGroup>
      <SheetNote theme={theme}>
        The player goes through this list, then repeats it if Repeat is on. Tap Repeat once for the whole list, twice for one song.
      </SheetNote>
    </Sheet>
  )
}
