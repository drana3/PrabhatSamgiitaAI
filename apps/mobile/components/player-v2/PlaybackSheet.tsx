import { Sheet } from "@/components/player-v2/Sheet"
import { SheetGroup, SheetRow } from "@/components/player-v2/Rows"
import type { AmTheme } from "@/constants/tokens/amColors"
import { formatRateSign } from "@/lib/playerV2/playbackSpeed"
import { useT } from "@/lib/i18n"

type Props = {
  visible: boolean
  theme: AmTheme
  rate: number
  /** "Off", "15 min", "12:30" or "End of song". */
  sleepValue: string
  onOpenSpeed: () => void
  onOpenSleep: () => void
  onDrive: () => void
  /** While the Radio runs: switch between the Radio view and the normal player view. */
  radio?: { radioView: boolean; onToggleView: () => void }
  onClose: () => void
}

/** The "more" sheet (prototype MORE): speed and sleep timer each open their own sheet, plus Drive mode and, in the Radio, the view switch. */
export function PlaybackSheet(props: Props) {
  const t = useT()
  const { theme } = props
  return (
    <Sheet visible={props.visible} onClose={props.onClose} title={t("player.act.playback")} theme={theme}>
      <SheetGroup theme={theme}>
        <SheetRow
          theme={theme}
          title={t("player.speed")}
          meta={t("playback.speed.meta")}
          value={formatRateSign(props.rate)}
          onPress={props.onOpenSpeed}
        />
        <SheetRow
          theme={theme}
          title={t("player.sleep.title")}
          meta={t("player.sleep.meta")}
          value={props.sleepValue}
          onPress={props.onOpenSleep}
        />
        {props.radio ? (
          <SheetRow
            last={props.radio.radioView}
            theme={theme}
            title={props.radio.radioView ? t("radio.player.normalView") : t("radio.player.radioView")}
            meta={props.radio.radioView ? t("radio.player.normalView.meta") : t("radio.player.radioView.meta")}
            onPress={props.radio.onToggleView}
          />
        ) : null}
        {/* the Radio view already has the big buttons: no second "Radio" row there */}
        {props.radio?.radioView ? null : (
          <SheetRow
            theme={theme}
            title={t("player.act.drive")}
            meta={t("player.act.driveMeta")}
            value={t("player.start")}
            onPress={props.onDrive}
            last
          />
        )}
      </SheetGroup>
    </Sheet>
  )
}
