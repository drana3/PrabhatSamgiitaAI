import type { ReactNode } from "react"
import { StyleSheet, Text, View } from "react-native"
import { ListMusic, Play, Shuffle, Sun } from "lucide-react-native"

import { TouchButton } from "@/components/player-v2/TouchButton"
import { playerColors } from "@/components/player-v2/playerTokens"
import { amRadius, amSpace, amTouchTarget } from "@/constants/tokens/amSpacing"
import { amFontSize, amFonts, amType } from "@/constants/tokens/amTypography"
import { formatClock } from "@/lib/playerV2/transportState"

export type EmptyAction = { id: string; title: string; hint?: string; onPress: () => void; disabled?: boolean }

type Props = {
  title: string
  /** Continue card: the last song, with where it stopped. */
  continueCard: (EmptyAction & { resumeSeconds: number | null }) | null
  today: EmptyAction
  random: EmptyAction
  playlists: EmptyAction[]
}

/**
 * Nothing is loaded (SCR-12 item 9): Continue, Play today's song, Play
 * random, and the last playlists. Rows are large and answer on touch-down.
 */
export function EmptyPlayer({ title, continueCard, today, random, playlists }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {continueCard ? (
        <TouchButton
          accessibilityRole="button"
          accessibilityLabel={`Continue: ${continueCard.title}`}
          onAction={continueCard.onPress}
          containerStyle={styles.hit}
          style={[styles.card, styles.continue]}
        >
          <View style={styles.disc}>
            <Play size={22} color={playerColors.onBrand} fill={playerColors.onBrand} />
          </View>
          <View style={styles.text}>
            <Text style={styles.eyebrow}>Continue</Text>
            <Text style={styles.rowTitle} numberOfLines={2}>
              {continueCard.title}
            </Text>
            {continueCard.resumeSeconds != null ? (
              <Text style={styles.hint}>From {formatClock(continueCard.resumeSeconds)}</Text>
            ) : null}
          </View>
        </TouchButton>
      ) : null}

      <ActionRow action={today} icon={<Sun size={20} color={playerColors.gold} />} />
      <ActionRow action={random} icon={<Shuffle size={20} color={playerColors.gold} />} />

      {playlists.length ? (
        <View style={styles.playlists}>
          <Text style={styles.eyebrow}>Your playlists</Text>
          {playlists.map((p) => (
            <ActionRow key={p.id} action={p} icon={<ListMusic size={20} color={playerColors.gold} />} />
          ))}
        </View>
      ) : null}
    </View>
  )
}

function ActionRow({ action, icon }: { action: EmptyAction; icon: ReactNode }) {
  return (
    <TouchButton
      accessibilityRole="button"
      accessibilityLabel={action.title}
      accessibilityState={{ disabled: Boolean(action.disabled) }}
      onAction={action.disabled ? undefined : action.onPress}
      containerStyle={styles.hit}
      style={[styles.card, action.disabled && styles.disabled]}
    >
      {icon}
      <View style={styles.text}>
        <Text style={styles.rowTitle}>{action.title}</Text>
        {action.hint ? <Text style={styles.hint}>{action.hint}</Text> : null}
      </View>
    </TouchButton>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: amSpace.s3, paddingTop: amSpace.s6 },
  title: { ...amType.title, color: playerColors.text, marginBottom: amSpace.s3 },
  hit: { alignSelf: "stretch" },
  card: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: amSpace.s4,
    paddingHorizontal: amSpace.s4,
    paddingVertical: amSpace.s3,
    borderRadius: amRadius.card,
    backgroundColor: playerColors.glass,
    borderWidth: 1,
    borderColor: playerColors.glassEdge,
  },
  continue: { minHeight: 96 },
  disc: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: playerColors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { flex: 1, gap: amSpace.s1, minHeight: amTouchTarget - amSpace.s4, justifyContent: "center" },
  eyebrow: { ...amType.label, color: playerColors.gold },
  rowTitle: { ...amType.body, fontFamily: amFonts.semi, color: playerColors.text },
  hint: { ...amType.body, fontSize: amFontSize.label, lineHeight: 18, color: playerColors.textSoft },
  playlists: { gap: amSpace.s3, paddingTop: amSpace.s4 },
  disabled: { opacity: 0.45 },
})
