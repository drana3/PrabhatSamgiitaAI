import { useState } from "react"
import { StyleSheet, Text, View } from "react-native"

import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import { usePageT } from "@/lib/songPage/pageCopy"

import { SpIcon } from "./SpIcon"
import { note, over } from "./spType"
import { SpPress } from "./SpUi"

/** The one line under a page title that says what the page is for. */
export function SpPurpose({ t, text }: { t: SpTheme; text: string }) {
  return <Text style={[styles.purpose, { color: t.ink800 }]}>{text}</Text>
}

/**
 * "How it works": a quiet row that opens two or three numbered steps. Open on arrival, because a first-time
 * visitor should not have to find it; one tap folds it away. No animation of its own (the height just changes).
 */
export function SpHowTo({ t, steps, defaultOpen = true }: { t: SpTheme; steps: string[]; defaultOpen?: boolean }) {
  const tr = usePageT()
  const [open, setOpen] = useState(defaultOpen)
  return (
    <View style={[styles.how, { backgroundColor: t.sand100, borderColor: t.sand300 }]}>
      <SpPress
        onPress={() => setOpen((v) => !v)}
        accessibilityLabel={tr(open ? "hmGuide.how.hide" : "hmGuide.how.show")}
        accessibilityState={{ selected: open }}
        pressedScale={0.99}
        style={styles.howHead}
      >
        <Text style={[over(t), { flex: 1 }]}>{tr("hmGuide.how")}</Text>
        <SpIcon name={open ? "chevDown" : "chevRight"} size={20} color={t.ink500} />
      </SpPress>
      {open ? (
        <View style={styles.steps}>
          {steps.map((text, index) => (
            <View key={text} style={styles.step}>
              <Text style={[styles.num, { color: t.orange700 }]}>{index + 1}</Text>
              <Text style={[styles.stepText, { color: t.ink800 }]}>{text}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  )
}

/** A small caps label with one sentence under it: what the block below is for. */
export function SpBlockLabel({ t, title, text }: { t: SpTheme; title?: string; text: string }) {
  return (
    <View style={styles.label}>
      {title ? <Text style={over(t)}>{title}</Text> : null}
      <Text style={note(t)}>{text}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  purpose: { fontFamily: amFonts.medium, fontSize: 16, lineHeight: 23, paddingHorizontal: 10 },
  how: { borderRadius: 20, borderWidth: 1, overflow: "hidden" },
  howHead: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16 },
  steps: { gap: 10, paddingHorizontal: 16, paddingBottom: 16 },
  step: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  num: { width: 20, fontFamily: amFonts.display, fontSize: 20, lineHeight: 22 },
  stepText: { flex: 1, fontFamily: amFonts.medium, fontSize: 15, lineHeight: 22 },
  label: { gap: 2, paddingHorizontal: 10 },
})
