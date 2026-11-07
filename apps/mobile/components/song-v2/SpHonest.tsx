import { StyleSheet, Text, View } from "react-native"

import { openExternal } from "@/lib/openLink"
import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"

import { useT } from "@/lib/i18n"
import { note as noteStyle } from "./spType"
import { SpPress } from "./SpUi"

/**
 * The honest empty state of a content section ("No chords for this song yet."): one short line, an
 * optional Request action (becomes "Requested" once asked) and an optional link that really exists.
 */
export function SpEmptyNote({
  t,
  text,
  requested,
  onRequest,
  requestLabel,
  link,
}: {
  t: SpTheme
  text: string
  /** undefined hides the action (nothing to ask for) */
  requested?: boolean
  onRequest?: () => void
  requestLabel?: string
  link?: { label: string; url: string } | null
}) {
  const tr = useT()
  const label = requestLabel ?? tr("sp.request")
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={[noteStyle(t), styles.text]}>{text}</Text>
        {onRequest ? (
          requested ? (
            <Text style={[styles.action, { color: t.ink500 }]}>{tr("sp.requested")}</Text>
          ) : (
            <SpPress onPress={onRequest} accessibilityLabel={`${label}: ${text}`} style={styles.btn}>
              <Text style={[styles.action, { color: t.orange700 }]}>{label}</Text>
            </SpPress>
          )
        ) : null}
      </View>
      {link ? (
        <SpPress onPress={() => void openExternal(link.url)} accessibilityLabel={link.label} accessibilityRole="link" style={styles.btn}>
          <Text style={[styles.action, { color: t.orange700 }]}>{link.label}</Text>
        </SpPress>
      ) : null}
    </View>
  )
}

/** Small tag on content that is sample material of the demo preview, never real. */
export function SpDemoTag({ t }: { t: SpTheme }) {
  const tr = useT()
  return (
    <View style={styles.tagRow}>
      <View style={[styles.tag, { borderColor: t.ink500 }]}>
        <Text style={[styles.tagText, { color: t.ink500 }]}>{tr("player.demo")}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, paddingVertical: 4, gap: 2 },
  row: { flexDirection: "row", alignItems: "center", columnGap: 12 },
  text: { flex: 1 },
  btn: { minHeight: 44, minWidth: 44, alignItems: "flex-start", justifyContent: "center" },
  action: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20 },
  tagRow: { paddingHorizontal: 20, paddingTop: 8, flexDirection: "row" },
  tag: { borderWidth: 1, borderRadius: 9999, paddingHorizontal: 10, paddingVertical: 3 },
  tagText: { fontFamily: amFonts.semi, fontSize: 12, lineHeight: 16, letterSpacing: 0.4 },
})
