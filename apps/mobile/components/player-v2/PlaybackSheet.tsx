
import { Chip, ChipRow, PillButton, SectionLabel } from "@/components/player-v2/Rows"
import { Sheet } from "@/components/player-v2/Sheet"
import type { AmTheme } from "@/constants/tokens/amColors"
import { SLEEP_PRESET_MINUTES, type SleepTimer } from "@/lib/playerV2/sleepTimer"
import { formatRate, SPEED_STEPS } from "@/lib/playerV2/playbackSpeed"

type Props = {
  visible: boolean
  theme: AmTheme
  rate: number
  sleep: SleepTimer
  /** Label of the running timer ("12:30", "End of song") or null when off. */
  sleepRunning: string | null
  onRate: (rate: number) => void
  onSleepMinutes: (minutes: number) => void
  onSleepEndOfSong: () => void
  onSleepOff: () => void
  onDrive: () => void
  onClose: () => void
}

/** The "more" sheet: speed, sleep timer and Drive (SCR-31). */
export function PlaybackSheet(props: Props) {
  const { theme, sleep } = props
  return (
    <Sheet visible={props.visible} onClose={props.onClose} title="Playback" theme={theme} heightShare={0.6}>
      <SectionLabel theme={theme}>Speed</SectionLabel>
      <ChipRow>
        {SPEED_STEPS.map((step) => (
          <Chip key={step} theme={theme} label={formatRate(step)} selected={props.rate === step} onPress={() => props.onRate(step)} />
        ))}
      </ChipRow>

      <SectionLabel theme={theme}>{props.sleepRunning ? `Sleep timer · ${props.sleepRunning}` : "Sleep timer"}</SectionLabel>
      <ChipRow>
        <Chip theme={theme} label="Off" selected={sleep.kind === "off"} onPress={props.onSleepOff} />
        {SLEEP_PRESET_MINUTES.map((m) => (
          <Chip
            key={m}
            theme={theme}
            label={`${m} min`}
            selected={sleep.kind === "minutes" && sleep.minutes === m}
            onPress={() => props.onSleepMinutes(m)}
          />
        ))}
        <Chip theme={theme} label="End of song" selected={sleep.kind === "endOfSong"} onPress={props.onSleepEndOfSong} />
      </ChipRow>

      <SectionLabel theme={theme}>Driving</SectionLabel>
      <PillButton theme={theme} label="Drive mode" tone="ink" onPress={props.onDrive} />
    </Sheet>
  )
}

