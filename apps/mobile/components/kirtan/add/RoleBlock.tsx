import { StyleSheet, Text, TextInput, View } from "react-native"

import { FieldError, RequiredMark } from "@/components/kirtan/add/KindFields"
import { TICK_BOX, TICK_GAP } from "@/components/kirtan/add/AuthorTick"
import { KPress } from "@/components/kirtan/KPress"
import { amColors } from "@/constants/tokens/amColors"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { controlBorder } from "@/lib/controlColors"
import { useUx } from "@/lib/kirtan/useUx"
import { effectiveRole, roleAuto, roleChoices, ROLE_COMMENT_MAX, type UploadRole } from "@/lib/kirtan/uploadRole"

/**
 * "Who are you for this recording?" (Dada, 13 Nov 2026): a REQUIRED one-of-four answer for every kind, and under it a comment that is
 * saved in the existing credits field (300 characters). The answer drives `by_author` (and the performer line); the rules are in
 * lib/kirtan/uploadRole.ts. A kind that offers only one answer (Baba's Audio: "sharing") shows no question, only the comment.
 * Holds no state: the form owns the draft and the error.
 */
export function RoleBlock({ theme, kind, role, comment, onRole, onComment, error, disabled }: { theme: SongsTheme; kind: string; role: UploadRole | null | undefined; comment: string; onRole: (next: UploadRole) => void; onComment: (text: string) => void; error?: string | null; disabled?: boolean }) {
  const ux = useUx()
  const choices = roleChoices(kind)
  const auto = roleAuto(kind)
  const chosen = effectiveRole(kind, role)
  const placeholder = chosen === "sharing" ? ux("ux.who.placeholderSharing") : ux("ux.who.placeholder")
  return (
    <View style={s.root} testID="who-block">
      {auto ? (
        <Text style={[s.hint, { color: theme.textBody }]} testID="who-auto">{ux("ux.who.auto")}</Text>
      ) : (
        <View style={s.group} accessibilityRole={"radiogroup" as never}>
          <View style={s.head}>
            <Text style={[s.label, { color: theme.textHeading }]}>{ux("ux.who.title")}</Text>
            <RequiredMark theme={theme} required invalid={!!error} />
          </View>
          {choices.map((choice) => {
            const on = chosen === choice
            return (
              <View key={choice} style={s.one}>
                <KPress accessibilityRole="radio" accessibilityState={{ checked: on, disabled: !!disabled }} accessibilityLabel={ux(`ux.who.${choice}`)} disabled={disabled} onActivate={() => onRole(choice)} pressedScale={0.99} style={s.row} testID={`who-${choice}`}>
                  <View style={[s.radio, { borderColor: on ? amColors.orange700 : error ? amColors.danger : theme.textBody }]}>{on ? <View style={s.dot} /> : null}</View>
                  <Text style={[s.rowText, { color: theme.textHeading }]}>{ux(`ux.who.${choice}`)}</Text>
                </KPress>
                {on ? <Text style={[s.hint, s.indent, { color: theme.textBody }]}>{ux(`ux.who.${choice}Hint`)}</Text> : null}
              </View>
            )
          })}
          {error ? <FieldError theme={theme} text={error} /> : null}
        </View>
      )}
      <View style={s.group}>
        <Text style={[s.label, { color: theme.textHeading }]}>{ux("ux.who.comment")}</Text>
        <View style={[s.box, { backgroundColor: theme.card, borderColor: controlBorder(theme) }]}>
          <TextInput
            value={comment}
            onChangeText={(text) => onComment(text.slice(0, ROLE_COMMENT_MAX))}
            editable={!disabled}
            placeholder={placeholder}
            placeholderTextColor={theme.textMuted}
            accessibilityLabel={ux("ux.who.comment")}
            maxLength={ROLE_COMMENT_MAX}
            multiline
            style={[s.input, { color: theme.textHeading }]}
            testID="who-comment"
          />
        </View>
        <Text style={[s.hint, s.right, { color: theme.textBody }]} testID="who-count">{ux("ux.who.count", { count: comment.length, max: ROLE_COMMENT_MAX })}</Text>
      </View>
      {auto ? null : <Text style={[s.hint, { color: theme.textBody }]}>{ux("ux.who.page")}</Text>}
    </View>
  )
}

const s = StyleSheet.create({
  root: { gap: 16 },
  group: { gap: 8 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  label: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20 },
  one: { gap: 4 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: TICK_GAP, minHeight: 40, paddingVertical: 8 },
  radio: { width: TICK_BOX, height: TICK_BOX, borderRadius: TICK_BOX / 2, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: amColors.orange700 },
  rowText: { flex: 1, fontFamily: amFonts.medium, fontSize: 15, lineHeight: 24 },
  hint: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  indent: { paddingLeft: TICK_BOX + TICK_GAP },
  right: { textAlign: "right" },
  box: { minHeight: 96, borderRadius: 20, borderWidth: 1.5, paddingHorizontal: 16 },
  input: { minHeight: 96, fontFamily: amFonts.medium, fontSize: 16, lineHeight: 22, paddingVertical: 12, textAlignVertical: "top", outlineStyle: "none" as never },
})
