import { useMemo, useState } from "react"
import { StyleSheet, Text, TextInput, View } from "react-native"

import { SpPress } from "@/components/song-v2/SpUi"
import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import { groupLanguages } from "@/lib/songPage/languages"
import type { LyricLanguage } from "@/lib/songPage/lyricLanguages"
import type { PageT } from "@/lib/songPage/pageCopy"

/** More languages than this and the list gets a search field; a short list needs none. */
const SEARCH_FROM = 8

/**
 * THE LANGUAGE LIST of the language menu: one row per language, many can be on. A chosen row carries its place in the
 * order (1, 2, 3: the order the languages stack under a word and sit on the page). The languages the song has come first,
 * the chosen ones on top of them; the languages it does not have yet follow, dimmed and not selectable, so the person sees
 * the list of languages is wider than this one song. It is the body of two sheets (the text options).
 */
export function LanguageList({ t, tr, available, chosen, onToggle }: { t: SpTheme; tr: PageT; available: readonly string[]; chosen: readonly string[]; onToggle: (code: string) => void }) {
  const [query, setQuery] = useState("")
  const groups = useMemo(() => groupLanguages(available, chosen, query), [available, chosen, query])
  const total = groups.inSong.length + groups.notYet.length
  const searchable = total > SEARCH_FROM || query.length > 0
  const row = (l: LyricLanguage, on: boolean, off: boolean) => {
    const place = chosen.indexOf(l.code) + 1
    return (
      <SpPress
        key={l.code}
        onPress={() => onToggle(l.code)}
        disabled={off}
        accessibilityRole="checkbox"
        accessibilityLabel={l.native === l.name ? l.name : `${l.native}, ${l.name}`}
        accessibilityState={{ checked: on, disabled: off }}
        pressedScale={0.985}
        style={[styles.row, { borderBottomColor: t.sand300 }, off && styles.off]}
      >
        <View style={styles.names}>
          <Text style={[styles.native, { color: t.ink900 }]} numberOfLines={1}>{l.native}</Text>
          {l.native === l.name ? null : <Text style={[styles.name, { color: t.ink500 }]} numberOfLines={1}>{l.name}</Text>}
        </View>
        <View style={[styles.tick, { borderColor: on ? (t.dark ? t.action : t.ink900) : t.sand400, backgroundColor: on ? (t.dark ? t.action : t.ink900) : "transparent" }]}>
          {on ? <Text style={[styles.place, { color: t.dark ? t.onAction : t.onInk }]}>{place}</Text> : null}
        </View>
      </SpPress>
    )
  }
  return (
    <View>
      {searchable ? (
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={tr("lang.search")}
          placeholderTextColor={t.ink500}
          accessibilityLabel={tr("lang.search")}
          autoCorrect={false}
          autoCapitalize="none"
          style={[styles.search, { color: t.ink900, borderColor: t.sand400, backgroundColor: t.white }]}
        />
      ) : null}
      {groups.inSong.length ? <Text style={[styles.group, { color: t.ink800 }]}>{tr("lang.inSong")}</Text> : null}
      {groups.inSong.map((l) => row(l, chosen.includes(l.code), false))}
      {groups.notYet.length ? <Text style={[styles.group, { color: t.ink500 }]}>{tr("lang.notYet")}</Text> : null}
      {groups.notYet.map((l) => row(l, false, true))}
      {total === 0 ? <Text style={[styles.empty, { color: t.ink500 }]}>{tr("lang.empty")}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  search: { height: 44, borderWidth: 1, borderRadius: 22, paddingHorizontal: 16, fontFamily: amFonts.medium, fontSize: 16, marginBottom: 4 },
  group: { fontFamily: amFonts.bold, fontSize: 12, lineHeight: 16, letterSpacing: 0.96, textTransform: "uppercase", marginTop: 16, marginBottom: 4 },
  row: { minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  off: { opacity: 0.45 },
  names: { flex: 1, gap: 1 },
  native: { fontFamily: amFonts.bold, fontSize: 17, lineHeight: 22 },
  name: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  tick: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  place: { fontFamily: amFonts.bold, fontSize: 13, lineHeight: 16 },
  empty: { fontFamily: amFonts.medium, fontSize: 15, lineHeight: 22, paddingVertical: 24, textAlign: "center" },
})
