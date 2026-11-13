import { StyleSheet, Text, View } from "react-native"

import { KPress } from "@/components/kirtan/KPress"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import type { PersonRole } from "@/lib/authors/roles"
import { useT } from "@/lib/i18n"

/** A segment is 40 high inside its 44 track; `hitSlop` brings the touch area to 48. */
const TOUCH = { top: 4, bottom: 4, left: 2, right: 2 } as const

/**
 * The two tabs of a person's page: "Wrote" and "Performs", each with its number of recordings. The caller passes only the
 * roles that have recordings and only when there are two (lib/authors/roles.ts `visibleRoles`), so an empty tab never shows
 * and a page with one role has no tabs. Holds no state.
 */
export function RoleTabs({ theme, roles, value, onChange }: { theme: SongsTheme; roles: { role: PersonRole; count: number }[]; value: PersonRole; onChange: (role: PersonRole) => void }) {
  const t = useT()
  if (roles.length < 2) return null
  return (
    <View accessibilityRole="tablist" accessibilityLabel={t("authors.page.role.tabs")} style={[s.track, { backgroundColor: theme.line }]} testID="role-tabs">
      {roles.map(({ role, count }) => {
        const on = role === value
        return (
          <KPress
            key={role}
            accessibilityRole="tab"
            accessibilityLabel={t(role === "wrote" ? "authors.page.role.wroteA11y" : "authors.page.role.performsA11y", { count })}
            accessibilityState={{ selected: on }}
            hitSlop={TOUCH}
            onPress={() => onChange(role)}
            pressedScale={0.97}
            outerStyle={s.outer}
            style={[s.seg, { backgroundColor: on ? theme.card : "transparent" }]}
            testID={`role-tab-${role}`}
          >
            <Text style={[s.label, { color: on ? theme.textHeading : theme.textBody, fontFamily: on ? amFonts.bold : amFonts.semi }]} numberOfLines={1}>
              {t(role === "wrote" ? "authors.page.role.wrote" : "authors.page.role.performs")}
            </Text>
            <Text style={[s.count, { color: on ? theme.textBody : theme.textMuted }]}>{count}</Text>
          </KPress>
        )
      })}
    </View>
  )
}

const s = StyleSheet.create({
  track: { flexDirection: "row", alignItems: "center", height: 44, borderRadius: 22, padding: 2, gap: 2 },
  outer: { flex: 1 },
  seg: { height: 40, borderRadius: 20, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  label: { fontSize: 14, lineHeight: 18, flexShrink: 1 },
  count: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
})
