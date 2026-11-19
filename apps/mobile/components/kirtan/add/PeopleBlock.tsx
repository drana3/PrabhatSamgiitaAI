import { useState } from "react"
import { StyleSheet, Text, View } from "react-native"

import { FieldError } from "@/components/kirtan/add/KindFields"
import { PersonPicker, type PickedPerson } from "@/components/credits/PersonPicker"
import { KPress } from "@/components/kirtan/KPress"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { useT } from "@/lib/i18n"
import { addChip, CREDIT_ROLES, MAX_PERFORMERS, removeChip, roleKey, setChipRole, type CreditRole, type PerformerChip } from "@/lib/kirtan/credits"

/**
 * "Who else is on it?" on the upload form (docs/co-performers.md): the other singers and players, or the person who wrote it.
 * A person with an author page is asked first (the recording shows on their page after "Yes, it's me"); a plain name stays plain
 * text. Up to ten people, each with a role. Holds no list: the form owns `performers` in its draft. Not shown for Baba's Audio.
 */
export function PeopleBlock({ theme, value, onChange, disabled }: { theme: SongsTheme; value: readonly PerformerChip[]; onChange: (next: PerformerChip[]) => void; disabled?: boolean }) {
  const t = useT()
  const [problem, setProblem] = useState<string | null>(null)
  const full = value.length >= MAX_PERFORMERS

  const pick = (person: PickedPerson) => {
    const added = addChip(value, { name: person.name, profileId: person.profileId, slug: person.slug })
    if (added.problem) {
      setProblem(t(`credits.problem.${added.problem}`))
      return
    }
    setProblem(person.lookupFailed ? t("credits.people.lookupFailed") : null)
    onChange(added.list)
  }

  return (
    <View style={s.root} testID="people-block">
      <View style={s.head}>
        <Text style={[s.label, { color: theme.textHeading }]} accessibilityRole="header">
          {t("credits.people.title")}
        </Text>
        <Text style={[s.hint, { color: theme.textBody }]} testID="people-count">
          {t("credits.people.count", { count: value.length, max: MAX_PERFORMERS })}
        </Text>
      </View>
      <Text style={[s.hint, { color: theme.textBody }]}>{t("credits.people.hint")}</Text>

      {value.length === 0 ? <Text style={[s.hint, { color: theme.textMuted }]}>{t("credits.people.none")}</Text> : null}
      {value.map((chip) => (
        <View key={chip.key} style={[s.chip, { backgroundColor: theme.card, borderColor: theme.line }]} testID={`people-chip-${chip.key}`}>
          <View style={s.chipTop}>
            <View style={s.chipText}>
              <Text style={[s.name, { color: theme.textHeading }]} numberOfLines={2}>
                {chip.name}
              </Text>
              <Text style={[s.hint, { color: chip.profileId ? theme.accentText : theme.textMuted }]}>{chip.profileId ? t("credits.people.pageWillAsk") : t("credits.people.nameOnly")}</Text>
            </View>
            <KPress accessibilityRole="button" accessibilityLabel={t("credits.people.remove", { name: chip.name })} disabled={disabled} hitSlop={8} onActivate={() => onChange(removeChip(value, chip.key))} pressedScale={0.94} style={[s.remove, { borderColor: theme.line }]}>
              <Text style={[s.removeText, { color: theme.textHeading }]}>×</Text>
            </KPress>
          </View>
          <View style={s.roles} accessibilityRole={"radiogroup" as never} accessibilityLabel={t("credits.people.roleFor", { name: chip.name })}>
            {CREDIT_ROLES.map((role) => (
              <RoleChoice key={role} theme={theme} role={role} on={chip.role === role} disabled={disabled} onPress={() => onChange(setChipRole(value, chip.key, role))} />
            ))}
          </View>
        </View>
      ))}

      {full ? <Text style={[s.hint, { color: theme.textMuted }]}>{t("credits.problem.limit")}</Text> : <PersonPicker theme={theme} onPick={pick} disabled={disabled} skipSlugs={value.flatMap((c) => (c.slug ? [c.slug] : []))} />}
      <FieldError theme={theme} text={problem} />
    </View>
  )
}

function RoleChoice({ theme, role, on, disabled, onPress }: { theme: SongsTheme; role: CreditRole; on: boolean; disabled?: boolean; onPress: () => void }) {
  const t = useT()
  const label = t(roleKey(role))
  return (
    <KPress accessibilityRole="radio" accessibilityState={{ checked: on, disabled: Boolean(disabled) }} accessibilityLabel={label} disabled={disabled} onActivate={onPress} pressedScale={0.96} style={[s.role, { backgroundColor: on ? theme.ink900 : "transparent", borderColor: on ? theme.ink900 : theme.line }]} testID={`people-role-${role}`}>
      <Text style={[s.roleText, { color: on ? theme.onInk : theme.textHeading }]}>{label}</Text>
    </KPress>
  )
}

const s = StyleSheet.create({
  root: { gap: 12 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  label: { flexShrink: 1, fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20 },
  hint: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  chip: { gap: 10, padding: 12, borderRadius: 16, borderWidth: 1 },
  chipTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  chipText: { flex: 1, gap: 2 },
  name: { fontFamily: amFonts.bold, fontSize: 16, lineHeight: 21 },
  remove: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  removeText: { fontFamily: amFonts.semi, fontSize: 20, lineHeight: 22 },
  roles: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  role: { minHeight: 40, borderRadius: 20, borderWidth: 1, justifyContent: "center", paddingHorizontal: 14 },
  roleText: { fontFamily: amFonts.semi, fontSize: 14, lineHeight: 18 },
})
