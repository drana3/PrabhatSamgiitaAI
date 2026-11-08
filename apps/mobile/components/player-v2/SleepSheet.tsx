import { Text } from "react-native"

import { Sheet } from "@/components/player-v2/Sheet"
import { Radio, SheetGroup, SheetNote, SheetRow } from "@/components/player-v2/Rows"
import type { AmTheme } from "@/constants/tokens/amColors"
import { amFonts } from "@/constants/tokens/amTypography"
import { SLEEP_PRESET_MINUTES, formatSleepRemaining, sleepRemainingMs, type SleepTimer } from "@/lib/playerV2/sleepTimer"
import { useT } from "@/lib/i18n"

type Props = {
  visible: boolean
  theme: AmTheme
  timer: SleepTimer
  now: number
  /** the end-of-list row is offered only when more than one track is queued */
  canEndOfList: boolean
  /** the track the end-of-track timer would wait for is the one that plays */
  onMinutes: (minutes: number) => void
  onEndOfTrack: () => void
  onEndOfList: () => void
  onCancel: () => void
  onClose: () => void
}

/**
 * Sleep timer: 5, 10, 15, 30, 45 or 60 minutes, the end of this track, the end of the playlist; Cancel while one
 * runs. A minutes timer shows its countdown. The fade and the stop run in the player services (lib/playerV2/services.ts),
 * so it keeps working with the screen off.
 */
export function SleepSheet(props: Props) {
  const t = useT()
  const { theme, timer } = props
  const left = sleepRemainingMs(timer, props.now)
  const minutesOn = (m: number) => timer.kind === "minutes" && timer.minutes === m
  return (
    <Sheet visible={props.visible} onClose={props.onClose} title={t("playback.sleep.title")} theme={theme}>
      {left != null ? (
        <Text style={{ color: theme.eyebrow, fontFamily: amFonts.bold, fontSize: 15, paddingHorizontal: 24, paddingBottom: 10 }} accessibilityLiveRegion="polite">
          {t("playback.sleep.left", { time: formatSleepRemaining(left) })}
        </Text>
      ) : null}
      <SheetGroup theme={theme}>
        {SLEEP_PRESET_MINUTES.map((m) => (
          <SheetRow
            key={m}
            theme={theme}
            title={t("playback.sleep.min", { minutes: m })}
            accessibilityRole="radio"
            selected={minutesOn(m)}
            trailing={<Radio theme={theme} on={minutesOn(m)} />}
            onPress={() => props.onMinutes(m)}
          />
        ))}
        <SheetRow
          theme={theme}
          title={t("playback.sleep.endTrack")}
          accessibilityRole="radio"
          selected={timer.kind === "endOfSong"}
          trailing={<Radio theme={theme} on={timer.kind === "endOfSong"} />}
          onPress={props.onEndOfTrack}
          last={!props.canEndOfList && timer.kind === "off"}
        />
        {props.canEndOfList ? (
          <SheetRow
            theme={theme}
            title={t("playback.sleep.endList")}
            accessibilityRole="radio"
            selected={timer.kind === "endOfList"}
            trailing={<Radio theme={theme} on={timer.kind === "endOfList"} />}
            onPress={props.onEndOfList}
            last={timer.kind === "off"}
          />
        ) : null}
        {timer.kind !== "off" ? <SheetRow theme={theme} title={t("playback.sleep.off")} onPress={props.onCancel} last /> : null}
      </SheetGroup>
      <SheetNote theme={theme}>{t("playback.sleep.note")}</SheetNote>
    </Sheet>
  )
}
