import { Sheet } from "@/components/player-v2/Sheet"
import { SheetGroup, SheetRow } from "@/components/player-v2/Rows"
import type { AmTheme } from "@/constants/tokens/amColors"
import { clampRate } from "@/lib/playerV2/playbackSpeed"
import { useT } from "@/lib/i18n"

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
  const t = useT()
  const { theme } = props
  return (
    <Sheet visible={props.visible} onClose={props.onClose} title={t("player.act.playback")} theme={theme}>
      <SheetGroup theme={theme}>
        <SheetRow
          theme={theme}
          title={t("player.speed")}
          meta={t("player.speed.meta")}
          value={`${clampRate(props.rate).toFixed(2).replace(/0$/, "")}×`}
          onPress={props.onCycleSpeed}
        />
        <SheetRow
          theme={theme}
          title={t("player.sleep.title")}
          meta={t("player.sleep.meta")}
          value={props.sleepValue}
          onPress={props.onCycleSleep}
        />
        <SheetRow
          theme={theme}
          title={t("player.act.drive")}
          meta={t("player.act.driveMeta")}
          value={t("player.start")}
          onPress={props.onDrive}
          last
        />
      </SheetGroup>
    </Sheet>
  )
}
