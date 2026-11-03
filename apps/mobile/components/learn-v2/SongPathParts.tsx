import type { ReactNode } from "react"
import { StyleSheet, Text, View } from "react-native"
import { Check } from "lucide-react-native"

import { PressBox } from "@/components/learn-v2/PressBox"
import { amColors, type AmTheme } from "@/constants/tokens/amColors"
import { amGap, amRadius } from "@/constants/tokens/amSpacing"
import { amFonts, amType } from "@/constants/tokens/amTypography"
import type { StepStatus } from "@/lib/learn/songPath"

type Props = {
  theme: AmTheme
  step: 1 | 2 | 3
  title: string
  text: string
  status: StepStatus
  /** a line about progress inside the step ("Listened. Word cards are left.") */
  note?: string
  /** shown when the step is locked: what unlocks it */
  lockedNote?: string
  children?: ReactNode
}

/**
 * One step card of the song path (spec SCR-21).
 * done: forest card with a check. current: orange outline. open: plain card (skipped ahead).
 * locked: faded, no buttons.
 */
export function StepCard({ theme, step, title, text, status, note, lockedNote, children }: Props) {
  const done = status === "done"
  const locked = status === "locked"
  const current = status === "current"

  const background = done ? amColors.sage700 : locked ? theme.inner : theme.card
  const border = done ? amColors.sage700 : current ? theme.brand : theme.line
  const heading = done ? amColors.white : theme.textHeading
  const body = done ? amColors.sage300 : theme.textBody

  return (
    <View
      accessible={locked}
      accessibilityLabel={locked ? `Step ${step}, ${title}. Locked. ${lockedNote ?? ""}` : undefined}
      style={[
        styles.card,
        { backgroundColor: background, borderColor: border, borderWidth: current ? 2 : 1, opacity: locked ? 0.6 : 1 },
      ]}
    >
      <View style={styles.top}>
        <View
          style={[
            styles.badge,
            { backgroundColor: done ? amColors.white : current ? theme.brand : theme.line },
          ]}
        >
          {done ? (
            <Check size={18} color={amColors.sage700} />
          ) : (
            <Text style={[styles.badgeText, { color: current ? amColors.white : theme.textHeading }]}>{step}</Text>
          )}
        </View>
        <View style={styles.topText}>
          <Text style={[amType.lead, { color: heading, fontFamily: amFonts.bold }]}>{title}</Text>
          <Text style={[amType.body, { color: body }]}>{text}</Text>
        </View>
      </View>
      {note && !locked ? <Text style={[styles.note, { color: done ? amColors.gold300 : theme.eyebrow }]}>{note}</Text> : null}
      {locked ? <Text style={[amType.label, { color: theme.textBody }]}>{lockedNote ?? "Finish the step before this one."}</Text> : null}
      {!locked && children ? <View style={styles.actions}>{children}</View> : null}
    </View>
  )
}

/** Small text button, 44px tall touch area. */
export function TextAction({ theme, label, onPress }: { theme: AmTheme; label: string; onPress: () => void }) {
  return (
    <PressBox
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      pressedScale={0.97}
      style={styles.textAction}
    >
      <Text style={[styles.textActionLabel, { color: theme.eyebrow }]}>{label}</Text>
    </PressBox>
  )
}

const styles = StyleSheet.create({
  card: { borderRadius: amRadius.panel, padding: amGap.padCard, gap: amGap.text },
  top: { flexDirection: "row", gap: amGap.block },
  topText: { flex: 1, gap: 4 },
  badge: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  badgeText: { fontFamily: amFonts.bold, fontSize: 16, lineHeight: 20 },
  note: { fontFamily: amFonts.semi, fontSize: 14, lineHeight: 19 },
  actions: { gap: amGap.grid },
  textAction: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
  textActionLabel: { fontFamily: amFonts.bold, fontSize: 15, lineHeight: 20, textDecorationLine: "underline" },
})
