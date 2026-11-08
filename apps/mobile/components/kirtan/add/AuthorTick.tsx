import { StyleSheet, Text, View } from "react-native"

import { KPress } from "@/components/kirtan/KPress"
import { PlayerIcon } from "@/components/player-v2/PlayerIcons"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amColors } from "@/constants/tokens/amColors"
import { amFonts } from "@/constants/tokens/amTypography"
import { useT } from "@/lib/i18n"
import { kindHasByAuthor } from "@/lib/kirtan/recordingInfo"

/**
 * "I am the author of this recording": the tick that sits with the performer's name. One line of plain words under it says
 * what it does (the recording appears on the person's author page). Not shown for Prabhat Samgiita (one author) or
 * Baba's Audio Discourses. Holds no state. Rules: lib/kirtan/recordingInfo.ts `kindHasByAuthor`.
 */
export function AuthorTick({ theme, kind, on, onChange, disabled }: { theme: SongsTheme; kind: string; on: boolean; onChange: (next: boolean) => void; disabled?: boolean }) {
  const t = useT()
  if (!kindHasByAuthor(kind)) return null
  return (
    <View style={s.root}>
      <KPress
        accessibilityRole="checkbox"
        accessibilityState={{ checked: on, disabled: !!disabled }}
        accessibilityLabel={t("ugc.add.byAuthor")}
        disabled={disabled}
        onActivate={() => onChange(!on)}
        pressedScale={0.99}
        style={s.check}
      >
        <View style={[s.box, { borderColor: on ? amColors.orange700 : theme.textBody, backgroundColor: on ? amColors.orange700 : "transparent" }]}>{on ? <PlayerIcon name="check" size={16} color="#FFFFFF" strokeWidth={2.5} /> : null}</View>
        <Text style={[s.checkText, { color: theme.textHeading }]}>{t("ugc.add.byAuthor")}</Text>
      </KPress>
      <Text style={[s.hint, { color: theme.textBody }]}>{t("ugc.add.byAuthorHint")}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  root: { gap: 8 },
  check: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 4 },
  box: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, alignItems: "center", justifyContent: "center", marginTop: 1 },
  checkText: { flex: 1, fontFamily: amFonts.medium, fontSize: 15, lineHeight: 21 },
  hint: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
})
