import { Sheet } from "@/components/player-v2/Sheet"
import { SheetGroup, SheetRow } from "@/components/player-v2/Rows"
import type { AmTheme } from "@/constants/tokens/amColors"
import { formatRate } from "@/lib/playerV2/playbackSpeed"

type Props = {
  visible: boolean
  theme: AmTheme
  rate: number
  /** "Off", "15 min", "12:30" or "End of song". */
  sleepValue: string
  onCycleSpeed: () => void
  onCycleSleep: () => void
  onDrive: () => void
  onClose: () => void
}

/** The "more" sheet (prototype MORE): speed, sleep timer and Drive mode; the first two step through their options on each tap. */
export function PlaybackSheet(props: Props) {
  const { theme } = props
  return (
    <Sheet visible={props.visible} onClose={props.onClose} title="Playback" theme={theme}>
      <SheetGroup theme={theme}>
        <SheetRow
          theme={theme}
          title="Speed"
          meta="Tap to step from 0.5× to 1.5×"
          value={formatRate(props.rate).replace("x", "×")}
          onPress={props.onCycleSpeed}
        />
        <SheetRow
          theme={theme}
          title="Sleep timer"
          meta="Stops playback after a while"
          value={props.sleepValue}
          onPress={props.onCycleSleep}
        />
        <SheetRow
          theme={theme}
          title="Drive mode"
          meta="Big buttons, lyrics hidden, screen stays on"
          value="Start"
          onPress={props.onDrive}
          last
        />
      </SheetGroup>
    </Sheet>
  )
}
