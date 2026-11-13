import { StyleSheet, Text, View } from "react-native"

import { TICK_BOX, TICK_GAP } from "@/components/kirtan/add/AuthorTick"
import { KPress } from "@/components/kirtan/KPress"
import { PlayerIcon } from "@/components/player-v2/PlayerIcons"
import { amColors } from "@/constants/tokens/amColors"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { useUx } from "@/lib/kirtan/useUx"
import { kindHasPerformer } from "@/lib/kirtan/kind"
import { showsWroteTick } from "@/lib/kirtan/uploadChords"

/**
 * The two roles of the person who uploads, two ticks that do not depend on each other (Dada, 13 Nov 2026):
 *  - "I wrote this (words or melody)": the API's `by_author`; not for Prabhat Samgiita, Baba's Audio or Others;
 *  - "I perform or play on this recording": kept on the form (the API has no field for it yet); fills in the person's own name as the
 *    performer when that line is empty.
 * One line under both says the truth about the page: the author page lists every recording the person uploaded, whichever tick is on.
 * Holds no state. The rules: lib/kirtan/uploadChords.ts.
 */
export function RoleTicks({ theme, kind, wrote, performs, onWrote, onPerforms, disabled }: { theme: SongsTheme; kind: string; wrote: boolean; performs: boolean; onWrote: (next: boolean) => void; onPerforms: (next: boolean) => void; disabled?: boolean }) {
  const ux = useUx()
  const showWrote = showsWroteTick(kind)
  const showPerforms = kindHasPerformer(kind as never)
  if (!showWrote && !showPerforms) return null
  return (
    <View style={s.root} testID="role-ticks">
      {showWrote ? <Tick theme={theme} on={wrote} label={ux("ux.role.wrote")} hint={ux("ux.role.wroteHint")} onChange={onWrote} disabled={disabled} testID="role-wrote" /> : null}
      {showPerforms ? <Tick theme={theme} on={performs} label={ux("ux.role.performs")} hint={ux("ux.role.performsHint")} onChange={onPerforms} disabled={disabled} testID="role-performs" /> : null}
      <Text style={[s.hint, { color: theme.textBody }]}>{ux("ux.role.page")}</Text>
    </View>
  )
}

function Tick({ theme, on, label, hint, onChange, disabled, testID }: { theme: SongsTheme; on: boolean; label: string; hint: string; onChange: (next: boolean) => void; disabled?: boolean; testID: string }) {
  return (
    <View style={s.one}>
      <KPress accessibilityRole="checkbox" accessibilityState={{ checked: on, disabled: !!disabled }} accessibilityLabel={label} disabled={disabled} onActivate={() => onChange(!on)} pressedScale={0.99} style={s.check} testID={testID}>
        <View style={[s.box, { borderColor: on ? amColors.orange700 : theme.textBody, backgroundColor: on ? amColors.orange700 : "transparent" }]}>{on ? <PlayerIcon name="check" size={16} color="#FFFFFF" strokeWidth={2.5} /> : null}</View>
        <Text style={[s.checkText, { color: theme.textHeading }]}>{label}</Text>
      </KPress>
      <Text style={[s.hint, s.indent, { color: theme.textBody }]}>{hint}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  root: { gap: 8 },
  one: { gap: 4 },
  check: { flexDirection: "row", alignItems: "flex-start", gap: TICK_GAP, minHeight: 40, paddingVertical: 8 },
  box: { width: TICK_BOX, height: TICK_BOX, borderRadius: 8, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  checkText: { flex: 1, fontFamily: amFonts.medium, fontSize: 15, lineHeight: 24 },
  hint: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  indent: { paddingLeft: TICK_BOX + TICK_GAP },
})
